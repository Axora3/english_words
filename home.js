// Home: one clear next action, a margin rail with the day's timeline, challenge, goals and course.
import {icon} from './icons.js';
import {u} from './labels.js';
import {nextWord,schedule,dueWords,streak,dayKey} from './core.js';
import {goalProgress} from './study-goals.js';
import {ensureChallenge,challengeProgress} from './daily-challenge.js';
import {currentLesson,availableLessons,lessonUnlockDate} from './grammar.js';
import {lessons} from './grammar-data.js';
import {button,progressRing,progressBar,sectionHeader,stat,iconTile,barChart,legend,esc} from './ui.js';

export const challengeMeta={learn:['book-2','accent','learn'],review:['refresh','quiz','review'],quiz:['checklist','quiz','test'],grammar:['school','context','grammar'],listening:['headphones','listening','practice'],writing:['pencil','writing','writing'],phrases:['link','builder','phrases']};

export function weekChart(state,{t,dateLabel,locale}){
 const dates=Array.from({length:7},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(6-i));return d;});
 const learned=dates.map(d=>Object.values(state.learned).filter(v=>dayKey(new Date(v.learnedAt))===dayKey(d)).length),reviewed=dates.map(d=>state.reviews.filter(v=>dayKey(new Date(v.at))===dayKey(d)).length);
 const day=d=>state.settings.language==='mn'?['Ня','Да','Мя','Лх','Пү','Ба','Бя'][d.getDay()]:d.toLocaleDateString(locale,{weekday:'short'});
 const aria=dates.map((d,i)=>`${dateLabel(d)}: ${learned[i]} ${t('learned')}, ${reviewed[i]} ${t('reviewed')}`).join('; ');
 return `${legend([['tone-accent',t('learned')],['tone-mint',t('reviewed')]])}${barChart(dates.map((d,i)=>({label:day(d),title:`${dateLabel(d)} · ${learned[i]} / ${reviewed[i]}`})),[{values:learned,tone:'tone-accent'},{values:reviewed,tone:'tone-mint'}],{label:aria,current:6,height:132})}${!learned.some(Boolean)&&!reviewed.some(Boolean)?`<p class="chart-empty">${t('emptyActivity')}</p>`:''}`;
}

