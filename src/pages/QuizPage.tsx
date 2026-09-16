import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, CheckCircle, XCircle, Trophy, Star, Lock, Plane, ChevronRight } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { saveQuizAnswer } from '../firebase/tripService';
import type { QuizAnswer } from '../types/trip';
import {
  PRE_FLIGHT_DAY,
  isDayUnlocked as isUnlocked,
  isPreFlightOpen,
  progressForDay,
  questionsForDay,
} from '../utils/quizSchedule';

/** Long enough to read the fun fact before the next question arrives. */
const AUTO_ADVANCE_MS = 4500;

const QuizPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const {
    quizAnswers,
    quizQuestions,
    tripCode,
    currentMember,
    config,
    todayDayIndex,
    totalDays,
    isAdmin,
  } = useTripContext();
  const isRTL = i18n.language === 'he';

  const tripStart = config ? new Date(config.startDate) : null;
  const preFlightQuestions = questionsForDay(quizQuestions, PRE_FLIGHT_DAY);
  const preFlightOpen = isPreFlightOpen(tripStart);
  const hasPreFlight = preFlightQuestions.length > 0;

  // Land on today's set during the trip; before it, on the pre-flight set.
  const [selectedDay, setSelectedDay] = useState<number>(
    todayDayIndex >= 0 ? todayDayIndex : hasPreFlight ? PRE_FLIGHT_DAY : 0
  );
  // Which question within the selected day's set is on screen.
  const [activeIndex, setActiveIndex] = useState(0);
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [answeredNow, setAnsweredNow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [autoAdvancing, setAutoAdvancing] = useState(false);

  const dayQuestions = useMemo(
    () => questionsForDay(quizQuestions, selectedDay),
    [quizQuestions, selectedDay]
  );
  const progress = useMemo(
    () => progressForDay(dayQuestions, quizAnswers, currentMember?.id),
    [dayQuestions, quizAnswers, currentMember]
  );

  // Questions arrive asynchronously, so the set for a day can appear after the
  // page has already settled on it. Once it does, open the first one still
  // unanswered rather than starting again from the top.
  const settledFor = React.useRef<string>('');
  React.useEffect(() => {
    const key = `${selectedDay}:${dayQuestions.length}:${currentMember?.id ?? ''}`;
    if (settledFor.current === key || !dayQuestions.length) return;
    settledFor.current = key;
    setActiveIndex(progress.firstUnanswered === -1 ? 0 : progress.firstUnanswered);
  }, [selectedDay, dayQuestions.length, currentMember, progress.firstUnanswered]);

  // Before the trip, drop onto the pre-flight set once it loads.
  const autoSelectedPreFlight = React.useRef(false);
  React.useEffect(() => {
    if (todayDayIndex < 0 && hasPreFlight && preFlightOpen && !autoSelectedPreFlight.current) {
      autoSelectedPreFlight.current = true;
      setSelectedDay(PRE_FLIGHT_DAY);
    }
  }, [todayDayIndex, hasPreFlight, preFlightOpen]);

  const isDayUnlocked = (dayIndex: number) => isUnlocked(tripStart, dayIndex);
  const getUnlockDate = (dayIndex: number): string => {
    if (!tripStart) return '';
    const d = new Date(tripStart);
    d.setDate(d.getDate() + dayIndex);
    return d.toLocaleDateString(isRTL ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' });
  };

  const currentQuestion = dayQuestions[activeIndex] ?? null;

  // Check if current member already answered this question
  const existingAnswer = useMemo(() => {
    if (!currentMember || !currentQuestion) return null;
    return quizAnswers.find(
      (a) => a.memberId === currentMember.id && a.questionId === currentQuestion.id
    ) || null;
  }, [quizAnswers, currentMember, currentQuestion]);

  // Determine if we should show result (either already answered or just answered)
  const showResult = !!existingAnswer || answeredNow;
  const answerIndex = existingAnswer ? existingAnswer.selectedIndex : selectedOptionIndex;
  const isCorrect = currentQuestion
    ? answerIndex === currentQuestion.correctIndex
    : false;

  // Handle selecting an option
  const handleSelectOption = async (optionIndex: number) => {
    if (showResult || !currentQuestion || !tripCode || !currentMember || saving) return;

    setSelectedOptionIndex(optionIndex);
    setSaving(true);

    try {
      const answer: QuizAnswer = {
        memberId: currentMember.id,
        questionId: currentQuestion.id,
        selectedIndex: optionIndex,
        correct: optionIndex === currentQuestion.correctIndex,
      };
      await saveQuizAnswer(tripCode, answer);
      setAnsweredNow(true);
      setSaveError('');
    } catch (err) {
      // Reverting the selection with nothing said made a failed save look like
      // a tap that simply did not register.
      console.error('Failed to save quiz answer:', err);
      setSelectedOptionIndex(null);
      setSaveError(
        isRTL ? 'לא הצלחנו לשמור את התשובה. נסו שוב.' : 'Could not save the answer. Try again.'
      );
    } finally {
      setSaving(false);
    }
  };

  // When changing day, reset local state
  const handleDayChange = (day: number) => {
    setSelectedDay(day);
    settledFor.current = '';
    setActiveIndex(0);
    setSelectedOptionIndex(null);
    setAnsweredNow(false);
  };

  const goToQuestion = React.useCallback((index: number) => {
    setAutoAdvancing(false);
    setActiveIndex(index);
    setSelectedOptionIndex(null);
    setAnsweredNow(false);
    setSaveError('');
  }, []);

  // Once answered, move on by itself. The delay is there so the fun fact can be
  // read — that is most of why the quiz exists — and any tap, swipe or dot
  // cancels it, so nobody is dragged off a screen they are still reading.
  const hasNext = activeIndex < dayQuestions.length - 1;
  React.useEffect(() => {
    if (!answeredNow || !hasNext) return;
    setAutoAdvancing(true);
    const id = window.setTimeout(() => goToQuestion(activeIndex + 1), AUTO_ADVANCE_MS);
    return () => {
      window.clearTimeout(id);
      setAutoAdvancing(false);
    };
  }, [answeredNow, hasNext, activeIndex, goToQuestion]);

  // Step through the set with a swipe as well as a tap — on a phone that is the
  // gesture people reach for first. In Hebrew the set reads right-to-left, so
  // "next" is the swipe towards the start of the line, not away from it.
  const touchStartX = React.useRef<number | null>(null);
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.changedTouches[0]?.clientX ?? null;
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    const start = touchStartX.current;
    touchStartX.current = null;
    if (start === null) return;
    const dx = (e.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(dx) < 60) return; // ignore taps and scroll wobble
    const forward = isRTL ? dx > 0 : dx < 0;
    const next = activeIndex + (forward ? 1 : -1);
    if (next >= 0 && next < dayQuestions.length) goToQuestion(next);
  };

  // Scoreboard: total correct per member
  const scoreboard = useMemo(() => {
    if (!config) return [];
    return config.familyMembers.map((member) => {
      const memberAnswers = quizAnswers.filter((a) => a.memberId === member.id);
      const correctCount = memberAnswers.filter((a) => a.correct).length;
      return {
        member,
        correct: correctCount,
        total: memberAnswers.length,
      };
    }).sort((a, b) => b.correct - a.correct);
  }, [config, quizAnswers]);

  return (
    <div className="quiz-page">
      <h1>
        <HelpCircle size={24} />
        <span>{t('quiz.title')}</span>
      </h1>

      {/* Day selector tabs — pre-trip (⭐, always open) first, then trip days */}
      <div className="day-tabs">
        {hasPreFlight && (
          <button
            className={`day-tab pre-trip ${selectedDay === PRE_FLIGHT_DAY ? 'active' : ''} ${!preFlightOpen ? 'locked' : ''}`}
            onClick={() => handleDayChange(PRE_FLIGHT_DAY)}
            title={isRTL ? 'לפני הטיסה' : 'Before the flight'}
          >
            {preFlightOpen ? <Plane size={13} /> : <Lock size={12} />}
          </button>
        )}
        {Array.from({ length: totalDays }, (_, i) => (
          <button
            key={i}
            className={`day-tab ${selectedDay === i ? 'active' : ''} ${todayDayIndex === i ? 'today' : ''} ${!isDayUnlocked(i) ? 'locked' : ''}`}
            onClick={() => handleDayChange(i)}
          >
            {isDayUnlocked(i) ? i + 1 : <Lock size={12} />}
          </button>
        ))}
      </div>

      {/* Quiz content */}
      {quizQuestions.length === 0 ? (
        <div className="empty-state">
          <HelpCircle size={48} strokeWidth={1} />
          <p>{t('quiz.noQuiz')}</p>
          {isAdmin && <p>{t('quiz.adminHint')}</p>}
        </div>
      ) : !isDayUnlocked(selectedDay) ? (
        <div className="empty-state">
          <Lock size={48} strokeWidth={1} />
          <p>
            {selectedDay < 0
              ? (isRTL
                  ? 'שאלות הטרום-טיסה נסגרו בתום היום הראשון ✈️'
                  : 'The pre-flight questions closed at the end of day 1 ✈️')
              : (isRTL
                  ? `החידון של יום ${selectedDay + 1} ייפתח ב־${getUnlockDate(selectedDay)} 🔒`
                  : `Day ${selectedDay + 1}'s quiz unlocks on ${getUnlockDate(selectedDay)} 🔒`)}
          </p>
        </div>
      ) : !currentQuestion ? (
        <div className="empty-state">
          <HelpCircle size={48} strokeWidth={1} />
          <p>{t('quiz.noQuiz')}</p>
        </div>
      ) : (
        <div className="quiz-card" onTouchStart={handleTouchStart} onTouchEnd={handleTouchEnd}>
          {/* Which question of the day's set this is, and how the set is going */}
          <div className="quiz-set-bar">
            <span className="quiz-set-label">
              {selectedDay < 0
                ? (isRTL ? '✈️ לפני הטיסה' : '✈️ Before the flight')
                : (isRTL ? `יום ${selectedDay + 1}` : `Day ${selectedDay + 1}`)}
              {' · '}
              {isRTL
                ? `שאלה ${activeIndex + 1} מתוך ${dayQuestions.length}`
                : `Question ${activeIndex + 1} of ${dayQuestions.length}`}
            </span>
            <span className="quiz-set-dots">
              {dayQuestions.map((q, i) => {
                const answer = currentMember
                  ? quizAnswers.find((a) => a.memberId === currentMember.id && a.questionId === q.id)
                  : undefined;
                const state = answer ? (answer.correct ? 'correct' : 'wrong') : 'todo';
                return (
                  <button
                    key={q.id}
                    className={`quiz-dot ${state} ${i === activeIndex ? 'current' : ''}`}
                    onClick={() => goToQuestion(i)}
                    aria-label={
                      isRTL ? `שאלה ${i + 1}` : `Question ${i + 1}`
                    }
                  />
                );
              })}
            </span>
          </div>

          {selectedDay < 0 && preFlightOpen && (
            <p className="quiz-preflight-note">
              {isRTL
                ? 'אפשר לענות עד סוף היום הראשון של הטיול.'
                : 'Answerable until the end of the first day of the trip.'}
            </p>
          )}

          <div className="quiz-question">
            <Star size={20} className="quiz-star" />
            <p>{isRTL ? currentQuestion.questionHe : currentQuestion.question}</p>
          </div>

          {saveError && <p className="quiz-save-error">{saveError}</p>}

          {/* Options */}
          <div className="quiz-options">
            {(isRTL ? currentQuestion.optionsHe : currentQuestion.options).map(
              (option, idx) => {
                let className = 'quiz-option';
                if (showResult) {
                  if (idx === currentQuestion.correctIndex) {
                    className += ' quiz-option-correct';
                  } else if (idx === answerIndex && idx !== currentQuestion.correctIndex) {
                    className += ' quiz-option-wrong';
                  }
                }
                if (!showResult && selectedOptionIndex === idx) {
                  className += ' selected';
                }

                return (
                  <button
                    key={idx}
                    className={className}
                    onClick={() => handleSelectOption(idx)}
                    disabled={showResult || saving}
                  >
                    <span className="option-letter">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span className="option-text">{option}</span>
                    {showResult && idx === currentQuestion.correctIndex && (
                      <CheckCircle size={20} className="option-icon" />
                    )}
                    {showResult &&
                      idx === answerIndex &&
                      idx !== currentQuestion.correctIndex && (
                        <XCircle size={20} className="option-icon" />
                      )}
                  </button>
                );
              }
            )}
          </div>

          {/* Result feedback */}
          {showResult && (
            <div className="quiz-result">
              <div className={`result-badge ${isCorrect ? 'correct' : 'incorrect'}`}>
                {isCorrect ? (
                  <>
                    <CheckCircle size={24} />
                    <span>{t('quiz.correct')}</span>
                  </>
                ) : (
                  <>
                    <XCircle size={24} />
                    <span>{t('quiz.incorrect')}</span>
                  </>
                )}
              </div>
              <div className="fun-fact">
                <Star size={16} />
                <div>
                  <strong>{t('quiz.funFact')}</strong>
                  <p>
                    {isRTL ? currentQuestion.funFactHe : currentQuestion.funFact}
                  </p>
                </div>
              </div>

              {/* Move through the set only on a tap — the fun fact is half the
                  point and auto-advancing would snatch it away mid-sentence. */}
              {hasNext ? (
                <button className="quiz-next" onClick={() => goToQuestion(activeIndex + 1)}>
                  {isRTL ? 'לשאלה הבאה' : 'Next question'}
                  <ChevronRight size={16} style={isRTL ? { transform: 'scaleX(-1)' } : undefined} />
                  {autoAdvancing && <span className="quiz-autobar" />}
                </button>
              ) : (
                <div className="quiz-set-done">
                  {progress.answered >= dayQuestions.length
                    ? (isRTL
                        ? `סיימתם! ${progress.correct} מתוך ${dayQuestions.length} נכונות 🎉`
                        : `Set complete — ${progress.correct} of ${dayQuestions.length} correct 🎉`)
                    : (isRTL ? 'נשארו שאלות שלא נענו' : 'Some questions are still unanswered')}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Scoreboard */}
      <div className="scoreboard">
        <h2>
          <Trophy size={22} />
          <span>{t('quiz.scoreboard')}</span>
        </h2>
        <div className="scoreboard-table">
          {scoreboard.map(({ member, correct, total }, idx) => (
            <div key={member.id} className="score-row">
              <div className="score-rank">
                {idx === 0 && correct > 0 ? (
                  <Trophy size={18} className="trophy-icon" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>
              <div className="score-member">
                <span className="member-emoji">{member.emoji}</span>
                <span className="member-name">
                  {isRTL ? member.nameHe : member.name}
                </span>
              </div>
              <div className="score-value">
                {t('quiz.score', { correct, total })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default QuizPage;
