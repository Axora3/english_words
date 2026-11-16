import {icon} from './icons.js';
import {u} from './labels.js';
import {achievementStatus,updateAchievements} from './achievements.js';
import {ensureChallenge,challengeProgress,claimChallenge} from './daily-challenge.js';
import {learningAnalytics} from './analytics.js';
import {mistakeGroups} from './mistakes.js';
import {wordFamilies} from './word-family.js';
import {weakWords} from './weak-words.js';
import {vocabulary} from './vocabulary.js';
import {activityDays,weekStart} from './calendar.js';
import {dayKey} from './core.js';
import {routeTitle} from './shell.js';
import {weekChart,challengeMeta} from './home.js';
import {button,iconButton,pageHeader,sectionHeader,stat,progressBar,progressRing,cefr,badge,emptyState,tabLinks,iconTile,barChart,legend,esc,pct} from './ui.js';

const categoryIcon={newWords:'book-2',longest:'flame',quizzes:'checklist',accuracy:'target',listening:'headphones',writing:'pencil',grammar:'school'};

/** Sub-navigation shared by every Progress destination. */
export function progressTabs(state,t,route){
 const L=k=>u(state,k);
 return tabLinks([['statistics',L('overview'),'chart-bar'],['calendar',t('p.calendar'),'calendar'],['goals',t('p.goals'),'target'],['weak',t('p.weak'),'alert-triangle'],['achievements',t('p.achievements'),'trophy'],['challenges',t('p.challenges'),'bolt'],['mistakes',t('p.mistakes'),'pencil']].map(([href,label,ic])=>({href:'#'+href,label,ic,active:route===href||(href==='statistics'&&route==='analytics')})),{label:L('progress')});
}

