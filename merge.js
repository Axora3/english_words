// Three-way merge of English Words learning states (base = last synced copy, local = this device,
// remote = cloud). Pure and deterministic so it can be unit-tested. Rules:
// - Append-only logs (reviews, tests, practice, speaking, mistakes, writing versions, notifications) are unioned.
// - Sets (favorites, difficult, collection members) are merged three-way so deletions are honoured.
// - Scalars and records (settings, goals, schedules, collection details) take the side that changed;
//   when both changed, this device wins.
// - A learned word changed on both sides keeps the side whose latest review happened last.
// The result is validated with the same validator as backups; invalid merges throw.
import {emptyState} from './core.js';
import {migrateAdvanced,compactTime} from './advanced-state.js';
import {normalizeWord} from './vocabulary.js';
import {validBackup} from './backup.js';

const clone=x=>x===undefined?undefined:JSON.parse(JSON.stringify(x));
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
const has=(o,k)=>Boolean(o)&&Object.prototype.hasOwnProperty.call(o,k);
export class MergeError extends Error{}

/** Value merge: whoever changed relative to base wins; both changed → local. */
function pick(b,l,r){if(same(l,r)||!same(l,b))return clone(l);return clone(r);}
/** Three-way set merge preserving local order then remote additions. */
function mergeSet(b=[],l=[],r=[]){const B=new Set(b),L=new Set(l),R=new Set(r),out=[];for(const x of [...l,...r]){if(out.includes(x))continue;if((L.has(x)&&R.has(x))||(L.has(x)&&!B.has(x))||(R.has(x)&&!B.has(x)))out.push(x);}return out;}
/** Three-way keyed-object merge with deletions. */
function mergeMap(b={},l={},r={},value=pick){const out={};for(const k of new Set([...Object.keys(l),...Object.keys(r)])){const inL=has(l,k),inR=has(r,k),inB=has(b,k);
 if(inL&&inR)out[k]=value(b?.[k],l[k],r[k],k);
 else if(inL){if(!inB||!same(l[k],b[k]))out[k]=clone(l[k]);}   // added locally, or changed locally while deleted remotely
 else if(inR){if(!inB||!same(r[k],b[k]))out[k]=clone(r[k]);}}
 return out;}
const fieldwise=(b,l,r)=>{const o={};for(const k of new Set([...Object.keys(l||{}),...Object.keys(r||{})]))o[k]=pick(b?.[k],l?.[k],r?.[k]);return o;};
function union(lists,key,combine=(a)=>a){const map=new Map();for(const list of lists)for(const x of list||[]){const k=key(x);map.set(k,map.has(k)?combine(map.get(k),x):clone(x));}return [...map.values()];}
const listMap=(b,l,r,key)=>{const toMap=list=>Object.fromEntries((list||[]).map(x=>[key(x),x]));return [toMap(b),toMap(l),toMap(r)];};

function normalize(state){const s={...emptyState(),...clone(state)};migrateAdvanced(s);return s;}
const lastReview=(state,id)=>Math.max(0,...state.reviews.filter(x=>x.id===id).map(x=>x.at));

