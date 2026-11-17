// Windows 11 Widgets Board tile (Microsoft Edge "PWA-driven widgets").
//
// The Widgets Board renders an Adaptive Card, not HTML, and the service worker is what pushes it —
// but a service worker cannot read localStorage, where the learning state lives. So the page builds
// the whole payload (card template + data, in the user's language) and posts it to the worker, which
// caches it and calls widgets.updateByTag(). The static widgets/daily-card.json and
// widgets/daily-data.json in the manifest are only the fallback for the very first render, before
// the app has run once.
//
// Nothing here is iPhone-specific; the Scriptable export in widget-export.js stays as it is.
import {ensureDay, schedule} from './core.js';

export const WIDGET_TAG = 'english-words-daily';

/** What today looks like right now: the word that is unlocked, or when the next one unlocks. */
export function widgetView(state, words, now = Date.now()) {
  const day = ensureDay(state, words, new Date(now));
  const remaining = schedule(day).filter(entry => !state.learned[entry.id]);
  const active = remaining.find(entry => entry.at <= now);
  const next = remaining.find(entry => entry.at > now);
  return {
    done: day.ids.filter(id => state.learned[id]).length, total: day.ids.length,
    word: active ? words.find(word => word.id === active.id) || null : null,
    nextAt: next ? next.at : null,
    status: active ? 'ready' : remaining.length ? 'waiting' : 'done',
  };
}

/** Adaptive Card data: one flat object, its keys matching the ${…} placeholders in the template. */
export function widgetData(view, labels) {
  const word = view.word;
  return {
    progress: `${view.done}/${view.total}`,
    status: word ? `${word.level} · ${labels.ready}` : view.status === 'waiting' ? labels.waiting : labels.done,
    word: word ? word.word : view.status === 'waiting' && view.nextAt ? labels.time(view.nextAt) : '✓',
    ipa: word ? word.ipa : '',
    translation: word ? word.translation : view.status === 'waiting' ? labels.waitingSub : labels.doneSub,
  };
}

/** The shipped card with its two buttons renamed into the user's language. */
export function widgetTemplate(card, labels) {
  const template = JSON.parse(JSON.stringify(card));
  const titles = {'open-primary': labels.open, 'open-review': labels.review};
  for (const action of template.actions || []) if (titles[action.verb]) action.title = titles[action.verb];
  return template;
}

/** Sends the current card to the service worker. Silently does nothing where widgets don't exist. */
export async function publishWidget(state, words, labels, scope = globalThis) {
  const container = scope.navigator?.serviceWorker;
  if (!container) return false;
  try {
    const registration = await container.ready;
    const worker = registration.active;
    if (!worker) return false;
    const card = await (await fetch('./widgets/daily-card.json')).json();
    worker.postMessage({
      type: 'WIDGET_DATA', tag: WIDGET_TAG,
      template: JSON.stringify(widgetTemplate(card, labels)),
      data: JSON.stringify(widgetData(widgetView(state, words), labels)),
    });
    return true;
  } catch { return false; }
}
