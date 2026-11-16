// Word-centred screens: learn flow, word detail, review session, daily test, results and word lists.
import {icon} from './icons.js';
import {u} from './labels.js';
import {schedule,nextWord,dueWords,scoreTest,dayKey} from './core.js';
import {familyFor} from './word-family.js';
import {relatedPhrases} from './collocations.js';
import {contextsFor} from './context-learning.js';
import {audioActions,voicePanel} from './voice-ui.js';
import {button,iconButton,pageHeader,sectionHeader,stat,progressBar,progressRing,cefr,badge,emptyState,quizOption,feedback,searchInput,segmented,kbd,tabLinks,esc,pct} from './ui.js';

const stageCount=6;
export function wordStatus(state,id,now=Date.now()){const l=state.learned[id];if(!l)return 'new';if(l.dueAt<=now)return 'due';if(l.stage>=3)return 'mastered';return 'learning';}
const statusTone={new:'',learning:'tone-accent',mastered:'tone-mint',due:'tone-warning'};
const statusKey={new:'statusNew',learning:'statusLearning',mastered:'statusMastered',due:'statusDue'};
export function statusBadge(state,id){const s=wordStatus(state,id);return badge(u(state,statusKey[s]),statusTone[s]+' status');}

/** VocabularyRow — compact dictionary line. */
export function vocabRow(w,state,{t,open='detail',remove='',meta=null}){
 const saved=state.favorites.includes(w.id);
 return `<li class="vocab-row">${cefr(w.level)}<button type="button" class="vocab-main" data-action="${open}:${w.id}"><span class="vocab-head"><strong lang="en">${esc(w.word)}</strong><span class="vocab-ipa" lang="en">${esc(w.ipa||'')}</span><span class="vocab-pos">${esc(t(w.pos)===w.pos?w.pos:t(w.pos))}</span></span><span class="vocab-meaning" lang="mn">${esc(w.translation)}</span>${meta?`<span class="vocab-meta">${meta(w)}</span>`:''}</button><span class="vocab-status">${statusBadge(state,w.id)}</span><span class="vocab-actions">${iconButton('volume',t('pronounce'),{action:'speak:'+w.id})}${iconButton('heart',t(saved?'unsave':'save'),{action:'favorite:'+w.id,pressed:saved,filled:saved,kind:saved?'is-saved':''})}${remove?iconButton('x',t('p.remove'),{action:`p-remove:${remove}|${w.id}`}):''}</span></li>`;
}
export function vocabList(list,state,opts){return `<ul class="vocab-list">${list.map(w=>vocabRow(w,state,opts)).join('')}</ul>`;}

function chips(items,{lookup=true}={}){return `<div class="chip-row">${items.filter(Boolean).map(s=>lookup?`<button type="button" class="chip" data-action="p-lookup:${encodeURIComponent(s)}" lang="en">${esc(s)}</button>`:`<span class="chip" lang="en">${esc(s)}</span>`).join('')}</div>`;}
function stagePips(stage){return `<span class="stage-pips" aria-hidden="true">${Array.from({length:stageCount},(_,i)=>`<i class="${i<stage?'on':''}"></i>`).join('')}</span>`;}

