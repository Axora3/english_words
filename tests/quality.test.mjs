// Regression tests for the codebase audit: data integrity, security escaping, localization coverage.
import test from 'node:test';import assert from 'node:assert/strict';import {readFile,readdir} from 'node:fs/promises';
import {emptyState,markLearned,dayKey,notificationEvents,ensureDay,pruneNotified,reviewWord} from '../core.js';
import {migrateAdvanced,compactTime,recordStudyTime} from '../advanced-state.js';
import {validBackup} from '../backup.js';
import {words} from '../words.js';
import {learningAnalytics} from '../analytics.js';
import {activityDays} from '../calendar.js';
import {updateAchievements} from '../achievements.js';
import {previewVocabulary,mergeVocabulary} from '../vocabulary-import.js';
import {searchDictionary} from '../dictionary.js';
import {dictionaries} from '../i18n.js';
import {uiLabels} from '../labels.js';
import {button,iconButton,esc} from '../ui.js';

const fresh=()=>{const s=emptyState();migrateAdvanced(s);return s;};
const at=new Date(2026,10,17,10,0).getTime();

test('study time is stored as one record per day and section, preserving totals',()=>{
 const s=fresh();for(let i=0;i<40;i++)recordStudyTime(s,'learn',15,at+i*15000);recordStudyTime(s,'review',15,at);recordStudyTime(s,'learn',15,at+86400000);
 assert.equal(s.advanced.time.length,3);assert.equal(s.advanced.time.find(x=>x.section==='learn'&&dayKey(new Date(x.at))===dayKey(new Date(at))).seconds,600);
 assert.equal(activityDays(s)[dayKey(new Date(at))].seconds,615);assert.ok(validBackup(s));
});
test('legacy per-sample time records are compacted on migration without losing seconds',()=>{
 const s=fresh();s.advanced.time=Array.from({length:120},(_,i)=>({id:'t'+i,at:at+i*15000,section:i%2?'learn':'practice',seconds:15}));
 const before=learningAnalytics(s).seconds;compactTime(s.advanced);assert.equal(s.advanced.time.length,2);assert.equal(learningAnalytics(s).seconds,before);assert.ok(validBackup(s));
 s.advanced.time[0].seconds=-1;assert.equal(validBackup(s),false);
});
test('delivered-notification keys older than yesterday are pruned; recent ones still deduplicate',()=>{
 const s=fresh();const today=new Date(at),yesterday=new Date(at-86400000),old=new Date(at-5*86400000);
 s.notified=[`${dayKey(old)}:review`,`advanced:${dayKey(old)}:weekly`,`${dayKey(yesterday)}:test`,`${dayKey(today)}:review`,'legacy-key'];
 pruneNotified(s,today);assert.deepEqual(s.notified,[`${dayKey(yesterday)}:test`,`${dayKey(today)}:review`,'legacy-key']);
 s.settings.notifications=true;markLearned(s,'1',at-3600000);const day=ensureDay(s,words,today);const reviewAt=new Date(today);reviewAt.setHours(14,0,0,0);
 assert.ok(notificationEvents(s,day,reviewAt.getTime()+1000).some(e=>e.type==='review')===false,'review key for today is already delivered');
});
test('version-1 backups without advanced data or design version stay importable',()=>{
 const legacy=emptyState();markLearned(legacy,'1',at);reviewWord(legacy,'1',true,at+1000);legacy.favorites=['1'];
 const json=JSON.parse(JSON.stringify(legacy));assert.equal(json.advanced,undefined);assert.ok(validBackup(json));
 migrateAdvanced(json);assert.ok(validBackup(json));assert.equal(json.learned['1'].stage,1);assert.deepEqual(json.favorites,['1']);
});
test('exported backups round-trip and corrupted backups are rejected',()=>{
 const s=fresh();markLearned(s,'2',at);recordStudyTime(s,'learn',30,at);const copy=JSON.parse(JSON.stringify(s));assert.ok(validBackup(copy));assert.deepEqual(copy,s);
 assert.throws(()=>JSON.parse('{"version":1,'));
 assert.equal(validBackup({...copy,version:2}),false);
 assert.equal(validBackup({...copy,learned:{'no-such-word':{learnedAt:at,dueAt:at,stage:0}}}),false);
 assert.equal(validBackup({...copy,favorites:['1','1']}),false);
 assert.equal(validBackup({...copy,settings:{...copy.settings,theme:'neon'}}),false);
});
test('CSV preview flags duplicates and invalid rows; merge adds only new words',async()=>{
 const s=fresh();const csv=await readFile(new URL('./fixtures/redesign-preview.csv',import.meta.url),'utf8');
 const preview=previewVocabulary(s,csv+'\nnewword,шинэ үг,A2,noun','csv');assert.deepEqual(preview.map(r=>r.status),['duplicates','invalidRows','validRows']);
 const added=mergeVocabulary(s,preview);assert.equal(added.length,1);assert.equal(searchDictionary(s,'шинэ үг')[0].word,'newword');
 assert.equal(mergeVocabulary(s,previewVocabulary(s,'word,meaning\nnewword,again','csv')).length,0,'re-import does not duplicate');
});
test('achievements are earned once and keep their first unlock date',()=>{
 const s=fresh();markLearned(s,'1',at);const first=updateAchievements(s);assert.ok(first.some(b=>b.id==='words-1'));
 assert.equal(updateAchievements(s).length,0);assert.equal(s.advanced.achievements['words-1'],at);
});
test('component helpers escape attribute values from user or backup data',()=>{
 const evil='x" onmouseover="alert(1)';
 for(const html of [button('ok',{action:evil}),button('ok',{href:evil}),iconButton('x','label"<',{action:evil})]){assert.ok(!html.includes('" onmouseover="'),html);assert.ok(html.includes('&quot;'));}
 assert.equal(esc(`<img src=x onerror="a">'`),'&lt;img src=x onerror=&quot;a&quot;&gt;&#39;');
});
test('custom words with markup are escaped in vocabulary rows',async()=>{
 const {vocabRow}=await import('../word-ui.js');const s=fresh();
 const w={id:'custom-x',word:'<b>bold</b>',translation:'<script>x</script>',ipa:'"/>',pos:'noun',level:'A1',synonyms:[],antonyms:[],example:'',exampleMn:'',usage:'',usageMn:''};
 const html=vocabRow(w,s,{t:k=>k});assert.ok(!html.includes('<script>'));assert.ok(!html.includes('<b>bold'));assert.ok(html.includes('&lt;b&gt;bold'));
});
test('every literal interface key used by the UI exists in both languages',async()=>{
 const dir=new URL('../',import.meta.url),files=(await readdir(dir)).filter(f=>f.endsWith('.js')&&!['i18n.js','platform-i18n.js','widget-runtime.js'].includes(f));
 const tKeys=new Set(),uKeys=new Set();
 for(const f of files){const src=await readFile(new URL(f,dir),'utf8');
  for(const m of src.matchAll(/(?:\bt|this\.t|p\.t|this\.p\.t)\('([\w.]+)'\)/g))tKeys.add(m[1]);
  for(const m of src.matchAll(/\b(?:L|this\.L)\('(\w+)'\)/g))uKeys.add(m[1]);
  for(const m of src.matchAll(/\bu\((?:state|s|this\.state|p\.state|this\.p\.state),'(\w+)'\)/g))uKeys.add(m[1]);}
 const missingT=[...tKeys].filter(k=>!(k in dictionaries.en)||!(k in dictionaries.mn));
 const missingU=[...uKeys].filter(k=>!Array.isArray(uiLabels[k])||uiLabels[k].length!==2||!uiLabels[k].every(v=>typeof v==='string'&&v.trim()));
 assert.deepEqual(missingT,[],'t() keys missing from i18n');assert.deepEqual(missingU,[],'u()/L() keys missing from labels.js');
 assert.ok(tKeys.size>150&&uKeys.size>60,'scanner found the UI keys');
});
