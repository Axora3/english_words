import {dueWords,dayKey,rescheduleDay} from './core.js';
import {esc,button,progressBar} from './ui.js';

export const levels=['A1','A2','B1','B2','C1','C2'];
export function saveLearningPlan(state,input,words,now=new Date()){
 const level=String(input.level),minutes=Number(input.minutes),goal=String(input.goal);
 if(!levels.includes(level)||![5,10,20].includes(minutes)||!['everyday','travel','work','exam'].includes(goal))throw Error('Invalid learning plan');
 state.settings.learningPlan={level,minutes,goal,completedAt:now.getTime()};
 state.settings.dailyTarget=minutes===5?3:minutes===10?5:10;
 state.advanced.goals.dailyNew=state.settings.dailyTarget;
 state.advanced.goals.dailyReview=state.settings.dailyTarget*2;
 state.advanced.goals.weeklyWords=state.settings.dailyTarget*5;
 state.advanced.goals.weeklyMinutes=minutes*7;
 state.settings.startTime='09:00';
 // The first session starts now; future days use the same chosen time.
 state.settings.interval=1;
 rescheduleDay(state,plannedWords(state,words),now);
 state.days[dayKey(now)].start=now.getTime();
}
export function plannedWords(state,words){const level=state.settings.learningPlan?.level;return level? [...words.filter(w=>w.level===level),...words.filter(w=>w.level!==level)]:words;}
export function learningSummary(state,now=Date.now()){
 const learned=Object.values(state.learned),key=dayKey(new Date(now));
 return {total:learned.length,mastered:learned.filter(x=>x.stage>=4).length,due:dueWords(state,now).length,
  today:learned.filter(x=>dayKey(new Date(x.learnedAt))===key).length,
  next:Math.min(...learned.filter(x=>x.dueAt>now).map(x=>x.dueAt))};
}
export function planView(state){
 const mn=state.settings.language==='mn',p=state.settings.learningPlan||{},label=(a,b)=>mn?a:b;
 return `<section class="panel learning-onboarding"><p class="eyebrow">${label('ТАНЫ СУРАЛЦАХ ТӨЛӨВЛӨГӨӨ','YOUR LEARNING PLAN')}</p><h2>${label('Өөртөө тохируулж эхэлье','Make it yours')}</h2><p>${label('Түвшин, зорилгоо сонгоорой. Дараа нь хүссэн үедээ өөрчилж болно.','Choose your level and goal. You can change these any time.')}</p><form id="learning-plan-form"><div class="plan-fields"><label class="field">${label('Миний түвшин','My level')}<select class="input" name="level">${levels.map(l=>`<option ${p.level===l?'selected':''}>${l}</option>`).join('')}</select></label><label class="field">${label('Өдөрт зарцуулах хугацаа','Daily time')}<select class="input" name="minutes">${[5,10,20].map(n=>`<option value="${n}" ${(p.minutes||10)===n?'selected':''}>${n} ${label('минут','minutes')}</option>`).join('')}</select></label><label class="field">${label('Миний зорилго','My goal')}<select class="input" name="goal">${[['everyday','Өдөр тутмын яриа','Everyday conversation'],['travel','Аялал','Travel'],['work','Ажил','Work'],['exam','Шалгалт','Exams']].map(([v,a,b])=>`<option value="${v}" ${p.goal===v?'selected':''}>${label(a,b)}</option>`).join('')}</select></label></div>${button(label('Төлөвлөгөөгөө хадгалах','Save my plan'),{ic:'check'})}</form></section>`;
}
export function progressSummaryView(state){
 const xp=Object.keys(state.learned).length*10+state.reviews.length*2+Object.keys(state.grammar?.completed||{}).length*25,level=Math.min(999,Math.floor(Math.sqrt(xp)/10)+1),remaining=Math.max(0,(level*10)**2-xp);
 const s=learningSummary(state),mn=state.settings.language==='mn',label=(a,b)=>mn?a:b;
 return `<section class="panel learning-summary"><div class="section-header"><h2>${label('Миний суралцах ахиц','My learning progress')}</h2><a href="#statistics">${label('Дэлгэрэнгүй','Details')}</a></div><p>Level ${level} · ${xp} XP · ${label('Дараагийн түвшин хүртэл','To next level')}: ${remaining} XP</p><div class="plan-metrics">${[[s.mastered,'Тогтоосон үг','Retained words'],[s.due,'Давтах үг','Due for review'],[s.today,'Өнөөдөр сурсан','Learned today']].map(([n,a,b])=>`<div><strong class="num">${n}</strong><span>${label(a,b)}</span></div>`).join('')}</div><p class="key-hint">${label('Тогтоосон: давталтын 4 ба түүнээс дээш шатанд хүрсэн үг.','Retained: words that reached review stage 4 or higher.')}</p>${progressBar(Math.min(100,s.today/state.settings.dailyTarget*100),{label:label('Өдрийн зорилго','Daily goal')})}<div class="form-actions">${button(label('Давтлага эхлэх','Start reviewing')+` · ${s.due}`,{href:'#review',ic:'refresh'})}${button(label('Төлөвлөгөө','Learning plan'),{href:'#plan',kind:'ghost'})}${button(label('Дуудлага, сонсгол','Pronunciation & listening'),{href:'#practice',kind:'ghost',ic:'headphones'})}${button('Challenge',{href:'#battle',kind:'secondary',ic:'trophy'})}</div></section>`;
}
