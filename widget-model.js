// This factory is serialised into the offline Scriptable script. Keep it self-contained.
export function createWidgetModel() {
  function dayKey(date = new Date()) {
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  }
  function atTime(date, time) {
    const result = new Date(date), [hour, minute] = time.split(':').map(Number);
    result.setHours(hour, minute, 0, 0);
    return result.getTime();
  }
  function ensureDay(state, words, now = new Date()) {
    const key = dayKey(now);
    if (!state.days[key]) state.days[key] = {
      ids: words.filter(word => !state.learned[word.id]).slice(0, state.settings.dailyTarget).map(word => word.id),
      start: atTime(now, state.settings.startTime), interval: state.settings.interval,
    };
    return state.days[key];
  }
  function view(state, words, now = new Date()) {
    const day = ensureDay(state, words, now);
    const entries = day.ids.map((id,index) => ({id, at:day.start + index * day.interval * 60000}));
    const remaining = entries.filter(entry => !state.learned[entry.id]);
    const active = remaining.find(entry => entry.at <= now.getTime());
    const next = remaining.find(entry => entry.at > now.getTime());
    const tomorrow = new Date(now); tomorrow.setDate(tomorrow.getDate()+1); tomorrow.setHours(0,0,0,0);
    return {
      day:dayKey(now), status:active ? 'ready' : remaining.length ? 'waiting' : 'done',
      word:active ? words.find(word => word.id === active.id) : null,
      done:day.ids.filter(id => Boolean(state.learned[id])).length, total:day.ids.length,
      nextAt:next?.at || null,
      refreshAt:Math.min(next?.at || tomorrow.getTime(), tomorrow.getTime()),
    };
  }
  function mark(state, words, id, expectedDay, now = new Date()) {
    const current = view(state, words, now);
    if (current.status !== 'ready' || current.day !== expectedDay || current.word.id !== id) return false;
    state.learned[id] = {learnedAt:now.getTime(), dueAt:now.getTime(), stage:0};
    return true;
  }
  function valid(state, words) {
    const ids = new Set(words.map(word => word.id));
    const time = value => typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
    if (!state || state.version !== 1 || !state.settings || !state.learned || !state.days
      || Array.isArray(state.learned) || Array.isArray(state.days)) return false;
    const settings = state.settings;
    if (!['mn','en'].includes(settings.language) || !time(settings.startTime)
      || !Number.isInteger(settings.dailyTarget) || settings.dailyTarget < 1 || settings.dailyTarget > 20
      || !Number.isInteger(settings.interval) || settings.interval < 1 || settings.interval > 180) return false;
    const [hour,minute] = settings.startTime.split(':').map(Number);
    if (hour*60 + minute + (settings.dailyTarget-1)*settings.interval >= 1440) return false;
    if (!Object.entries(state.learned).every(([id,entry]) => ids.has(id) && entry
      && Number.isFinite(entry.learnedAt) && Number.isFinite(entry.dueAt)
      && Number.isInteger(entry.stage) && entry.stage >= 0 && entry.stage <= 6)) return false;
    return Object.entries(state.days).every(([key,day]) => /^\d{4}-\d{2}-\d{2}$/.test(key)
      && day && Array.isArray(day.ids) && day.ids.length <= 20 && day.ids.every(id => ids.has(id))
      && new Set(day.ids).size === day.ids.length && Number.isFinite(day.start)
      && Number.isInteger(day.interval) && day.interval >= 1 && day.interval <= 180);
  }
  return {dayKey, ensureDay, view, mark, valid};
}