export function mergeStates(baseState,localState,remoteState){
 const b=normalize(baseState||emptyState()),l=normalize(localState),r=normalize(remoteState);
 const out=emptyState();migrateAdvanced(out);
 out.version=1;out.designVersion=Math.max(l.designVersion||0,r.designVersion||0)||undefined;
 out.settings=fieldwise(b.settings,l.settings,r.settings);
 out.learned=mergeMap(b.learned,l.learned,r.learned,(bv,lv,rv,id)=>{if(same(lv,rv)||!same(lv,bv)&&same(rv,bv))return clone(lv);if(same(lv,bv))return clone(rv);return clone(lastReview(l,id)>=lastReview(r,id)?lv:rv);});
 out.favorites=mergeSet(b.favorites,l.favorites,r.favorites);
 out.difficult=mergeSet(b.difficult,l.difficult,r.difficult);
 out.days=mergeMap(b.days,l.days,r.days);
 out.reviews=union([l.reviews,r.reviews],x=>`${x.id}|${x.at}|${x.correct}`).sort((x,y)=>x.at-y.at);
 out.tests=union([l.tests,r.tests],x=>`${x.startedAt}|${x.finishedAt}`).sort((x,y)=>x.finishedAt-y.finishedAt);
 out.notified=[...new Set([...l.notified,...r.notified])];
 out.activeTest=pick(b.activeTest,l.activeTest,r.activeTest);
 if(out.activeTest&&out.tests.some(t=>t.startedAt===out.activeTest.startedAt))out.activeTest=null; // finished elsewhere
 if(!l.grammar||!r.grammar)out.grammar=clone(l.grammar||r.grammar||null);
 else out.grammar={startedOn:l.grammar.startedOn<r.grammar.startedOn?l.grammar.startedOn:r.grammar.startedOn,
  completed:union([Object.entries(l.grammar.completed),Object.entries(r.grammar.completed)],([k])=>k,(a,c)=>a[1].at<=c[1].at?a:c).reduce((o,[k,v])=>(o[k]=v,o),{}),
  attempts:mergeMap(b.grammar?.attempts,l.grammar.attempts,r.grammar.attempts,(bv,lv,rv)=>clone(lv.at>=rv.at?lv:rv))};
 // ---- advanced records ----
 const A=out.advanced,bl=b.advanced,la=l.advanced,ra=r.advanced;
 A.customWords=union([la.customWords,ra.customWords],w=>w.id);
 const byWord=new Map(),remap={};for(const w of A.customWords){const k=normalizeWord(w.word);if(byWord.has(k))remap[w.id]=byWord.get(k);else byWord.set(k,w.id);}
 A.customWords=A.customWords.filter(w=>!remap[w.id]);
 const [cb,cl,cr]=listMap(bl.collections,la.collections,ra.collections,c=>c.id);
 A.collections=Object.values(mergeMap(cb,cl,cr,(bv,lv,rv)=>({...fieldwise(bv,lv,rv),wordIds:mergeSet(bv?.wordIds,lv.wordIds,rv.wordIds)})));
 A.practice=union([la.practice,ra.practice],x=>x.id).sort((x,y)=>x.at-y.at);
 A.speaking=union([la.speaking,ra.speaking],x=>x.id).sort((x,y)=>x.at-y.at);
 A.mistakes=union([la.mistakes,ra.mistakes],x=>x.id).sort((x,y)=>x.at-y.at);
 A.writing=union([la.writing,ra.writing],x=>x.id,(a,c)=>({...a,versions:union([a.versions,c.versions],v=>`${v.at}|${v.text}`).sort((x,y)=>x.at-y.at).slice(-100),completedAt:[a.completedAt,c.completedAt].filter(v=>v!==null).sort((x,y)=>x-y)[0]??null}));
 A.time=union([la.time,ra.time],x=>x.id,(a,c)=>({...a,seconds:Math.max(a.seconds,c.seconds),at:Math.max(a.at,c.at)}));compactTime(A);
 A.goals=fieldwise(bl.goals,la.goals,ra.goals);
 A.reminders=fieldwise(bl.reminders,la.reminders,ra.reminders);
 A.achievements={...ra.achievements};for(const [k,v] of Object.entries(la.achievements))A.achievements[k]=has(A.achievements,k)?Math.min(A.achievements[k],v):v;
 A.challenges={...clone(ra.challenges)};for(const [k,v] of Object.entries(la.challenges)){const o=A.challenges[k];A.challenges[k]=!o||(v.claimedAt!==null&&(o.claimedAt===null||v.claimedAt<o.claimedAt))?clone(v):o;}
 A.searchHistory=[...new Set([...la.searchHistory,...ra.searchHistory])].slice(0,12);
 A.recentWords=[...new Set([...la.recentWords,...ra.recentWords])].slice(0,12);
 // ---- remap duplicate custom words (same word imported on two devices) ----
 let merged=out;
 if(Object.keys(remap).length){let json=JSON.stringify(out);for(const [from,to] of Object.entries(remap))json=json.split(`"${from}"`).join(`"${to}"`);merged=JSON.parse(json);
  const uniq=a=>[...new Set(a)];merged.favorites=uniq(merged.favorites);merged.difficult=uniq(merged.difficult);merged.advanced.recentWords=uniq(merged.advanced.recentWords);
  for(const c of merged.advanced.collections)c.wordIds=uniq(c.wordIds);for(const d of Object.values(merged.days))d.ids=uniq(d.ids);}
 if(merged.designVersion===undefined)delete merged.designVersion;
 if(!validBackup(merged))throw new MergeError('Merged state failed validation');
 return merged;
}

/** Small summary used for migration previews and verification. */
export function stateSummary(state){const s=normalize(state||emptyState()),a=s.advanced;return {learned:Object.keys(s.learned).length,reviews:s.reviews.length,tests:s.tests.length,favorites:s.favorites.length,grammar:Object.keys(s.grammar?.completed||{}).length,collections:a.collections.length,customWords:a.customWords.length,practice:a.practice.length+a.writing.length+a.speaking.length};}
export function hasLearningData(state){const x=stateSummary(state);return Object.values(x).some(Boolean)||Boolean(state?.grammar);}
