import {vocabulary} from './vocabulary.js';
import {validBackup} from './backup.js';
import {createWidgetModel} from './widget-model.js';
import {runScriptableWidget} from './widget-runtime.js';

export function buildWidgetScript(state, now = new Date()) {
  if (!validBackup(state)) throw Error('Cannot export invalid learning data.');
  const seed = {
    exportId:now.toISOString(),
    state:JSON.parse(JSON.stringify(state)),
    words:vocabulary(state).map(({id,word,translation,ipa,level})=>({id,word,translation,ipa,level})),
  };
  return `// Variables used by Scriptable.\n// icon-color: deep-purple; icon-glyph: book;\n// English Words: offline iPhone Home Screen widget.\n// No network requests. Progress is synced manually with JSON backups.\nconst seed = ${JSON.stringify(seed)};\nconst createWidgetModel = ${createWidgetModel.toString()};\nawait (${runScriptableWidget.toString()})(seed, createWidgetModel());\n`;
}
