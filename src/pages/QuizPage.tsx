import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, CheckCircle, XCircle, Trophy, Star, Lock } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { saveQuizAnswer } from '../firebase/tripService';
import type { QuizAnswer } from '../types/trip';

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

  const hasPreTrip = quizQuestions.some((q) => q.dayIndex < 0);
  const firstPreTripDay = hasPreTrip
    ? Math.max(...quizQuestions.filter((q) => q.dayIndex < 0).map((q) => q.dayIndex))
    : null;
  const [selectedDay, setSelectedDay] = useState<number>(
    todayDayIndex >= 0 ? todayDayIndex : hasPreTrip ? -1 : 0
  );
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);

  // Questions load async: before the trip starts, land on the first pre-trip
  // question once it arrives (the mount default couldn't see it yet).
  const autoSelectedPreTrip = React.useRef(false);
  React.useEffect(() => {
    if (todayDayIndex < 0 && firstPreTripDay !== null && !autoSelectedPreTrip.current) {
      autoSelectedPreTrip.current = true;
      setSelectedDay(firstPreTripDay);
    }
  }, [todayDayIndex, firstPreTripDay]);
  const [answeredNow, setAnsweredNow] = useState(false);
  const [saving, setSaving] = useState(false);

  // Date-lock: each trip day's question unlocks on its actual date, derived
  // from the active trip's start date (works for any trip, not just Greece).
  const tripStart = config ? new Date(config.startDate) : null;
  const isDayUnlocked = (dayIndex: number): boolean => {
    if (dayIndex < 0) return true; // pre-trip questions are always open
    if (!tripStart) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const unlockDate = new Date(tripStart);
    unlockDate.setDate(unlockDate.getDate() + dayIndex);
    unlockDate.setHours(0, 0, 0, 0);
    return today >= unlockDate;
  };
  const getUnlockDate = (dayIndex: number): string => {
    if (!tripStart) return '';
    const d = new Date(tripStart);
    d.setDate(d.getDate() + dayIndex);
    return d.toLocaleDateString(isRTL ? 'he-IL' : 'en-GB', { day: 'numeric', month: 'short' });
  };

  // Current question for selected day
  const currentQuestion = quizQuestions.find((q) => q.dayIndex === selectedDay);

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
    } catch (err) {
      console.error('Failed to save quiz answer:', err);
      setSelectedOptionIndex(null);
    } finally {
      setSaving(false);
    }
  };

  // When changing day, reset local state
  const handleDayChange = (day: number) => {
    setSelectedDay(day);
    setSelectedOptionIndex(null);
    setAnsweredNow(false);
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
        {quizQuestions
          .filter((q) => q.dayIndex < 0)
          .sort((a, b) => b.dayIndex - a.dayIndex)
          .map((q) => (
            <button
              key={q.dayIndex}
              className={`day-tab pre-trip ${selectedDay === q.dayIndex ? 'active' : ''}`}
              onClick={() => handleDayChange(q.dayIndex)}
              title={isRTL ? 'לפני הטיול' : 'Pre-trip'}
            >
              ⭐{-q.dayIndex}
            </button>
          ))}
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
            {isRTL
              ? `החידון של יום ${selectedDay + 1} ייפתח ב־${getUnlockDate(selectedDay)} 🔒`
              : `Day ${selectedDay + 1}'s quiz unlocks on ${getUnlockDate(selectedDay)} 🔒`}
          </p>
        </div>
      ) : !currentQuestion ? (
        <div className="empty-state">
          <HelpCircle size={48} strokeWidth={1} />
          <p>{t('quiz.noQuiz')}</p>
        </div>
      ) : (
        <div className="quiz-card">
          <div className="quiz-question">
            <Star size={20} className="quiz-star" />
            <h2>
              {selectedDay < 0
                ? (isRTL ? `שאלת חימום ${-selectedDay} ⭐` : `Warm-up question ${-selectedDay} ⭐`)
                : t('quiz.question', { day: selectedDay + 1 })}
            </h2>
            <p>{isRTL ? currentQuestion.questionHe : currentQuestion.question}</p>
          </div>

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