/** Flashcard used by the learn flow and review sessions. */
function flashcard(w,c,{mode}){
 const {state,t,revealed}=c,L=k=>u(state,k),saved=state.favorites.includes(w.id),review=mode==='review';
 const meaning=revealed?`<div class="reveal-block"><p class="meaning-label">${L('meaning')}</p><p class="meaning" lang="mn">${esc(w.translation)}</p>${w.example?`<blockquote class="example"><p lang="en">${esc(w.example)}</p>${w.exampleMn?`<p lang="mn">${esc(w.exampleMn)}</p>`:''}</blockquote>`:''}${!review&&(w.synonyms.length||w.antonyms.length)?`<div class="relation-grid">${w.synonyms.length?`<div><p class="meaning-label">${t('synonyms')}</p>${chips(w.synonyms,{lookup:false})}</div>`:''}${w.antonyms.length?`<div><p class="meaning-label">${t('antonyms')}</p>${chips(w.antonyms,{lookup:false})}</div>`:''}</div>`:''}${!review&&(w.usage||w.usageMn)?`<div class="usage-note">${icon('info-circle')}<p>${esc(state.settings.language==='mn'?w.usageMn||w.usage:w.usage)}</p></div>`:''}</div>`
  :`<button type="button" class="reveal-button" data-action="reveal">${icon('eye')}<span>${review?L('showAnswer'):t('reveal')}</span>${kbd('Space')}</button>`;
 const actions=review?(revealed?`<div class="answer-bar"><p>${L('didYouRemember')}</p><div class="answer-buttons">${button(t('again'),{action:'review-answer:0',kind:'secondary',size:'lg',ic:'arrow-back-up',attrs:'aria-keyshortcuts="1"'})}${button(t('remember'),{action:'review-answer:1',size:'lg',ic:'check',attrs:'aria-keyshortcuts="2"'})}</div><p class="key-hint">${kbd('1')} ${kbd('2')} ${L('keyAnswer')}</p></div>`:'')
  :`<div class="card-footer">${button(t('markLearned'),{action:`learned:${w.id}`,size:'lg',full:true,ic:'check',disabled:!revealed})}</div>`;
 return `<article class="flashcard${revealed?' is-revealed':''}">
  <div class="flashcard-top"><div class="meta-row">${cefr(w.level)}<span class="pos">${esc(t(w.pos))}</span></div><div class="meta-actions">${review?iconButton('flag',t(state.difficult.includes(w.id)?'unmarkDifficult':'markDifficult'),{action:'difficult:'+w.id,pressed:state.difficult.includes(w.id),filled:state.difficult.includes(w.id)}):''}${iconButton('heart',t(saved?'unsave':'save'),{action:'favorite:'+w.id,pressed:saved,filled:saved,kind:saved?'is-saved':''})}</div></div>
  <div class="flashcard-word"><h2 class="word-display" lang="en">${esc(w.word)}</h2><p class="word-ipa"><span lang="en">${esc(w.ipa)}</span>${iconButton('volume',t('pronounce'),{action:'speak:'+w.id,kind:'soft'})}</p></div>
  ${meaning}
  ${!review||revealed?audioActions(w,{t,state}):''}
  ${actions}
 </article>`;
}

export function learnView(c){
 const {state,t,byId,timeLabel,countdown}=c,L=k=>u(state,k),day=c.today(),item=nextWord(state,day),plan=schedule(day),done=day.ids.filter(id=>state.learned[id]).length;
 let body;
 if(item)body=flashcard(byId(item.id),c,{mode:'learn'})+`<div data-voice-panel="${item.id}">${voicePanel(byId(item.id),c.voiceResult,{t,esc})}</div>`;
 else{const next=plan.find(x=>!state.learned[x.id]);body=next?`<section class="waiting-card">${icon('hourglass')}<h2>${t('waiting')}</h2><p>${t('waitingSub')}</p><div class="countdown"><span>${L('unlocksIn')}</span><strong class="num" data-until="${next.at}">${countdown(next.at)}</strong><small>${L('unlocksAt')} <time>${timeLabel(next.at)}</time></small></div>${dueWords(state).length?button(`${L('reviewNow')} · ${dueWords(state).length}`,{href:'#review',ic:'refresh'}):button(t('settings'),{href:'#settings',kind:'ghost',ic:'adjustments-horizontal'})}</section>`
  :emptyState({ic:'circle-check',title:t('allDone'),body:t(Object.keys(state.learned).length===c.words.length?'bankNote':'allDoneSub'),action:button(t('startReview'),{href:'#review',ic:'refresh'})});}
 const steps=`<ol class="step-dots" aria-label="${esc(L('dayTrack'))}">${plan.map((x,i)=>{const learned=Boolean(state.learned[x.id]),cur=item?.id===x.id;return `<li class="${learned?'is-done':cur?'is-current':''}"><span class="sr-only">${i+1}: ${t(learned?'learned':cur?'available':'locked')}</span></li>`;}).join('')}</ol>`;
 const aside=`<aside class="panel learn-aside">${sectionHeader(L('dayTrack'),{sub:t('todayWordsSub')})}<ol class="timeline compact">${plan.map((x,i)=>{const learned=Boolean(state.learned[x.id]),cur=item?.id===x.id,w=byId(x.id);return `<li class="${learned?'is-done':cur?'is-current':''}"><div><time class="num">${timeLabel(x.at)}</time><span class="timeline-dot">${icon(learned?'check':cur?'player-play':'lock')}</span><span class="timeline-copy"><strong>${learned||cur?`<span lang="en">${esc(w.word)}</span>`:`${t('newWords')} ${i+1}`}</strong><small>${t(learned?'learned':cur?'available':'locked')}</small></span></div></li>`;}).join('')}</ol>${button(t('browse'),{href:'#history',kind:'ghost',size:'sm',iconEnd:'arrow-right'})}</aside>`;
 return `${pageHeader({eyebrow:`${L('dayTrack')} · <span class="num">${done} / ${day.ids.length}</span>`,title:t('learningTitle'),sub:t('learningSub')})}<div class="learn-layout"><section class="learn-main">${steps}${body}</section>${aside}</div>`;
}

