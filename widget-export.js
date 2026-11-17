import {vocabulary} from './vocabulary.js';
import {validBackup} from './backup.js';
import {createWidgetModel} from './widget-model.js';
import {runScriptableWidget} from './widget-runtime.js';

/** Words carried in the exported script beyond the ones the state already refers to: enough for the
 *  widget to schedule new days on its own for weeks, without pasting the whole vocabulary (thousands
 *  of words) into Scriptable. Re-export whenever the pool runs low — the app says so on the page. */
const WIDGET_POOL = 150;

export function buildWidgetScript(state, now = new Date()) {
  if (!validBackup(state)) throw Error('Cannot export invalid learning data.');
  const bank = vocabulary(state);
  const needed = new Set([...Object.keys(state.learned), ...Object.values(state.days).flatMap(day => day.ids)]);
  for (const word of bank.filter(w => !state.learned[w.id]).slice(0, WIDGET_POOL)) needed.add(word.id);
  const seed = {
    exportId:now.toISOString(),
    state:JSON.parse(JSON.stringify(state)),
    words:bank.filter(w=>needed.has(w.id)).map(({id,word,translation,ipa,level})=>({id,word,translation,ipa,level})),
  };
  return `// Variables used by Scriptable.\n// icon-color: deep-purple; icon-glyph: book;\n// English Words: offline iPhone Home Screen widget.\n// No network requests. Progress is synced manually with JSON backups.\nconst seed = ${JSON.stringify(seed)};\nconst createWidgetModel = ${createWidgetModel.toString()};\nawait (${runScriptableWidget.toString()})(seed, createWidgetModel());\n`;
}
