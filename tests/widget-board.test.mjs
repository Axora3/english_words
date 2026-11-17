// Windows 11 Widgets Board tile: the card the page builds, and the service-worker side that pushes
// it. The real Widgets Board cannot be driven from here, so the service worker is loaded into a VM
// with a stub `self.widgets`, exactly like the service-worker tests in pwa.test.mjs.
import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {emptyState, ensureDay, markLearned} from '../core.js';
import {words} from '../words.js';
import {widgetView, widgetData, widgetTemplate, publishWidget, WIDGET_TAG} from '../widget-live.js';
import {shellFiles, renderServiceWorker} from '../tools/app-files.mjs';

const root = new URL('../', import.meta.url);
const rootPath = decodeURIComponent(root.pathname.replace(/^\/(\w:)/, '$1'));
const labels = {ready: 'NEW', waiting: 'NEXT', done: 'DONE', waitingSub: 'later', doneSub: 'finished',
  open: 'Open', review: 'Review', time: at => new Date(at).toISOString().slice(11, 16)};
const morning = new Date(2026, 10, 16, 9, 0, 0);

test('the card shows the unlocked word, then the next unlock time, then the finished state', () => {
  const state = emptyState();
  state.settings.startTime = '09:00';
  const day = ensureDay(state, words, morning);

  const ready = widgetData(widgetView(state, words, +morning), labels);
  assert.equal(ready.word, words.find(w => w.id === day.ids[0]).word);
  assert.match(ready.status, /NEW$/);
  assert.equal(ready.progress, '0/5');

  markLearned(state, day.ids[0], +morning);
  const waiting = widgetData(widgetView(state, words, +morning + 60000), labels);
  assert.equal(waiting.status, 'NEXT');
  assert.equal(waiting.translation, 'later');
  assert.equal(waiting.progress, '1/5');

  for (const id of day.ids) markLearned(state, id, +morning);
  const done = widgetData(widgetView(state, words, +morning + 60000), labels);
  assert.equal(done.status, 'DONE');
  assert.equal(done.progress, '5/5');
  assert.deepEqual(Object.keys(done).sort(), ['ipa', 'progress', 'status', 'translation', 'word']);
});

test('the shipped Adaptive Card is valid, binds every field and takes localised button titles', async () => {
  const card = JSON.parse(await readFile(new URL('widgets/daily-card.json', root), 'utf8'));
  assert.equal(card.type, 'AdaptiveCard');
  assert.ok(card.version);
  const text = JSON.stringify(card);
  for (const key of ['progress', 'status', 'word', 'ipa', 'translation']) assert.ok(text.includes('${' + key + '}'), key);
  const localised = widgetTemplate(card, {...labels, open: 'Нээх', review: 'Давтах'});
  assert.deepEqual(localised.actions.map(a => a.title), ['Нээх', 'Давтах']);
  assert.deepEqual(localised.actions.map(a => a.verb), ['open-primary', 'open-review']);
  assert.notEqual(JSON.stringify(card.actions), JSON.stringify(localised.actions), 'the shipped file is not mutated');
  const fallback = JSON.parse(await readFile(new URL('widgets/daily-data.json', root), 'utf8'));
  for (const key of ['progress', 'status', 'word', 'ipa', 'translation']) assert.equal(typeof fallback[key], 'string', key);
});

test('the page sends the finished card to the service worker; without one it just does nothing', async () => {
  const state = emptyState();
  const sent = [];
  const scope = {navigator: {serviceWorker: {ready: Promise.resolve({active: {postMessage: m => sent.push(m)}})}}};
  const card = JSON.parse(await readFile(new URL('widgets/daily-card.json', root), 'utf8'));
  globalThis.fetch = async () => ({json: async () => card});
  try {
    assert.equal(await publishWidget(state, words, labels, scope), true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].type, 'WIDGET_DATA');
    assert.equal(sent[0].tag, WIDGET_TAG);
    assert.equal(JSON.parse(sent[0].template).actions[0].title, 'Open');
    assert.equal(typeof JSON.parse(sent[0].data).word, 'string');
    assert.equal(await publishWidget(state, words, labels, {navigator: {}}), false, 'browsers without a worker are fine');
  } finally { delete globalThis.fetch; }
});

test('the service worker renders the widget from the app’s card and opens the right page on a tap', async () => {
  const files = await shellFiles(rootPath);
  const source = renderServiceWorker(await readFile(new URL('sw.js', root), 'utf8'),
    {version: 'test1', mode: 'production', files: [...files]});
  const handlers = {}, caches = new Map(), updates = [], opened = [];
  const cacheFor = name => {
    if (!caches.has(name)) caches.set(name, new Map());
    const store = caches.get(name);
    return {
      // A real Cache hands out a fresh Response every time; the stub stores the text and rebuilds one.
      async addAll() {}, async put(key, value) { store.set(typeof key === 'string' ? key : key.url, await value.text()); },
      async match(key) { const body = store.get(typeof key === 'string' ? key : key.url); return body === undefined ? undefined : new Response(body); },
    };
  };
  const self = {
    location: {origin: 'http://localhost'}, registration: {scope: 'http://localhost/', active: {}},
    clients: {claim: async () => {}, matchAll: async () => [], openWindow: async url => { opened.push(url); }},
    skipWaiting: async () => {}, addEventListener: (type, fn) => handlers[type] = fn,
    widgets: {
      updateByTag: async (tag, payload) => updates.push({tag, payload}),
      getByTag: async tag => ({definition: {tag, msAcTemplate: './widgets/daily-card.json', data: './widgets/daily-data.json'}}),
    },
  };
  const context = {self, caches: {open: async n => cacheFor(n), keys: async () => [...caches.keys()], delete: async k => caches.delete(k), match: async () => undefined},
    URL, Response, fetch: async url => new Response(JSON.stringify({from: String(url)}))};
  vm.runInNewContext(source, context);

  // Nothing stored yet: the files named in the manifest are used.
  let pending;
  const install = {widget: {definition: {tag: WIDGET_TAG, msAcTemplate: './widgets/daily-card.json', data: './widgets/daily-data.json'}}, waitUntil: p => pending = p};
  handlers.widgetinstall(install);
  await pending;
  assert.equal(updates.at(-1).tag, WIDGET_TAG);
  assert.ok(updates.at(-1).payload.template.includes('daily-card.json'), 'fell back to the shipped card');

  // Once the page has sent a card, that one is used — the worker cannot read localStorage itself.
  handlers.message({data: {type: 'WIDGET_DATA', tag: WIDGET_TAG, template: '{"type":"AdaptiveCard"}', data: '{"word":"hello"}'}, waitUntil: p => pending = p});
  await pending;
  assert.deepEqual(updates.at(-1).payload, {template: '{"type":"AdaptiveCard"}', data: '{"word":"hello"}'});
  handlers.widgetresume({widget: null, waitUntil: p => pending = p});
  await pending;
  assert.deepEqual(updates.at(-1).payload.data, '{"word":"hello"}', 'a resume redraws the stored card');

  handlers.widgetclick({action: 'open-review', waitUntil: p => pending = p});
  await pending;
  assert.equal(opened.at(-1), 'http://localhost/#review');
  handlers.widgetclick({action: 'open-primary', waitUntil: p => pending = p});
  await pending;
  assert.equal(opened.at(-1), 'http://localhost/#learn');

  // The widget cache survives a new version taking over, so the tile is never blank after an update.
  handlers.activate({waitUntil: p => pending = p});
  await pending;
  assert.ok(caches.has('english-words-widget'));
});