/** 12-week activity heatmap (Mon–Sun rows). */
export function heatmap(state,{t,lang,action='p-day-go',selected=''}){
 const days=activityDays(state),start=weekStart(new Date());start.setDate(start.getDate()-77);const today=dayKey();
 const weeks=Array.from({length:12},(_,w)=>Array.from({length:7},(_,d)=>{const x=new Date(start);x.setDate(x.getDate()+w*7+d);return x;}));
 const wd=lang==='mn'?['Да','Мя','Лх','Пү','Ба','Бя','Ня']:['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
 const month=d=>lang==='mn'?`${d.getMonth()+1}-р сар`:d.toLocaleDateString('en-US',{month:'short'});
 const label=(d,n)=>`${lang==='mn'?`${d.getMonth()+1}-р сарын ${d.getDate()}`:d.toLocaleDateString('en-US',{month:'short',day:'numeric'})}: ${n}`;
 return `<div class="heatmap" role="group" aria-label="${esc(u(state,'last12'))}"><div class="heat-months" aria-hidden="true">${weeks.map(w=>`<span>${w.some(d=>d.getDate()===1)?month(w.find(d=>d.getDate()===1)):''}</span>`).join('')}</div><div class="heat-body"><div class="heat-days" aria-hidden="true">${wd.map((n,i)=>`<span>${i%2===0?n:''}</span>`).join('')}</div><div class="heat-grid">${weeks.map(w=>`<div class="heat-week">${w.map(d=>{const key=dayKey(d),x=days[key],future=key>today;return future?'<span class="heat-cell is-future"></span>':`<button type="button" class="heat-cell i${x?.intensity||0}${key===today?' is-today':''}${key===selected?' is-selected':''}" data-action="${action}:${key}" aria-label="${esc(label(d,x?.total||0))}" title="${esc(label(d,x?.total||0))}"></button>`;}).join('')}</div>`).join('')}</div></div><div class="heat-legend" aria-hidden="true"><span>${u(state,'less')}</span>${[0,1,2,3,4].map(i=>`<i class="heat-cell i${i}"></i>`).join('')}<span>${u(state,'moreLegend')}</span></div></div>`;
}

export class ProgressUI{
 constructor(parent){this.p=parent;}
 view(route){const p=this.p,s=p.state,t=p.t,L=k=>u(s,k);
  const head=(title,sub='')=>pageHeader({eyebrow:L('progress'),title,sub})+progressTabs(s,t,route);
  if(route==='achievements'){if(updateAchievements(s).length)p.ctx.persist();const all=achievementStatus(s),earned=all.filter(b=>b.unlocked).length;const groups=[...new Set(all.map(b=>b.category))];
   return head(t('p.achievements'))+`<section class="achievement-summary">${progressRing(pct(earned,all.length),{size:96,stroke:8,label:`${earned}/${all.length}`,center:`<strong class="num">${earned}<span>/${all.length}</span></strong>`,tone:'tone-mint'})}<div><h2>${earned} ${L('earned')}</h2><p class="muted-copy">${L('nextBadges')}: ${all.filter(b=>!b.unlocked).sort((a,b)=>b.percent-a.percent).slice(0,2).map(b=>`${t('p.'+b.category)} · ${b.target}`).join(', ')||'—'}</p></div></section>
    ${groups.map(g=>`<section class="achievement-group">${sectionHeader(`${icon(categoryIcon[g]||'trophy')}${t('p.'+g)}`)}<ul class="badge-list">${all.filter(b=>b.category===g).map(b=>`<li class="${b.unlocked?'is-earned':''}">${b.unlocked?`<button type="button" class="medal" data-action="z-badge:${b.id}" aria-label="${esc(t('p.'+b.category)+' · '+b.target)}">${icon('trophy',{filled:false})}</button>`:`<span class="medal">${icon('lock')}</span>`}<div class="badge-copy"><strong><span class="num">${b.target}</span> · ${t('p.'+b.category)}</strong><small>${b.unlocked?`${t('p.unlocked')} · ${p.ctx.dateLabel(b.at)}`:`<span class="num">${b.value} / ${b.target}</span>`}</small>${b.unlocked?'':progressBar(b.percent,{size:'thin',label:t('p.'+b.category)})}</div></li>`).join('')}</ul></section>`).join('')}`;}
  if(route==='challenges'){const existing=Object.keys(s.advanced.challenges).length;ensureChallenge(s);if(Object.keys(s.advanced.challenges).length!==existing)p.ctx.persist();const c=challengeProgress(s),[ic,hue,dest]=challengeMeta[c.kind]||['target','accent','practice'];
   const history=Object.entries(s.advanced.challenges).sort().reverse();
   return head(t('p.challenges'),t('p.challengeNote'))+`<section class="challenge-hero hue-${hue}"><div class="challenge-copy">${iconTile(ic,hue,{size:'lg'})}<div><p class="eyebrow">${L('today')}</p><h2>${t('p.challenge'+c.kind[0].toUpperCase()+c.kind.slice(1))}</h2><p class="muted-copy num">${c.value} / ${c.target} · +${c.points} ${L('points')}</p></div></div>${progressRing(c.percent,{size:112,stroke:9,label:`${c.percent}%`,center:`<strong class="num">${c.percent}<span>%</span></strong>`,tone:c.done?'tone-mint':''})}<div class="hero-actions">${button(t('p.start'),{href:'#'+dest,iconEnd:'arrow-right'})}${button(t(c.claimedAt?'p.claimed':'p.claim'),{action:'z-claim',kind:'secondary',ic:c.claimedAt?'circle-check':'trophy',disabled:!c.done||Boolean(c.claimedAt)})}</div></section>
    <section class="panel">${sectionHeader(t('p.challengeHistory'))}<ul class="history-list static">${history.map(([date,x])=>`<li><div><span class="num">${date}</span><strong>${t('p.challenge'+x.kind[0].toUpperCase()+x.kind.slice(1))}</strong>${x.claimedAt?badge(`+${x.points}`,'tone-mint'):badge('0')}</div></li>`).join('')}</ul></section>`;}
  if(route==='families')return pageHeader({eyebrow:L('practice'),title:t('p.families'),sub:L('contextDesc')})+`<div class="family-reference">${wordFamilies.map(f=>`<section class="family-block"><h2 lang="en">${esc(f.root)}</h2><ul>${f.forms.map(w=>`<li><div class="family-word"><strong lang="en">${esc(w.word)}</strong><span class="pos">${esc(w.pos)}</span><span class="vocab-ipa" lang="en">${esc(w.ipa)}</span></div><p lang="mn">${esc(w.meaning)}</p><blockquote class="example"><p lang="en">${esc(w.example)}</p><p lang="mn">${esc(w.exampleMn)}</p></blockquote>${iconButton('volume',t('pronounce'),{action:'z-say:'+encodeURIComponent(w.example)})}</li>`).join('')}</ul></section>`).join('')}</div>`;
  if(route==='mistakes'){const groups=mistakeGroups(s),any=groups.some(g=>g.items.length);
   return head(t('p.mistakes'))+(!any?emptyState({ic:'circle-check',title:t('p.noData'),body:L('noActivity')}):`<div class="mistake-groups">${groups.filter(g=>g.items.length).map(g=>`<section class="panel">${sectionHeader(`${t('p.'+g.category)} <span class="badge num">${g.items.length}</span>`,{action:button(t('p.practiceAgain'),{href:'#'+(g.category==='spelling'?'practice':g.category==='usage'?'writing':'grammar'),kind:'ghost',size:'sm',iconEnd:'arrow-right'})})}<ul class="mistake-list">${g.items.slice(0,20).map(m=>`<li><p>${esc(m.detail)}</p><small>${p.ctx.dateLabel(m.at)}</small><a class="inline-link" href="#${m.sourceId.startsWith('writing-')?'writing':'grammar/'+encodeURIComponent(m.sourceId.split(':')[0])}">${t('p.practiceAgain')}${icon('arrow-right')}</a></li>`).join('')}</ul></section>`).join('')}</div>`);}
  return this.overview();
 }
 overview(){const p=this.p,s=p.state,t=p.t,L=k=>u(s,k),a=learningAnalytics(s),lang=s.settings.language,locale=lang==='mn'?'mn-MN':'en-US';
  const minutes=Math.round(a.seconds/60),reviewAcc=s.reviews.length?pct(s.reviews.filter(r=>r.correct).length,s.reviews.length):null;
  const kpis=`<section class="stat-strip wide" aria-label="${esc(L('overview'))}">${stat(a.learned,L('totalLearned'),{ic:'book-2',note:`${a.mastered} ${t('p.mastered').toLowerCase()}`})}${stat(a.accuracy===null?'—':a.accuracy+'%',t('p.accuracy'),{ic:'target',note:reviewAcc===null?'':`${u(s,'review')}: ${reviewAcc}%`})}${stat(minutes,t('p.studyTime'),{ic:'clock',note:L('minutes')})}${stat(a.streak,L('currentStreak'),{ic:'flame',note:`${t('p.longest')}: ${a.longest}`})}</section>`;
  // 30-day trend with zero days included
  const days=Array.from({length:30},(_,i)=>{const d=new Date();d.setDate(d.getDate()-(29-i));return d;}),totals=days.map(d=>a.days[dayKey(d)]?.total||0);
  const trend=barChart(days.map((d,i)=>({label:i%5===4||i===29?String(d.getDate()):'',title:`${p.ctx.dateLabel(d)}: ${totals[i]}`})),[{values:totals,tone:'tone-accent'}],{label:`${L('last30')}: ${totals.reduce((n,x)=>n+x,0)}`,current:29,height:120});
  const cefrRows=a.cefr.filter(c=>c.total).map(c=>`<li>${cefr(c.level)}<div class="stack-bar" role="img" aria-label="${esc(`${c.level}: ${c.learned}/${c.total} ${t('learned')}, ${c.mastered} ${t('p.mastered')}`)}"><i class="tone-mint" style="width:${pct(c.mastered,c.total)}%"></i><i class="tone-accent" style="width:${pct(c.learned-c.mastered,c.total)}%"></i></div><span class="num">${c.learned}/${c.total}</span><small class="num">${c.accuracy===null?'—':c.accuracy+'%'}</small></li>`).join('');
  const weak=weakWords(s).slice(0,5),bank=vocabulary(s);
  const all=achievementStatus(s),earned=all.filter(b=>b.unlocked).length,close=all.filter(b=>!b.unlocked).sort((x,y)=>y.percent-x.percent).slice(0,3);
  const time=a.time.filter(x=>x.seconds>=30).sort((x,y)=>y.seconds-x.seconds).slice(0,6),maxT=Math.max(1,...time.map(x=>x.seconds));
  return pageHeader({eyebrow:L('progress'),title:t('p.analytics'),sub:t('p.masteryNote')})+progressTabs(s,t,'statistics')+kpis+`
   <div class="progress-grid">
    <section class="panel">${sectionHeader(L('activity'),{sub:L('last12'),action:button(t('p.calendar'),{href:'#calendar',kind:'ghost',size:'sm',iconEnd:'arrow-right'})})}${heatmap(s,{t,lang})}</section>
    <section class="panel">${sectionHeader(L('weekly'),{sub:t('weekSub')})}${weekChart(s,{t,dateLabel:p.ctx.dateLabel,locale})}</section>
    <section class="panel">${sectionHeader(t('p.monthly'),{sub:L('last30')})}${totals.some(Boolean)?trend:`<p class="chart-empty">${L('noActivity')}</p>`}</section>
    <section class="panel">${sectionHeader(t('p.cefr'),{sub:`${t('learned')} · ${t('p.mastered')} · ${t('p.accuracy')}`})}${legend([['tone-mint',t('p.mastered')],['tone-accent',t('learned')]])}<ul class="cefr-rows">${cefrRows}</ul></section>
    <section class="panel">${sectionHeader(t('p.weak'),{action:button(L('seeAll'),{href:'#weak',kind:'ghost',size:'sm',iconEnd:'arrow-right'})})}${weak.length?`<ul class="rank-list">${weak.map(x=>{const w=bank.find(w=>w.id===x.id);return w?`<li><a href="#details/${w.id}">${cefr(w.level)}<strong lang="en">${esc(w.word)}</strong><span class="num">${x.errors} ${t('p.errors').toLowerCase()}</span>${icon('chevron-right')}</a></li>`:'';}).join('')}</ul>`:`<p class="muted-copy">${t('p.weakNote')}</p>`}</section>
    <section class="panel">${sectionHeader(t('p.achievements'),{sub:`${earned} / ${all.length} ${L('earned')}`,action:button(L('seeAll'),{href:'#achievements',kind:'ghost',size:'sm',iconEnd:'arrow-right'})})}<ul class="badge-list compact">${close.map(b=>`<li><span class="medal">${icon(categoryIcon[b.category]||'trophy')}</span><div class="badge-copy"><strong><span class="num">${b.target}</span> · ${t('p.'+b.category)}</strong>${progressBar(b.percent,{size:'thin',label:t('p.'+b.category)})}</div><small class="num">${b.value}/${b.target}</small></li>`).join('')}</ul></section>
    <section class="panel">${sectionHeader(L('timeBySection'),{sub:t('p.studyTime')})}${time.length?`<ul class="hbar-list">${time.map(x=>`<li><span>${esc(routeTitle(x.section,s,t))}</span><div class="hbar"><i style="width:${pct(x.seconds,maxT)}%"></i></div><b class="num">${Math.max(1,Math.round(x.seconds/60))} ${L('minutes')}</b></li>`).join('')}</ul>`:`<p class="muted-copy">${L('noActivity')}</p>`}<p class="footnote">${t('p.timeNote')}</p></section>
   </div>`;
 }
 click(action,value){if(action==='z-badge'){const b=achievementStatus(this.p.state).find(b=>b.id===value);if(b?.unlocked){const dialog=document.createElement('dialog');dialog.className='modal achievement-dialog';dialog.innerHTML=`<div class="medal-burst">${icon('trophy')}</div><h2><span class="num">${b.target}</span> · ${this.p.t('p.'+b.category)}</h2><p>${this.p.t('p.unlocked')} · ${this.p.ctx.dateLabel(b.at)}</p><form method="dialog"><button class="btn primary">${icon('check')}<span>${u(this.p.state,'close')}</span></button></form>`;dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();}return true;}if(action==='z-claim'){if(claimChallenge(this.p.state))this.p.ctx.toast('+10 '+this.p.t('p.points'));this.p.ctx.persist();this.p.ctx.render();return true;}if(action==='z-say'){this.p.ctx.speak(decodeURIComponent(value));return true;}return false;}
}
