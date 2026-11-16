import { validateSettings } from './core.js';
import { baseWords } from './words.js';
import { validAdvanced } from './advanced-state.js';
import { validGrammar } from './grammar.js';

const timestamp = value => Number.isFinite(value) && value >= 0;
const flags = ['notifications', 'newNotifications', 'reviewNotifications', 'testNotifications', 'sound', 'vibration', 'autoSpeak', 'compact'];
const questionTypes = ['meaning', 'reverse', 'choice', 'fill', 'audio', 'sentence'];

function validTest(test,known) {
  return test && timestamp(test.startedAt)
    && Array.isArray(test.questions) && test.questions.length >= 6 && test.questions.length <= 10
    && test.questions.every(question => question && known(question.id)
      && questionTypes.includes(question.type)
      && Array.isArray(question.options) && question.options.length === 4
      && question.options.every(known) && new Set(question.options).size === 4
      && question.options.includes(question.id))
    && Array.isArray(test.answers) && test.answers.length <= test.questions.length
    && test.answers.every(answer => answer && typeof answer.value === 'string' && typeof answer.correct === 'boolean')
    && Number.isInteger(test.index) && test.index >= 0 && test.index < test.questions.length
    && test.answers.length >= test.index && test.answers.length <= test.index + 1;
}

export function validBackup(data) {
  if(!data||!validAdvanced(data.advanced))return false;
  const ids=new Set([...baseWords,...(data.advanced?.customWords||[])].map(w=>w.id));
  const known=id=>typeof id==='string'&&ids.has(id);
  if (!data || data.version !== 1 || !data.settings || !validateSettings(data.settings)) return false;
  if (!flags.every(key => typeof data.settings[key] === 'boolean')) return false;
  if (!data.learned || typeof data.learned !== 'object' || Array.isArray(data.learned)) return false;
  if (!Object.entries(data.learned).every(([id, entry]) => known(id) && entry
    && timestamp(entry.learnedAt) && timestamp(entry.dueAt)
    && Number.isInteger(entry.stage) && entry.stage >= 0 && entry.stage <= 6)) return false;
  if (!['favorites', 'difficult'].every(key => Array.isArray(data[key])
    && data[key].every(known) && new Set(data[key]).size === data[key].length)) return false;
  if (!data.days || typeof data.days !== 'object' || Array.isArray(data.days)) return false;
  if (!Object.entries(data.days).every(([key, day]) => /^\d{4}-\d{2}-\d{2}$/.test(key)
    && day && Array.isArray(day.ids) && day.ids.every(known) && day.ids.length <= 20
    && new Set(day.ids).size === day.ids.length && timestamp(day.start)
    && Number.isInteger(day.interval) && day.interval >= 1 && day.interval <= 180)) return false;
  if (!Array.isArray(data.reviews) || !data.reviews.every(entry => entry && known(entry.id)
    && typeof entry.correct === 'boolean' && timestamp(entry.at))) return false;
  if (!Array.isArray(data.tests) || !data.tests.every(test => validTest(test,known)
    && test.answers.length === test.questions.length && timestamp(test.finishedAt))) return false;
  if (!Array.isArray(data.notified) || !data.notified.every(key => typeof key === 'string')) return false;
  if (!validGrammar(data.grammar)) return false;
  return data.activeTest === null || Boolean(validTest(data.activeTest,known));
}
