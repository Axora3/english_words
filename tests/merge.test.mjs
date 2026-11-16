import test from 'node:test';import assert from 'node:assert/strict';
import {emptyState,markLearned,reviewWord} from '../core.js';
import {migrateAdvanced,recordStudyTime} from '../advanced-state.js';
import {saveCollection,collectionWord} from '../collections.js';
import {mergeStates,stateSummary,hasLearningData} from '../merge.js';
import {validBackup} from '../backup.js';
import {createWord} from '../vocabulary.js';

const at=new Date(2026,10,17,9).getTime();
const fresh=()=>{const s=emptyState();migrateAdvanced(s);return s;};
const copy=x=>JSON.parse(JSON.stringify(x));

test('independent progress from two devices is combined without loss',()=>{
 const base=fresh();const a=copy(base),b=copy(base);
 markLearned(a,'1',at);reviewWord(a,'1',true,at+1000);a.favorites.push('1');recordStudyTime(a,'learn',30,at);
 markLearned(b,'2',at+5);reviewWord(b,'2',false,at+2000);b.difficult.push('2');recordStudyTime(b,'learn',45,at+10);
 const m=mergeStates(base,a,b);
 assert.deepEqual(Object.keys(m.learned).sort(),['1','2']);assert.equal(m.reviews.length,2);assert.deepEqual(m.favorites,['1']);assert.deepEqual(m.difficult,['2']);
 assert.equal(m.advanced.time.reduce((n,x)=>n+x.seconds,0),75,'study time from both devices is summed');assert.ok(validBackup(m));
});
test('deletions are honoured three-way and not resurrected',()=>{
 const base=fresh();base.favorites=['1','2'];const a=copy(base),b=copy(base);
 a.favorites=['2'];        // unfavourited '1' on this device
 b.favorites=['1','2','3'];// other device added '3'
 assert.deepEqual(mergeStates(base,a,b).favorites.sort(),['2','3']);
});
test('settings: the side that changed wins; both changed → this device',()=>{
 const base=fresh();const a=copy(base),b=copy(base);
 a.settings.theme='light';b.settings.language='en';
 let m=mergeStates(base,a,b);assert.equal(m.settings.theme,'light');assert.equal(m.settings.language,'en');
 b.settings.theme='dark';a.settings.dailyTarget=7;b.settings.dailyTarget=9;
 m=mergeStates(base,a,b);assert.equal(m.settings.dailyTarget,7);
});
test('a word reviewed on both devices keeps the most recent review outcome',()=>{
 const base=fresh();markLearned(base,'1',at);const a=copy(base),b=copy(base);
 reviewWord(a,'1',true,at+1000);reviewWord(b,'1',false,at+5000);
 const m=mergeStates(base,a,b);assert.equal(m.learned['1'].stage,0);assert.equal(m.learned['1'].dueAt,b.learned['1'].dueAt);assert.equal(m.reviews.length,2);
});
test('remote-only changes are adopted when this device has no changes',()=>{
 const base=fresh();const remote=copy(base);markLearned(remote,'3',at);remote.settings.compact=true;
 const m=mergeStates(base,copy(base),remote);assert.ok(m.learned['3']);assert.equal(m.settings.compact,true);
});
test('collections merge membership; a deleted collection stays deleted unless edited elsewhere',()=>{
 const base=fresh();const c=saveCollection(base,{name:'Work',icon:'book'});collectionWord(base,c.id,'1');
 const a=copy(base),b=copy(base);collectionWord(a,c.id,'2');collectionWord(b,c.id,'3');
 let m=mergeStates(base,a,b);assert.deepEqual(m.advanced.collections[0].wordIds.sort(),['1','2','3']);
 const del=copy(base);del.advanced.collections=[];m=mergeStates(base,del,copy(base));assert.equal(m.advanced.collections.length,0);
});
test('grammar completion and achievements keep the earliest date; challenge claims are not duplicated',()=>{
 const base=fresh();const a=copy(base),b=copy(base);
 a.grammar={startedOn:'2026-11-10',completed:{'a1-01':{at:at+50}},attempts:{}};b.grammar={startedOn:'2026-11-03',completed:{'a1-01':{at:at}},attempts:{}};
 a.advanced.achievements={'words-1':at+10};b.advanced.achievements={'words-1':at};
 a.advanced.challenges={'2026-11-17':{kind:'learn',target:5,points:10,claimedAt:at+100}};b.advanced.challenges={'2026-11-17':{kind:'learn',target:5,points:10,claimedAt:null}};
 const m=mergeStates(base,a,b);assert.equal(m.grammar.startedOn,'2026-11-03');assert.equal(m.grammar.completed['a1-01'].at,at);assert.equal(m.advanced.achievements['words-1'],at);assert.equal(m.advanced.challenges['2026-11-17'].claimedAt,at+100);
});
test('the same custom word imported on two devices is de-duplicated and references are remapped',()=>{
 const base=fresh();const a=copy(base),b=copy(base);
 const wa=createWord({word:'Wanderlust',meaning:'аялах хүсэл'}),wb=createWord({word:'wanderlust',meaning:'аялах хүсэл'});
 a.advanced.customWords.push(wa);b.advanced.customWords.push(wb);b.favorites.push(wb.id);markLearned(b,wb.id,at);
 const m=mergeStates(base,a,b);assert.equal(m.advanced.customWords.length,1);assert.deepEqual(m.favorites,[wa.id]);assert.ok(m.learned[wa.id]);assert.ok(validBackup(m));
});
test('first sync with no shared history unions both devices',()=>{
 const a=fresh(),b=fresh();markLearned(a,'1',at);markLearned(b,'2',at);
 const m=mergeStates(null,a,b);assert.equal(stateSummary(m).learned,2);assert.equal(hasLearningData(fresh()),false);assert.equal(hasLearningData(m),true);
});
test('merging never yields an invalid state',()=>{
 const a=fresh();const bad=copy(a);bad.learned={'not-a-word':{learnedAt:at,dueAt:at,stage:0}};
 assert.throws(()=>mergeStates(a,a,bad),/validation/);
});