export function detailView(c){
 const {state,t,byId,dateLabel,platform}=c,L=k=>u(state,k),w=byId(c.detailId);
 if(!w)return emptyState({ic:'book-2',title:t('emptyLearned'),body:t('emptyLearnedSub'),action:button(L('explore'),{href:'#library'})});
 const saved=state.favorites.includes(w.id),l=state.learned[w.id],family=familyFor(w.word),phrases=relatedPhrases(w.id),contexts=contextsFor(w).slice(1);
 const usage=state.settings.language==='mn'?(w.usageMn||w.usage):w.usage;
 const hero=`<article class="word-hero">
  <div class="meta-row">${cefr(w.level)}<span class="pos">${esc(t(w.pos))}</span>${statusBadge(state,w.id)}<span class="meta-spacer"></span>${iconButton('heart',t(saved?'unsave':'save'),{action:'favorite:'+w.id,pressed:saved,filled:saved,kind:saved?'is-saved':''})}</div>
  <h1 class="word-display" lang="en">${esc(w.word)}</h1>
  ${audioActions(w,{t,state})}
  <div class="meaning-grid"><div><p class="meaning-label">${L('meaning')}</p><p class="meaning" lang="mn">${esc(w.translation)}</p></div>${usage?`<div><p class="meaning-label">${L('definition')}</p><p class="definition">${esc(usage)}</p>${state.settings.language==='mn'&&w.usage&&w.usageMn?`<p class="definition secondary" lang="en">${esc(w.usage)}</p>`:''}</div>`:''}</div>
 </article>`;
 const examples=`<section class="detail-section">${sectionHeader(L('examples'))}<ol class="example-list">${w.example?`<li><blockquote class="example"><p lang="en">${esc(w.example)}</p>${w.exampleMn?`<p lang="mn">${esc(w.exampleMn)}</p>`:''}</blockquote>${iconButton('volume',t('listenExample'),{action:'word-example:'+w.id})}</li>`:''}${contexts.map((x,i)=>`<li><blockquote class="example"><span class="badge">${t('p.context'+x.category)}</span><p lang="en">${esc(x.sentence)}</p><p lang="mn">${esc(x.translation)}</p></blockquote>${iconButton('volume',t('pronounce'),{action:`r-context-audio:${w.id}|${i+1}`})}</li>`).join('')}</ol></section>`;
 const relations=w.synonyms.length||w.antonyms.length?`<section class="detail-section">${sectionHeader(L('relations'))}<div class="relation-grid">${w.synonyms.length?`<div><p class="meaning-label">${t('synonyms')}</p>${chips(w.synonyms)}</div>`:''}${w.antonyms.length?`<div><p class="meaning-label">${t('antonyms')}</p>${chips(w.antonyms)}</div>`:''}</div></section>`:'';
 const fam=family?`<section class="detail-section">${sectionHeader(t('p.families'))}<ul class="family-list">${family.forms.map(f=>`<li class="${f.word.toLowerCase()===w.word.toLowerCase()?'is-current':''}"><strong lang="en">${esc(f.word)}</strong><span class="pos">${esc(f.pos)}</span><span lang="mn">${esc(f.meaning)}</span></li>`).join('')}</ul></section>`:'';
 const phr=phrases.length?`<section class="detail-section">${sectionHeader(L('connections'))}<ul class="phrase-list">${phrases.map(p=>`<li><span class="badge ${p.kind==='phrasal'?'tone-accent':''}">${t('p.'+p.kind)}</span><strong lang="en">${esc(p.text)}</strong><span lang="mn">${esc(p.meaning)}</span>${iconButton('volume',t('pronounce'),{action:'r-phrase-audio:'+p.id})}</li>`).join('')}</ul></section>`:'';
 const stateRail=`<section class="panel rail-card">${sectionHeader(L('learningState'),{level:2})}${l?`<div class="state-stage"><div><span class="meaning-label">${L('stage')}</span><strong class="num">${l.stage} / ${stageCount}</strong></div>${stagePips(l.stage)}</div><dl class="facts"><div><dt>${L('learnedOnShort')}</dt><dd>${dateLabel(l.learnedAt)}</dd></div><div><dt>${t('nextReview')}</dt><dd>${l.dueAt<=Date.now()?`<span class="badge tone-warning">${L('statusDue')}</span>`:dateLabel(l.dueAt)}</dd></div></dl>`:`<p class="muted-copy">${L('notLearned')}</p>${button(t('p.addReview'),{action:'p-add-review:'+w.id,kind:'secondary',full:true,ic:'plus'})}`}
  <button type="button" class="toggle-row" data-action="difficult:${w.id}" aria-pressed="${state.difficult.includes(w.id)}">${icon('flag',{filled:state.difficult.includes(w.id)})}<span>${t(state.difficult.includes(w.id)?'unmarkDifficult':'markDifficult')}</span></button></section>`;
 const collections=state.advanced.collections;
 const collect=`<section class="panel rail-card">${sectionHeader(t('p.addCollection'),{level:2})}${collections.length?`<form id="p-member-form" data-collection="" class="inline-form"><input type="hidden" name="wordId" value="${w.id}"><span class="select"><select name="collectionId" aria-label="${esc(t('p.collection'))}">${collections.map(col=>`<option value="${col.id}"${col.wordIds.includes(w.id)?' disabled':''}>${esc(col.name)}${col.wordIds.includes(w.id)?' ✓':''}</option>`).join('')}</select>${icon('selector')}</span>${button('',{kind:'secondary',ic:'plus',attrs:`aria-label="${esc(t('p.add'))}"`})}</form>`:`<p class="muted-copy">${t('p.empty')}</p>`}${button(t('p.collections'),{href:'#collections',kind:'ghost',size:'sm',iconEnd:'arrow-right'})}</section>`;
 const practise=`<section class="panel rail-card">${sectionHeader(L('practiceWord'),{level:2})}<div class="link-stack"><a href="#writing" data-action="r-writing-word-go:${w.id}">${icon('pencil')}<span>${t('p.writing')}</span>${icon('chevron-right')}</a><a href="#context" data-action="r-context-go:${w.id}">${icon('quote')}<span>${t('p.context')}</span>${icon('chevron-right')}</a><a href="#phrases">${icon('link')}<span>${t('p.phrases')}</span>${icon('chevron-right')}</a></div></section>`;
 return `<a class="back-link" href="#library">${icon('arrow-left')}<span>${u(state,'vocabulary')}</span></a><div class="word-detail"><div class="word-main">${hero}${examples}${relations}${fam}${phr}${!family&&!phrases.length&&!contexts.length&&!w.synonyms.length?`<p class="muted-copy">${L('noConnections')}</p>`:''}</div><aside class="word-rail">${stateRail}<div data-voice-panel="${w.id}">${voicePanel(w,c.voiceResult,{t,esc})}</div>${collect}${practise}</aside></div>`;
}

