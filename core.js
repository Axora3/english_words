export const defaults={language:'mn',theme:'dark',dailyTarget:5,startTime:'09:00',interval:10,reviewTime:'14:00',testTime:'20:00',notifications:false,newNotifications:true,reviewNotifications:true,testNotifications:true,sound:false,vibration:false,autoSpeak:false,compact:false};
export const emptyState=()=>({version:1,settings:{...defaults},learned:{},favorites:[],difficult:[],days:{},reviews:[],tests:[],notified:[],activeTest:null,grammar:null});
export const dayKey=(date=new Date())=>`${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
export function atTime(date,time){const d=new Date(date);const [h,m]=time.split(':').map(Number);d.setHours(h,m,0,0);return d.getTime();}
export function ensureDay(state,words,now=new Date()){
 const key=dayKey(now);if(!state.days[key]){const available=words.filter(w=>!state.learned[w.id]);state.days[key]={ids:available.slice(0,state.settings.dailyTarget).map(w=>w.id),start:atTime(now,state.settings.startTime),interval:state.settings.interval};}return state.days[key];
}
export const schedule=(day)=>day.ids.map((id,i)=>({id,at:day.start+i*day.interval*60000}));
export function nextWord(state,day,now=Date.now()){return schedule(day).find(x=>!state.learned[x.id]&&x.at<=now)||null;}
export function markLearned(state,id,now=Date.now()){if(state.learned[id])return;state.learned[id]={learnedAt:now,dueAt:now,stage:0};}
export function dueWords(state,now=Date.now()){return Object.keys(state.learned).filter(id=>state.learned[id].dueAt<=now);}
export function reviewWord(state,id,correct,now=Date.now()){const item=state.learned[id];if(!item)return;item.stage=correct?Math.min(item.stage+1,6):0;item.dueAt=now+(correct?[0,1,3,7,14,30,60][item.stage]*86400000:600000);state.reviews.push({id,correct,at:now});}
export function streak(state,now=new Date()){let n=0;const dates=new Set(Object.values(state.learned).map(v=>dayKey(new Date(v.learnedAt))));const d=new Date(now);if(!dates.has(dayKey(d)))d.setDate(d.getDate()-1);while(dates.has(dayKey(d))){n++;d.setDate(d.getDate()-1);}return n;}
export function validateSettings(s){return ['mn','en'].includes(s.language)&&['light','dark'].includes(s.theme)&&Number.isInteger(s.dailyTarget)&&s.dailyTarget>=1&&s.dailyTarget<=20&&Number.isInteger(s.interval)&&s.interval>=1&&s.interval<=180&&['startTime','reviewTime','testTime'].every(k=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s[k]))&&Number(s.startTime.slice(0,2))*60+Number(s.startTime.slice(3))+(s.dailyTarget-1)*s.interval<1440;}
export function rescheduleDay(state,words,now=new Date()){
 const day=ensureDay(state,words,now);const retained=day.ids.filter(id=>state.learned[id]);const rest=words.filter(w=>!state.learned[w.id]).slice(0,Math.max(0,state.settings.dailyTarget-retained.length)).map(w=>w.id);day.ids=[...retained,...rest];day.start=atTime(now,state.settings.startTime);day.interval=state.settings.interval;
}
export function shuffle(items,random=Math.random){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function makeTest(words,ids,now=Date.now()){
 const pool=words.filter(w=>ids.includes(w.id));if(!pool.length)return null;
 const selected=shuffle(pool);const count=Math.max(6,Math.min(10,pool.length));
 const questions=Array.from({length:count},(_,i)=>{const w=selected[i%selected.length];let type=['meaning','reverse','choice','fill','audio','sentence'][i%6];if(['fill','sentence'].includes(type)&&(!w.example||!w.example.toLowerCase().includes(w.word.toLowerCase())))type='meaning';const options=shuffle([w,...shuffle(words.filter(v=>v.id!==w.id)).slice(0,3)]).map(v=>v.id);return {id:w.id,type,options};});
 return {startedAt:now,questions,answers:[],index:0};
}
export function scoreTest(test){const correct=test.answers.filter(a=>a.correct).length;return {correct,total:test.questions.length,percent:Math.round(correct/test.questions.length*100)};}
export function notificationEvents(state,day,now=Date.now()){
 if(!state.settings.notifications)return [];const key=dayKey(new Date(now));const events=[];
 if(state.settings.newNotifications)for(const x of schedule(day))if(!state.learned[x.id])events.push({key:`${key}:word:${x.id}`,type:'learn',at:x.at});
 if(state.settings.reviewNotifications&&dueWords(state,now).length)events.push({key:`${key}:review`,type:'review',at:atTime(new Date(now),state.settings.reviewTime)});
 if(state.settings.testNotifications&&!state.tests.some(t=>dayKey(new Date(t.finishedAt))===key)&&Object.keys(state.learned).length)events.push({key:`${key}:test`,type:'test',at:atTime(new Date(now),state.settings.testTime)});
 return events.filter(e=>e.at<=now&&now-e.at<60000&&!state.notified.includes(e.key));
}
