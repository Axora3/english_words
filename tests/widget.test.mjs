import {test} from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {words} from '../words.js';
import {emptyState,ensureDay,nextWord,markLearned,dayKey} from '../core.js';
import {validBackup} from '../backup.js';
import {createWidgetModel} from '../widget-model.js';
import {buildWidgetScript} from '../widget-export.js';

const model=createWidgetModel();
const morning=new Date(2026,10,16,9,0,0);

test('widget schedule matches the app before/after unlock and across a new day',()=>{
  const state=emptyState();
  ensureDay(state,words,morning);
  assert.equal(model.view(state,words,new Date(+morning-1)).status,'waiting');
  assert.equal(model.view(state,words,morning).word.id,nextWord(state,state.days[dayKey(morning)],+morning).id);
  assert.equal(model.mark(state,words,'1',dayKey(morning),morning),true);
  assert.equal(model.mark(state,words,'1',dayKey(morning),morning),false);
  assert.equal(model.view(state,words,morning).status,'waiting');
  assert.equal(model.mark(state,words,'2',dayKey(morning),morning),false);
  assert.equal(model.view(state,words,new Date(+morning+600000)).word.id,'2');
  assert.equal(model.mark(state,words,'2','2026-11-15',new Date(+morning+600000)),false);
  const restored=JSON.parse(JSON.stringify(state));
  const tomorrow=new Date(2026,10,17,9);
  assert.equal(model.view(restored,words,tomorrow).word.id,'2');
  assert.equal(validBackup(restored),true);
});

test('widget completion and learned records remain compatible with app backups',()=>{
  const state=emptyState();ensureDay(state,words,morning);
  for(const id of state.days[dayKey(morning)].ids)markLearned(state,id,+morning);
  assert.equal(model.view(state,words,morning).status,'done');
  assert.equal(validBackup(state),true);
  assert.equal(model.valid({...state,settings:{...state.settings,startTime:'23:50'}},words),false);
  assert.equal(model.valid({...state,days:{x:{ids:['missing']}}},words),false);
});

test('export creates a self-contained script without mutating state or relying on localhost/network',()=>{
  const state=emptyState(),before=JSON.stringify(state),script=buildWidgetScript(state,morning);
  assert.equal(JSON.stringify(state),before);
  assert.ok(script.startsWith('// Variables used by Scriptable.'));
  assert.ok(script.includes('Script.setWidget'));
  assert.equal(/new Request\(|fetch\(|localhost:|import\s*[{(]/.test(script),false);
  assert.doesNotThrow(()=>new vm.Script(`(async()=>{${script}})()`));
  assert.throws(()=>buildWidgetScript({}),/invalid/);
});

function harness({family='medium',params={},cache,choices=[]}={}){
  const files=new Map(),widgets=[],spoken=[],alerts=[],exports=[];
  if(cache)files.set('/docs/EnglishWordsWidget/progress.json',JSON.stringify(cache));
  class Stack{
    constructor(){this.children=[];}
    addStack(){const stack=new Stack();this.children.push(stack);return stack;}
    addText(value){const text={value};this.children.push(text);return text;}
    addSpacer(){} layoutHorizontally(){} centerAlignContent(){} setPadding(){}
  }
  class Widget extends Stack{async presentMedium(){this.presented=true;}}
  class Alert{
    constructor(){this.actions=[];alerts.push(this);}
    addAction(value){this.actions.push(value);} addCancelAction(){}
    async presentAlert(){return choices.shift()??-1;}
    async presentSheet(){return choices.shift()??-1;}
  }
  const context=vm.createContext({
    FileManager:{local:()=>({joinPath:(a,b)=>a+'/'+b,documentsDirectory:()=>'/docs',fileExists:path=>path==='/docs/EnglishWordsWidget'||files.has(path),createDirectory(){},readString:path=>files.get(path),writeString:(path,value)=>files.set(path,value)})},
    ListWidget:Widget,Color:class{constructor(hex){this.hex=hex;}},Font:{boldSystemFont:size=>({size}),systemFont:size=>({size})},
    URLScheme:{forRunningScript:()=> 'scriptable:///run/English%20Words?scriptName=English%20Words'},
    Speech:{speak:async value=>spoken.push(value)},DocumentPicker:{exportString:async(content,name)=>exports.push({content,name})},
    Script:{setWidget:widget=>widgets.push(widget),complete(){}},Alert,
    config:{runsInWidget:!params.action&&choices.length===0,widgetFamily:family},args:{queryParameters:params},console,
  });
  return {context,files,widgets,spoken,alerts,exports};
}

test('generated small and medium scripts render in a controlled Scriptable API harness',async()=>{
  for(const family of ['small','medium']){
    const h=harness({family});const script=buildWidgetScript(emptyState());
    await vm.runInContext(`(async()=>{${script}})()`,h.context);
    assert.equal(h.widgets.length,1);
    assert.ok(h.widgets[0].url.startsWith('scriptable:///run/'));
    assert.ok(Number.isFinite(h.widgets[0].refreshAfterDate.getTime()));
    const stored=JSON.parse(h.files.get('/docs/EnglishWordsWidget/progress.json'));
    assert.equal(validBackup(stored.state),true);
  }
});

test('widget tap actions speak, mark only the due word and export a valid manual-sync backup',async()=>{
  const now=new Date(),state=emptyState();state.settings.startTime='00:00';state.settings.interval=1;
  ensureDay(state,words,now);
  const script=buildWidgetScript(state,now);
  const speak=harness({params:{action:'speak',id:'1'}});
  await vm.runInContext(`(async()=>{${script}})()`,speak.context);
  assert.deepEqual(speak.spoken,['serendipity']);
  const learn=harness({params:{action:'learn',id:'1',day:dayKey(now)}});
  await vm.runInContext(`(async()=>{${script}})()`,learn.context);
  const cache=JSON.parse(learn.files.get('/docs/EnglishWordsWidget/progress.json'));
  assert.ok(cache.state.learned['1']);assert.equal(validBackup(cache.state),true);
  const backup=harness({cache,choices:[model.view(cache.state,words).word?3:1]});
  await vm.runInContext(`(async()=>{${script}})()`,backup.context);
  assert.equal(backup.exports.length,1);
  assert.equal(validBackup(JSON.parse(backup.exports[0].content)),true);
});

test('a new export never silently overwrites widget progress during a background refresh',async()=>{
  const state=emptyState();markLearned(state,'1');
  const cache={exportId:'older',state};const h=harness({cache});
  await vm.runInContext(`(async()=>{${buildWidgetScript(emptyState())}})()`,h.context);
  const saved=JSON.parse(h.files.get('/docs/EnglishWordsWidget/progress.json'));
  assert.ok(saved.state.learned['1']);assert.equal(h.alerts.length,0);
});

test('keeping an existing widget snapshot acknowledges the update and preserves progress',async()=>{
  const state=emptyState();markLearned(state,'1');
  const h=harness({cache:{exportId:'older',state},params:{action:'menu'},choices:[-1,-1]});
  const script=buildWidgetScript(emptyState());
  await vm.runInContext(`(async()=>{${script}})()`,h.context);
  const saved=JSON.parse(h.files.get('/docs/EnglishWordsWidget/progress.json'));
  assert.ok(saved.state.learned['1']);assert.notEqual(saved.seenExportId,'older');
  const second=harness({cache:saved,params:{action:'menu'},choices:[-1]});
  await vm.runInContext(`(async()=>{${script}})()`,second.context);
  assert.equal(second.alerts.length,1); // Only the normal menu, no repeated update prompt.
});