export function reviewView(c){
 const {state,t,byId,dateLabel,timeLabel}=c,L=k=>u(state,k);
 if(c.reviewResult){const r=c.reviewResult,p=pct(r.correct,r.total);return `<section class="result-screen">${progressRing(p,{size:168,stroke:12,label:`${L('accuracy')}: ${p}%`,center:`<strong class="num">${p}<span>%</span></strong><small>${L('accuracy')}</small>`,tone:p>=70?'tone-mint':''})}<h1>${t('sessionDone')}</h1><p class="page-sub">${t('reviewCompleteSub')}</p><div class="stat-strip compact">${stat(r.correct,t('correct'),{ic:'circle-check',tone:'tone-mint'})}${stat(r.total-r.correct,t('incorrect'),{ic:'circle-x',tone:r.total-r.correct?'tone-danger':''})}${stat(r.total,u(state,'review'),{ic:'refresh'})}</div><div class="result-actions">${button(t('returnDashboard'),{action:'go:dashboard',kind:'secondary'})}${button(t('takeTest'),{href:'#test',ic:'checklist'})}</div></section>`;}
 if(c.reviewSession){const s=c.reviewSession,id=s.ids[s.index];if(id)return `<div class="focus-session"><header class="session-bar"><span class="session-label">${icon('refresh')}${u(state,'review')}</span><span class="num session-count">${s.index+1} / ${s.ids.length}</span>${progressBar(s.index/s.ids.length*100,{label:t('session'),size:'thin'})}</header>${flashcard(byId(id),c,{mode:'review'})}${!c.revealed?`<p class="key-hint center">${kbd('Space')} ${L('keyReveal')}</p>`:''}</div>`;}
 const learned=Object.keys(state.learned),due=dueWords(state);
 const header=pageHeader({eyebrow:u(state,'review'),title:t('reviewTitle'),sub:t('reviewIntro')});
 if(!learned.length)return header+emptyState({ic:'book-2',title:t('emptyLearned'),body:t('emptyLearnedSub'),action:button(u(state,'continue'),{href:'#learn',iconEnd:'arrow-right'})});
 if(!due.length){const next=Math.min(...learned.map(id=>state.learned[id].dueAt));return header+emptyState({ic:'circle-check',title:t('noReview'),body:`${t('noReviewSub')} ${t('nextReview')}: ${dateLabel(next)} · ${timeLabel(next)}`,action:button(t('browse'),{href:'#history',kind:'secondary'})});}
 const levels=['A1','A2','B1','B2','C1','C2'].map(lv=>[lv,due.filter(id=>byId(id)?.level===lv).length]).filter(([,n])=>n);
 return header+`<div class="review-start"><section class="review-hero"><div class="review-count"><strong class="num">${due.length}</strong><span>${L('dueCount')}</span></div><div class="level-breakdown">${levels.map(([lv,n])=>`<span>${cefr(lv)}<b class="num">${n}</b></span>`).join('')}</div><div class="hero-actions">${button(t('startReview'),{action:'start-review',size:'lg',iconEnd:'arrow-right'})}</div><p class="key-hint">${t('reviewReady')}</p></section><aside class="panel">${sectionHeader(L('reviewPlan'),{level:2})}<p class="muted-copy">${L('reviewSteps')}</p><ol class="interval-scale" aria-hidden="true">${[1,3,7,14,30,60].map(d=>`<li><span class="num">${d}</span><small>${u(state,'days')}</small></li>`).join('')}</ol><p class="key-hint">${kbd('Space')} ${L('keyReveal')} · ${kbd('1')} ${kbd('2')} ${L('keyAnswer')}</p></aside></div>`;
}

