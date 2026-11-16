import { lessons } from './grammar-data.js';
import { dayKey } from './core.js';

export const levels = ['A1', 'A2', 'B1', 'B2', 'C1'];
export function calendarDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || '')) return NaN;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return NaN;
  return date.getTime() / 86400000;
}

export function startGrammar(state, now = new Date()) {
  if (!state.grammar) state.grammar = { startedOn: dayKey(now), completed: {}, attempts: {} };
  return state.grammar;
}

// Calendar days avoid a one-hour drift when daylight-saving time changes.
export function availableLessons(grammar, now = new Date()) {
  if (!grammar) return 0;
  const elapsed = calendarDay(dayKey(now)) - calendarDay(grammar.startedOn);
  return Math.min(lessons.length, Math.max(0, Math.floor(elapsed / 7) + 1));
}

export function lessonUnlockDate(grammar, index) {
  const ordinal = calendarDay(grammar.startedOn) + index * 7;
  const utc = new Date(ordinal * 86400000);
  return new Date(utc.getUTCFullYear(), utc.getUTCMonth(), utc.getUTCDate());
}

export function currentLesson(grammar, now = new Date()) {
  const available = availableLessons(grammar, now);
  if (!available) return null;
  return lessons.slice(0, available).find(lesson => !grammar.completed[lesson.id]) || lessons[available - 1];
}

export function checkGrammar(state, id, answers, now = new Date()) {
  const index = lessons.findIndex(lesson => lesson.id === id);
  if (index < 0 || index >= availableLessons(state.grammar, now)) return null;
  const lesson = lessons[index];
  if (!Array.isArray(answers) || answers.length !== lesson.questions.length
    || !answers.every((answer, i) => Number.isInteger(answer) && answer >= 0 && answer < lesson.questions[i].options.length)) return null;
  const score = answers.filter((answer, i) => answer === lesson.questions[i].correct).length;
  const attempt = { answers, score, at: now.getTime() };
  state.grammar.attempts[id] = attempt;
  if (score === lesson.questions.length && !state.grammar.completed[id]) state.grammar.completed[id] = { at: now.getTime() };
  return attempt;
}

export function validGrammar(grammar) {
  if (grammar === undefined || grammar === null) return true; // Backwards-compatible v1 backups.
  if (!grammar || !Number.isFinite(calendarDay(grammar.startedOn))) return false;
  if (!grammar.completed || Array.isArray(grammar.completed) || typeof grammar.completed !== 'object'
    || !grammar.attempts || Array.isArray(grammar.attempts) || typeof grammar.attempts !== 'object') return false;
  if (!Object.entries(grammar.completed).every(([id, value]) => lessons.some(l => l.id === id)
    && value && Number.isFinite(value.at) && value.at >= 0)) return false;
  return Object.entries(grammar.attempts).every(([id, attempt]) => {
    const lesson = lessons.find(l => l.id === id);
    return lesson && attempt && Number.isFinite(attempt.at) && attempt.at >= 0
      && Array.isArray(attempt.answers) && attempt.answers.length === lesson.questions.length
      && attempt.answers.every((a, i) => Number.isInteger(a) && a >= 0 && a < lesson.questions[i].options.length)
      && attempt.score === attempt.answers.filter((a, i) => a === lesson.questions[i].correct).length;
  });
}
