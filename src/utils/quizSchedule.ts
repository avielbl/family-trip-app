// When each quiz question is available, and how a day's set is grouped.
//
// Questions carry a dayIndex: 0-based for trip days, negative for the
// pre-flight set asked before departure. Several questions now share a day, so
// the page works with groups rather than a single question per day.

import type { QuizAnswer, QuizQuestion } from '../types/trip';

/** How many questions a full day's set holds. */
export const QUESTIONS_PER_DAY = 5;

/** How many questions the pre-flight set holds. */
export const PRE_FLIGHT_COUNT = 5;

/**
 * The bucket pre-flight questions live in. Any negative dayIndex counts as
 * pre-flight, so sets written before this was one group (-1, -2, -3 as separate
 * days) still appear, collected together.
 */
export const PRE_FLIGHT_DAY = -1;

export function isPreFlight(question: QuizQuestion): boolean {
  return question.dayIndex < 0;
}

/** Midnight at the start of a date, in local time. */
function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Whether the pre-flight set is still open.
 *
 * It can be answered from any time before departure until the end of the first
 * day — there is plenty to do on arrival day, so the deadline is generous, but
 * it does close: these are warm-up questions, and a trip two-thirds done should
 * not still be offering them.
 *
 * Derived from the trip's start date rather than todayDayIndex, which is -1
 * both before the trip and after it ends and would reopen the set on the way
 * home.
 */
export function isPreFlightOpen(tripStart: Date | null, now: Date = new Date()): boolean {
  if (!tripStart || Number.isNaN(tripStart.getTime())) return true;
  const closesAt = startOfDay(tripStart);
  closesAt.setDate(closesAt.getDate() + 1); // midnight ending day 1
  return now < closesAt;
}

/** The date a trip day's questions unlock. */
export function dayUnlockDate(tripStart: Date, dayIndex: number): Date {
  const d = startOfDay(tripStart);
  d.setDate(d.getDate() + dayIndex);
  return d;
}

/** A trip day's questions open on that day, not before. */
export function isDayUnlocked(
  tripStart: Date | null,
  dayIndex: number,
  now: Date = new Date()
): boolean {
  if (dayIndex < 0) return isPreFlightOpen(tripStart, now);
  if (!tripStart || Number.isNaN(tripStart.getTime())) return true;
  return startOfDay(now) >= dayUnlockDate(tripStart, dayIndex);
}

/**
 * Every question for one day, in a stable order so the set does not reshuffle
 * between visits. Passing a negative dayIndex returns the whole pre-flight set,
 * however its questions were originally numbered.
 */
export function questionsForDay(questions: QuizQuestion[], dayIndex: number): QuizQuestion[] {
  const inDay =
    dayIndex < 0
      ? questions.filter(isPreFlight)
      : questions.filter((q) => q.dayIndex === dayIndex);
  return [...inDay].sort((a, b) => {
    // Pre-flight sets written as separate days keep their original order.
    if (a.dayIndex !== b.dayIndex) return b.dayIndex - a.dayIndex;
    return a.id.localeCompare(b.id, undefined, { numeric: true });
  });
}

export interface DayProgress {
  total: number;
  answered: number;
  correct: number;
  /** Index of the first question this member has not answered, or -1. */
  firstUnanswered: number;
}

/** How far one member has got through a day's set. */
export function progressForDay(
  dayQuestions: QuizQuestion[],
  answers: QuizAnswer[],
  memberId: string | null | undefined
): DayProgress {
  if (!memberId) {
    return { total: dayQuestions.length, answered: 0, correct: 0, firstUnanswered: dayQuestions.length ? 0 : -1 };
  }
  const mine = new Map(
    answers.filter((a) => a.memberId === memberId).map((a) => [a.questionId, a])
  );
  let answered = 0;
  let correct = 0;
  let firstUnanswered = -1;
  dayQuestions.forEach((q, i) => {
    const answer = mine.get(q.id);
    if (!answer) {
      if (firstUnanswered === -1) firstUnanswered = i;
      return;
    }
    answered++;
    if (answer.correct) correct++;
  });
  return { total: dayQuestions.length, answered, correct, firstUnanswered };
}