export function testView(c){
 const {state,t,byId}=c,L=k=>u(state,k),active=state.activeTest;
 if(!active){const finished=state.tests.some(x=>dayKey(new Date(x.finishedAt))===dayKey()),last=state.tests.at(-1);const header=pageHeader({eyebrow:L('dailyTest'),title:t('testTitle'),sub:t('testIntro')});
  if(!Object.keys(state.learned).length)return header+emptyState({ic:'checklist',title:t('emptyLearned'),body:t('emptyLearnedSub'),action:button(L('continue'),{href:'#learn',iconEnd:'arrow-right'})});
  return header+`<div class="review-start"><section class="review-hero"><div class="test-facts">${['meaning','reverse','choice','fill','audio','sentence'].map(k=>`<span class="badge">${t(k+'Prompt')}</span>`).join('')}</div><p class="muted-copy">${t('testInfo')}</p><p class="muted-copy">${t(finished?'todayTestDone':'testReady')}</p><div class="hero-actions">${button(t('startTest'),{action:'start-test',size:'lg',iconEnd:'arrow-right'})}${last?button(L('yourScore')+` · ${scoreTest(last).percent}%`,{action:'result:'+last.finishedAt,kind:'ghost'}):''}</div></section><aside class="panel">${sectionHeader(t('testHistory'),{level:2})}${state.tests.length?`<ul class="history-list">${state.tests.slice(-6).reverse().map(x=>`<li><button type="button" data-action="result:${x.finishedAt}"><span>${c.dateLabel(x.finishedAt)} · <time>${c.timeLabel(x.finishedAt)}</time></span><strong class="num">${scoreTest(x).percent}%</strong>${icon('chevron-right')}</button></li>`).join('')}</ul>`:`<p class="muted-copy">${t('noTests')}</p>`}</aside></div>`;}
 const q=active.questions[active.index],w=byId(q.id),a=active.answers[active.index],input=['fill','audio'].includes(q.type);
 const blank=esc(w.example).replace(new RegExp(Array.from(w.word,ch=>'\\u'+ch.charCodeAt(0).toString(16).padStart(4,'0')).join(''),'ig'),'<span class="blank" aria-label="blank">______</span>');
 const prompt=q.type==='audio'?`<button type="button" class="listen-button" data-action="speak:${w.id}">${icon('volume-2')}<span>${t('listen')}</span></button>`:q.type==='fill'||q.type==='sentence'?`<p class="prompt-sentence" lang="en">${blank}</p>`:q.type==='meaning'?`<p class="prompt-word" lang="en">${esc(w.word)}</p>`:`<p class="prompt-word" lang="mn">${esc(w.translation)}</p>`;
 const answer=input?`<label class="field"><span class="field-label">${t('answer')}</span><input class="input lg" name="answer" autocomplete="off" autocapitalize="none" spellcheck="false" required ${a?'disabled':''} value="${esc(a?.value||'')}"${a?` aria-invalid="${!a.correct}"`:''}></label>`
  :`<div class="quiz-options">${q.options.map((id,i)=>{const o=byId(id);return quizOption({name:'answer',value:id,key:'ABCD'[i],label:esc(q.type==='meaning'?o.translation:o.word),lang:q.type==='meaning'?'mn':'en',disabled:Boolean(a),checked:a?.value===id,state:a?(id===q.id?(a.value===id?'correct':'missed'):a.value===id?'wrong':''):''});}).join('')}</div>`;
 return `<div class="focus-session"><header class="session-bar"><span class="session-label">${icon('checklist')}${L('dailyTest')}</span><span class="num session-count">${active.index+1} / ${active.questions.length}</span>${progressBar(active.index/active.questions.length*100,{label:t('question'),size:'thin'})}</header>
  <form id="test-form" class="quiz-card"><p class="eyebrow">${t(q.type+'Prompt')}</p>${prompt}${answer}
  ${a?`${feedback(a.correct,t(a.correct?'correctFeedback':'incorrectFeedback'),!a.correct?`${t('rightAnswer')}: <strong lang="${q.type==='meaning'?'mn':'en'}">${esc(q.type==='meaning'?w.translation:w.word)}</strong>`:'')}${button(t(active.index===active.questions.length-1?'finish':'next'),{action:'next-question',type:'button',size:'lg',full:true,iconEnd:'arrow-right'})}`:button(t('check'),{type:'submit',size:'lg',full:true,iconEnd:'arrow-right'})}</form></div>`;
}

