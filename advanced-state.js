import {baseWords} from './words.js';
import {validWord,normalizeWord,newId} from './vocabulary.js';
export const goalDefaults={dailyNew:5,dailyReview:10,dailyQuiz:1,weeklyWords:25,weeklyMinutes:60};
export function migrateAdvanced(state){if(!state.advanced)state.advanced={version:1,customWords:[],collections:[],practice:[],writing:[],speaking:[],time:[],goals:{...goalDefaults,dailyNew:state.settings.dailyTarget},achievements:{},challenges:{},mistakes:[],searchHistory:[],recentWords:[],reminders:{challenge:false,weekly:false,grammar:false,challengeTime:'18:00',weeklyTime:'19:00',grammarTime:'10:00'}};compactTime(state.advanced);return state.advanced;}
export function validAdvanced(a){
 if(a===undefined)return true;if(!a||a.version!==1)return false;
 if(!Array.isArray(a.customWords)||a.customWords.length>5000||!a.customWords.every(validWord)||new Set(a.customWords.map(w=>w.id)).size!==a.customWords.length||new Set([...baseWords,...a.customWords].map(w=>normalizeWord(w.word))).size!==baseWords.length+a.customWords.length)return false;
 const known=new Set([...baseWords,...a.customWords].map(w=>w.id)),finite=n=>Number.isFinite(n)&&n>=0,short=x=>typeof x==='string'&&x.length<=2000,record=x=>x&&typeof x==='object'&&!Array.isArray(x);
 if(!Array.isArray(a.collections)||a.collections.length>500||!a.collections.every(c=>c&&/^collection-[\w-]+$/.test(c.id)&&short(c.name)&&c.name.trim()&&c.name.length<=80&&short(c.description)&&['book','briefcase','code','graduation','chat','star'].includes(c.icon)&&Array.isArray(c.wordIds)&&new Set(c.wordIds).size===c.wordIds.length&&c.wordIds.every(id=>known.has(id))))return false;
 if(new Set(a.collections.map(c=>c.id)).size!==a.collections.length)return false;
 for(const key of ['practice','writing','speaking','time','mistakes','searchHistory','recentWords'])if(!Array.isArray(a[key]))return false;
 if(!a.practice.every(x=>x&&short(x.id)&&short(x.mode)&&known.has(x.wordId)||false))return false;
 if(!a.practice.every(x=>finite(x.at)&&typeof x.correct==='boolean'&&short(x.answer)&&short(x.expected)&&short(x.questionId)))return false;
 if(!a.writing.every(x=>x&&short(x.id)&&known.has(x.wordId)&&Array.isArray(x.versions)&&x.versions.length<=100&&x.versions.every(v=>v&&short(v.text)&&finite(v.at))&&(x.completedAt===null||finite(x.completedAt))))return false;
 if(!a.speaking.every(x=>x&&short(x.id)&&known.has(x.wordId)&&finite(x.at)&&typeof x.matched==='boolean'))return false;
 if(!a.time.every(x=>x&&short(x.id)&&finite(x.at)&&short(x.section)&&finite(x.seconds)&&x.seconds<=86400))return false;
 if(!record(a.goals)||!Object.entries(goalDefaults).every(([key])=>Number.isInteger(a.goals[key])&&a.goals[key]>=1&&a.goals[key]<=(key==='weeklyMinutes'?10080:1000)))return false;
 if(!record(a.achievements)||!Object.values(a.achievements).every(finite)||!record(a.challenges)||!Object.entries(a.challenges).every(([key,c])=>/^\d{4}-\d{2}-\d{2}$/.test(key)&&c&&['learn','review','quiz','grammar','listening','writing','phrases'].includes(c.kind)&&Number.isInteger(c.target)&&c.target>=1&&c.target<=20&&(c.claimedAt===null||finite(c.claimedAt))&&c.points===10))return false;
 if(!a.mistakes.every(x=>x&&short(x.id)&&short(x.sourceId)&&finite(x.at)&&['tenses','articles','prepositions','agreement','order','usage','spelling'].includes(x.category)&&short(x.detail)))return false;
 if(!a.searchHistory.every(x=>typeof x==='string'&&x.length<=100)||!a.recentWords.every(id=>known.has(id)))return false;
 const r=a.reminders;if(!record(r)||!['challenge','weekly','grammar'].every(k=>typeof r[k]==='boolean'&&/^([01]\d|2[0-3]):[0-5]\d$/.test(r[k+'Time'])))return false;
 for(const key of ['practice','writing','speaking','time','mistakes'])if(new Set(a[key].map(x=>x.id)).size!==a[key].length)return false;
 return true;
}

const localDay=at=>{const d=new Date(at);return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;};
/** Merges study-time samples into one record per local day and section. Totals are preserved. */
export function compactTime(advanced){
 const merged=new Map();
 for(const x of advanced.time){const key=localDay(x.at)+'|'+x.section,m=merged.get(key);if(m){m.seconds=Math.min(86400,m.seconds+x.seconds);m.at=Math.max(m.at,x.at);}else merged.set(key,{...x});}
 if(merged.size!==advanced.time.length)advanced.time=[...merged.values()];
 return advanced.time;
}
/** Adds active study seconds to today's record for a section (one record per day and section). */
export function recordStudyTime(state,section,seconds,now=Date.now()){
 const day=localDay(now),existing=state.advanced.time.find(x=>x.section===section&&localDay(x.at)===day);
 if(existing){existing.seconds=Math.min(86400,existing.seconds+seconds);existing.at=now;}
 else state.advanced.time.push({id:newId('time'),at:now,section,seconds});
}