export function homeView(state,day,ctx){
 const {t,timeLabel,dateLabel,countdown,persist}=ctx;
 const L=k=>u(state,k);
 const active=nextWord(state,day),plan=schedule(day),done=day.ids.filter(id=>state.learned[id]).length,total=day.ids.length;
 const upcoming=plan.find(x=>!state.learned[x.id]),due=dueWords(state),hour=new Date().getHours();
 const greeting=t(hour<12?'morningGreeting':hour<18?'afternoonGreeting':'eveningGreeting');
 // Hero: the single next action.
 let heroTitle,heroSub,heroMeta='',cta;
 if(active){heroTitle=L('readyTitle');heroSub=t('learningSub');cta=button(L('continue'),{href:'#learn',size:'lg',iconEnd:'arrow-right'});}
 else if(upcoming){heroTitle=t('waiting');heroSub=t('waitingSub');heroMeta=`<div class="hero-countdown"><span>${L('unlocksIn')}</span><strong class="num" data-until="${upcoming.at}">${countdown(upcoming.at)}</strong><small>${L('unlocksAt')} <time>${timeLabel(upcoming.at)}</time></small></div>`;cta=due.length?button(`${L('reviewNow')} · ${due.length}`,{href:'#review',size:'lg',ic:'refresh'}):button(L('explore'),{href:'#library',size:'lg',kind:'secondary',iconEnd:'arrow-right'});}
 else{heroTitle=total?t('allDone'):t('bankNote');heroSub=total?t('allDoneSub'):'';cta=due.length?button(`${L('reviewNow')} · ${due.length}`,{href:'#review',size:'lg',ic:'refresh'}):button(t('takeTest'),{href:'#test',size:'lg',kind:'secondary',ic:'checklist'});}
 const secondary=active&&due.length?button(`${L('review')} · ${due.length}`,{href:'#review',kind:'ghost',ic:'refresh'}):'';
 const track=plan.map((x,i)=>{const learned=Boolean(state.learned[x.id]),current=active?.id===x.id;return `<li class="${learned?'is-done':current?'is-current':''}" title="${timeLabel(x.at)}"><span class="sr-only">${t('newWords')} ${i+1}: ${t(learned?'learned':current?'available':'locked')}, ${timeLabel(x.at)}</span></li>`;}).join('');
 const hero=`<section class="today-hero" aria-labelledby="today-title">
  <div class="hero-main"><p class="eyebrow">${icon('sparkles')}${L('nextUp')}</p><h2 id="today-title" class="hero-title">${heroTitle}</h2>${heroSub?`<p class="hero-sub">${heroSub}</p>`:''}${heroMeta}<div class="hero-actions">${cta}${secondary}</div></div>
  <div class="hero-side">${progressRing(total?done/total*100:0,{size:132,stroke:10,label:`${t('dailyProgress')}: ${done}/${total}`,center:`<strong class="num">${done}<span>/${total}</span></strong><small>${L('wordsToday')}</small>`,tone:done===total&&total?'tone-mint':''})}</div>
  ${total?`<ol class="day-track" aria-label="${esc(L('dayTrack'))}">${track}</ol>`:''}
 </section>`;
 // Stat strip
 const stats=`<section class="stat-strip" aria-label="${esc(t('statistics'))}">${stat(due.length,t('reviewDue'),{ic:'refresh',href:'#review',tone:due.length?'tone-accent':''})}${stat(streak(state),t('streak'),{ic:'flame',href:'#calendar'})}${stat(Object.keys(state.learned).length,L('totalLearned'),{ic:'book-2',href:'#history'})}${stat(state.favorites.length,L('saved'),{ic:'heart',href:'#favorites'})}</section>`;
 // Weekly
 const week=`<section class="panel home-week">${sectionHeader(L('weekly'),{sub:t('weekSub'),action:button(L('seeProgress'),{href:'#statistics',kind:'ghost',size:'sm',iconEnd:'arrow-right'})})}${weekChart(state,ctx)}</section>`;
 // Rail: day timeline
 const reviewAt=new Date();const [rh,rm]=state.settings.reviewTime.split(':');reviewAt.setHours(rh,rm,0,0);const testAt=new Date();const [th,tm]=state.settings.testTime.split(':');testAt.setHours(th,tm,0,0);
 const rows=[...plan.map((x,i)=>{const learned=Boolean(state.learned[x.id]),current=active?.id===x.id;return {at:x.at,cls:learned?'is-done':current?'is-current':'',ic:learned?'check':current?'player-play':'lock',title:learned||current?`<span lang="en">${esc(ctx.byId(x.id)?.word||'')}</span>`:`${t('newWords')} ${i+1}`,sub:t(learned?'learned':current?'available':'locked'),href:current?'#learn':learned?`#details/${x.id}`:''};}),
  {at:reviewAt.getTime(),cls:'is-milestone',ic:'refresh',title:L('reviewReminder'),sub:due.length?`${due.length} ${L('dueShort')}`:t('noReview'),href:'#review'},
  {at:testAt.getTime(),cls:'is-milestone',ic:'checklist',title:L('testReminder'),sub:state.tests.some(x=>dayKey(new Date(x.finishedAt))===dayKey())?t('done'):t('scheduled'),href:'#test'}].sort((a,b)=>a.at-b.at);
 const timeline=`<section class="rail-section">${sectionHeader(L('yourDay'),{action:`<a class="icon-btn" href="#settings" aria-label="${esc(t('settings'))}" data-tooltip="${esc(t('settings'))}">${icon('adjustments-horizontal')}</a>`})}<ol class="timeline">${rows.map(r=>{const inner=`<time class="num">${timeLabel(r.at)}</time><span class="timeline-dot">${icon(r.ic)}</span><span class="timeline-copy"><strong>${r.title}</strong><small>${r.sub}</small></span>`;return `<li class="${r.cls}">${r.href?`<a href="${r.href}">${inner}</a>`:`<div>${inner}</div>`}</li>`;}).join('')}</ol></section>`;
 // Rail: challenge
 const before=Object.keys(state.advanced.challenges).length;ensureChallenge(state);if(Object.keys(state.advanced.challenges).length!==before)persist();
 const c=challengeProgress(state),[cic,chue,dest]=challengeMeta[c.kind]||['target','accent','practice'];
 const challenge=`<section class="rail-section challenge">${sectionHeader(L('challenge'),{action:`<span class="badge tone-accent num">+${c.points} ${L('points')}</span>`})}<a class="challenge-body" href="#${c.done?'challenges':dest}">${iconTile(cic,chue)}<span><strong>${t('p.challenge'+c.kind[0].toUpperCase()+c.kind.slice(1))}</strong><small class="num">${c.value} / ${c.target}${c.claimedAt?' · '+t('p.claimed'):''}</small></span>${icon('chevron-right')}</a>${progressBar(c.percent,{label:L('challenge'),tone:c.done?'tone-mint':''})}</section>`;
 // Rail: goals
 const goals=goalProgress(state).slice(0,3);
 const goalList=`<section class="rail-section">${sectionHeader(L('studyGoals'),{action:`<a class="icon-btn" href="#goals" aria-label="${esc(L('editGoals'))}" data-tooltip="${esc(L('editGoals'))}">${icon('edit')}</a>`})}<ul class="goal-list">${goals.map(g=>`<li><div class="goal-line"><span>${t('p.'+g.key)}</span><strong class="num">${g.value}<small> / ${g.target}</small></strong></div>${progressBar(g.percent,{label:t('p.'+g.key),tone:g.done?'tone-mint':'',size:'thin'})}</li>`).join('')}</ul></section>`;
 // Rail: grammar
 const g=state.grammar,lesson=currentLesson(g),avail=availableLessons(g),completed=g?Object.keys(g.completed).length:0,nextAt=g&&avail<lessons.length?lessonUnlockDate(g,avail):null;
 const grammar=`<section class="rail-section">${sectionHeader(L('grammarWeek'))}<a class="course-link" href="#grammar${lesson?'/'+lesson.id:''}">${iconTile('school','context')}<span><small>${lesson?`${lesson.level} · ${L('lesson')} ${lessons.indexOf(lesson)+1}`:'A1 → C1'}</small><strong>${lesson?esc(lesson.title[state.settings.language]):t('grammarStart')}</strong>${g?`<small class="num">${completed} / ${lessons.length} ${t('completed')}${nextAt?` · ${t('grammarNext')}: ${dateLabel(nextAt)}`:''}</small>`:''}</span>${icon('chevron-right')}</a></section>`;
 return `<div class="home">
  <header class="home-header"><p class="eyebrow">${greeting}</p><h1>${L('todayPlan')}</h1></header>
  <div class="home-grid"><div class="home-main">${hero}${stats}${week}</div><aside class="home-rail" aria-label="${esc(L('yourDay'))}">${timeline}${challenge}${goalList}${grammar}</aside></div>
 </div>`;
}