export function resultsView(c){
 const {state,t,byId}=c,data=c.result||state.tests.at(-1);
 if(!data)return emptyState({ic:'checklist',title:t('emptyLearned'),body:t('emptyLearnedSub')});
 const s=scoreTest(data);
 return `<section class="result-screen">${progressRing(s.percent,{size:168,stroke:12,label:`${t('score')}: ${s.percent}%`,center:`<strong class="num">${s.percent}<span>%</span></strong><small>${t('score')}</small>`,tone:s.percent>=70?'tone-mint':''})}<h1>${t('testComplete')}</h1><p class="page-sub">${t('testCompleteSub')}</p><div class="stat-strip compact">${stat(s.correct,t('correct'),{ic:'circle-check',tone:'tone-mint'})}${stat(s.total-s.correct,t('incorrect'),{ic:'circle-x',tone:s.total-s.correct?'tone-danger':''})}${stat(s.total,u(state,'question'),{ic:'checklist'})}</div><div class="result-actions">${button(t('returnDashboard'),{action:'go:dashboard',kind:'secondary'})}${button(t('testAgain'),{action:'start-test',ic:'refresh'})}</div></section>
 <section class="panel answer-review">${sectionHeader(t('answerReview'))}<ol class="answer-list">${data.questions.map((q,i)=>{const w=byId(q.id),a=data.answers[i],ans=['fill','audio'].includes(q.type)?a?.value:byId(a?.value)?.[q.type==='meaning'?'translation':'word'];return `<li class="${a?.correct?'is-correct':'is-wrong'}">${icon(a?.correct?'circle-check':'circle-x')}<div><strong lang="en">${esc(w.word)}</strong><span lang="mn">${esc(w.translation)}</span>${!a?.correct?`<small>${t('yourAnswer')}: ${esc(ans||'—')}</small>`:''}</div>${iconButton('volume',t('pronounce'),{action:'speak:'+w.id})}</li>`;}).join('')}</ol></section>`;
}

