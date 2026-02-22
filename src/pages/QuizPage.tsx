import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { HelpCircle, CheckCircle, XCircle, Trophy, Star } from 'lucide-react';
import { useTripContext } from '../context/TripContext';
import { saveQuizAnswer } from '../firebase/tripService';
import type { QuizQuestion, QuizAnswer } from '../types/trip';

const TOTAL_DAYS = 12;

// Hardcoded quiz questions: one per day about Greece
const QUIZ_QUESTIONS: QuizQuestion[] = [
  {
    id: 'q1',
    dayIndex: 0,
    question: 'How many islands does Greece have?',
    questionHe: 'כמה איים יש ביוון?',
    options: ['~1,200', '~6,000', '~200', '~50'],
    optionsHe: ['~1,200', '~6,000', '~200', '~50'],
    correctIndex: 1,
    funFact: 'Greece has between 1,200 and 6,000 islands depending on the minimum size definition!',
    funFactHe: 'ליוון יש בין 1,200 ל-6,000 איים, תלוי בהגדרת הגודל המינימלי!',
  },
  {
    id: 'q2',
    dayIndex: 1,
    question: 'What is the Greek word for "hello"?',
    questionHe: 'מה המילה ביוונית ל"שלום"?',
    options: ['Kalimera', 'Yasou', 'Efharisto', 'Opa'],
    optionsHe: ['קלימרה', 'יאסו', 'אפחריסטו', 'אופה'],
    correctIndex: 1,
    funFact: 'Yasou literally means "to your health!" — Kalimera means "good morning."',
    funFactHe: 'יאסו פירושו המילולי "לבריאותך!" — קלימרה פירושה "בוקר טוב".',
  },
  {
    id: 'q3',
    dayIndex: 2,
    question: 'What is the national dish of Greece?',
    questionHe: 'מהו המאכל הלאומי של יוון?',
    options: ['Pasta', 'Moussaka', 'Paella', 'Sushi'],
    optionsHe: ['פסטה', 'מוסקה', 'פאייה', 'סושי'],
    correctIndex: 1,
    funFact: 'Moussaka is a layered dish of eggplant, minced meat, and bechamel sauce, baked to perfection!',
    funFactHe: 'מוסקה הוא מאכל שכבות של חציל, בשר טחון ורוטב בשמל, אפוי לשלמות!',
  },
  {
    id: 'q4',
    dayIndex: 3,
    question: 'Who is the king of the Greek gods in mythology?',
    questionHe: 'מי הוא מלך האלים במיתולוגיה היוונית?',
    options: ['Poseidon', 'Hades', 'Zeus', 'Apollo'],
    optionsHe: ['פוסידון', 'האדס', 'זאוס', 'אפולו'],
    correctIndex: 2,
    funFact: 'Zeus ruled from Mount Olympus and was known for throwing lightning bolts!',
    funFactHe: 'זאוס שלט מהר אולימפוס והיה ידוע בזריקת ברקים!',
  },
  {
    id: 'q5',
    dayIndex: 4,
    question: 'What sea lies to the east of mainland Greece?',
    questionHe: 'איזה ים נמצא ממזרח ליוון?',
    options: ['Mediterranean Sea', 'Black Sea', 'Aegean Sea', 'Adriatic Sea'],
    optionsHe: ['הים התיכון', 'הים השחור', 'הים האגאי', 'הים האדריאטי'],
    correctIndex: 2,
    funFact: 'The Aegean Sea is home to over 2,000 islands and has been a cradle of civilization for millennia!',
    funFactHe: 'הים האגאי הוא ביתם של מעל 2,000 איים והיה עריסת ציוויליזציה במשך אלפי שנים!',
  },
  {
    id: 'q6',
    dayIndex: 5,
    question: 'What is the famous white-and-blue island often seen on postcards?',
    questionHe: 'מהו האי הלבן-כחול המפורסם שנראה לעיתים על גלויות?',
    options: ['Crete', 'Mykonos', 'Santorini', 'Rhodes'],
    optionsHe: ['כרתים', 'מיקונוס', 'סנטוריני', 'רודוס'],
    correctIndex: 2,
    funFact: 'Santorini was formed by a massive volcanic eruption around 1600 BC that may have inspired the legend of Atlantis!',
    funFactHe: 'סנטוריני נוצרה מהתפרצות געשית עצומה בסביבות 1600 לפנה"ס שאולי השרתה את האגדה של אטלנטיס!',
  },
  {
    id: 'q7',
    dayIndex: 6,
    question: 'What ancient structure sits atop the Acropolis in Athens?',
    questionHe: 'איזה מבנה עתיק יושב על גבי האקרופוליס באתונה?',
    options: ['Colosseum', 'Parthenon', 'Stonehenge', 'Pyramids'],
    optionsHe: ['הקולוסאום', 'הפרתנון', 'סטונהנג\'', 'הפירמידות'],
    correctIndex: 1,
    funFact: 'The Parthenon was built in 447-432 BC as a temple to the goddess Athena and once housed a giant gold-and-ivory statue of her!',
    funFactHe: 'הפרתנון נבנה בשנים 447-432 לפנה"ס כמקדש לאלה אתנה ופעם אירח פסל ענק שלה מזהב ושנהב!',
  },
  {
    id: 'q8',
    dayIndex: 7,
    question: 'What is tzatziki made from?',
    questionHe: 'ממה מכינים צזיקי?',
    options: ['Tomatoes and basil', 'Yogurt and cucumber', 'Cheese and olives', 'Lemon and honey'],
    optionsHe: ['עגבניות ובזיליקום', 'יוגורט ומלפפון', 'גבינה וזיתים', 'לימון ודבש'],
    correctIndex: 1,
    funFact: 'Tzatziki is made with strained yogurt, cucumber, garlic, olive oil, and herbs. It is served with almost every Greek meal!',
    funFactHe: 'צזיקי מוכן מיוגורט מסונן, מלפפון, שום, שמן זית ועשבי תיבול. הוא מוגש כמעט עם כל ארוחה יוונית!',
  },
  {
    id: 'q9',
    dayIndex: 8,
    question: 'What were the ancient Olympic Games held to honor?',
    questionHe: 'לכבוד מי נערכו המשחקים האולימפיים העתיקים?',
    options: ['Athena', 'Poseidon', 'Zeus', 'Hermes'],
    optionsHe: ['אתנה', 'פוסידון', 'זאוס', 'הרמס'],
    correctIndex: 2,
    funFact: 'The ancient Olympics started in 776 BC in Olympia, Greece, and athletes competed completely naked!',
    funFactHe: 'האולימפיאדה העתיקה החלה ב-776 לפנה"ס באולימפיה, יוון, והספורטאים התחרו עירומים לחלוטין!',
  },
  {
    id: 'q10',
    dayIndex: 9,
    question: 'What is the largest Greek island?',
    questionHe: 'מהו האי היווני הגדול ביותר?',
    options: ['Rhodes', 'Corfu', 'Crete', 'Santorini'],
    optionsHe: ['רודוס', 'קורפו', 'כרתים', 'סנטוריני'],
    correctIndex: 2,
    funFact: 'Crete is the 5th largest island in the Mediterranean and was home to the ancient Minoan civilization — Europe\'s first advanced civilization!',
    funFactHe: 'כרתים הוא האי החמישי בגודלו בים התיכון והיה ביתה של הציוויליזציה המינואית — הציוויליזציה המתקדמת הראשונה באירופה!',
  },
  {
    id: 'q11',
    dayIndex: 10,
    question: 'What is the traditional Greek coffee served in?',
    questionHe: 'במה מוגש קפה יווני מסורתי?',
    options: ['A tall glass', 'A small cup (demitasse)', 'A bowl', 'A mug'],
    optionsHe: ['כוס גבוהה', 'כוס קטנה (דמיטס)', 'קערה', 'ספל'],
    correctIndex: 1,
    funFact: 'Greek coffee is brewed in a briki (small pot) and served unfiltered in a demitasse cup. The grounds settle at the bottom — never drink the last sip!',
    funFactHe: 'קפה יווני מבושל בבריקי (סיר קטן) ומוגש ללא סינון בכוס דמיטס. השאריות שוקעות לתחתית — לעולם אל תשתו את הלגימה האחרונה!',
  },
  {
    id: 'q12',
    dayIndex: 11,
    question: 'What does "Opa!" mean in Greek culture?',
    questionHe: 'מה המשמעות של "אופה!" בתרבות היוונית?',
    options: [
      'Sorry',
      'An exclamation of joy and celebration',
      'Goodbye',
      'Please',
    ],
    optionsHe: [
      'סליחה',
      'קריאת שמחה וחגיגה',
      'להתראות',
      'בבקשה',
    ],
    correctIndex: 1,
    funFact: '"Opa!" is shouted during celebrations, dancing, and plate-smashing. It expresses joy, excitement, and living in the moment!',
    funFactHe: '"אופה!" נצעק במהלך חגיגות, ריקודים ושבירת צלחות. זה מבטא שמחה, התרגשות וחיים ברגע!',
  },
];

const QuizPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { quizAnswers, tripCode, currentMember, config, todayDayIndex } = useTripContext();
  const isRTL = i18n.language === 'he';

  const [selectedDay, setSelectedDay] = useState<number>(
    todayDayIndex >= 0 ? todayDayIndex : 0
  );
  const [selectedOptionIndex, setSelectedOptionIndex] = useState<number | null>(null);
  const [answeredNow, setAnsweredNow] = useState(false);
  const [saving, setSaving] = useState(false);

  // Current question for selected day
  const currentQuestion = QUIZ_QUESTIONS.find((q) => q.dayIndex === selectedDay);

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

      {/* Day selector tabs */}
      <div className="day-tabs">
        {Array.from({ length: TOTAL_DAYS }, (_, i) => (
          <button
            key={i}
            className={`day-tab ${selectedDay === i ? 'active' : ''} ${todayDayIndex === i ? 'today' : ''}`}
            onClick={() => handleDayChange(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      {/* Quiz content */}
      {!currentQuestion ? (
        <div className="empty-state">
          <HelpCircle size={48} strokeWidth={1} />
          <p>{t('quiz.noQuiz')}</p>
        </div>
      ) : (
        <div className="quiz-card">
          <div className="quiz-question">
            <Star size={20} className="quiz-star" />
            <h2>
              {t('quiz.question', { day: selectedDay + 1 })}
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