/** Saved words / learned history (route favorites & history). */
export function wordListView(c,saved){
 const {state,t,search,filter,words}=c,L=k=>u(state,k),ids=saved?state.favorites:Object.keys(state.learned);
 const list=words.filter(w=>ids.includes(w.id)&&(!search||`${w.word} ${w.translation}`.toLowerCase().includes(search.toLowerCase()))&&(filter!=='difficult'||state.difficult.includes(w.id)));
 if(!saved)list.sort((a,b)=>state.learned[b.id].learnedAt-state.learned[a.id].learnedAt);
 const meta=saved?null:w=>`${L('learnedOnShort')} ${c.dateLabel(state.learned[w.id].learnedAt)} · ${t('nextReview')} ${c.dateLabel(state.learned[w.id].dueAt)}`;
 const tabs=tabLinks([{href:'#library',label:L('dictionaryTab'),ic:'book-2'},{href:'#favorites',label:t('favorites'),ic:'heart',active:saved},{href:'#history',label:L('learnedTab'),ic:'clock',active:!saved},{href:'#collections',label:t('p.collections'),ic:'folders'}],{label:L('vocabulary')});
 const body=!ids.length?emptyState({ic:saved?'heart':'book-2',title:t(saved?'emptySaved':'emptyLearned'),body:t(saved?'emptySavedSub':'emptyLearnedSub'),action:button(L('explore'),{href:'#library',iconEnd:'arrow-right'})})
  :!list.length?emptyState({ic:'search',title:t('noResults'),body:L('clearFilters')})
  :vocabList(list,state,{t,meta});
 return `${pageHeader({eyebrow:L('yourWords'),title:t(saved?'favorites':'history'),sub:t(saved?'favoritesSub':'historySub')})}${tabs}<div class="toolbar">${searchInput({id:'search',value:search,placeholder:t('search')})}${segmented([{label:t('all'),action:'filter:all',active:filter==='all',count:ids.length},{label:t('difficult'),action:'filter:difficult',active:filter==='difficult',count:ids.filter(id=>state.difficult.includes(id)).length}],{label:t('search')})}</div><div id="collection-results">${body}</div>`;
}
