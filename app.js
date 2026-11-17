import {u} from './labels.js';
import {polishUI,audioFeedback} from './ui-polish.js';
import {recordGrammarMistakes} from './mistakes.js';
import {advancedReminders} from './daily-challenge.js';
import {updateAchievements} from './achievements.js';
import {PlatformUI,platformRoutes} from './platform-ui.js';
import {migrateAdvanced,recordStudyTime} from './advanced-state.js';
import {setCustomWords} from './words.js';
import { widgetPage, detectPlatform } from './widget-ui.js';
import { buildWidgetScript } from './widget-export.js';
import { publishWidget } from './widget-live.js';
import { CommunityUI, deviceLabel } from './community-ui.js';
import {icon} from './icons.js';
import {sidebar,topbar,bottomNav,routeTitle,brandMark} from './shell.js';
import {homeView} from './home.js';
import {initPwa,onPwaChange,pwaState,promptInstall,applyUpdate,swRegistration} from './pwa.js';
import {auth,data,community,cloudConfig} from './cloud.js';
import {createSyncEngine} from './sync.js';
import {AccountUI,syncIcon,syncLabel} from './account-ui.js';
import {learnView,detailView,reviewView,testView,resultsView,wordListView} from './word-ui.js';
import {esc,button,pageHeader,settingRow,switchControl,selectControl,linkRow,notice,iconTile,badge} from './ui.js';
import { lessons } from './grammar-data.js';
import { startGrammar, checkGrammar } from './grammar.js';
import { grammarPage } from './grammar-ui.js';
import { createSpeechPractice } from './speech.js';
import { voicePanel } from './voice-ui.js';
import { validBackup } from './backup.js';
import {words} from './words.js';
import {translator} from './i18n.js';
import {defaults,emptyState,dayKey,ensureDay,pruneNotified,schedule,nextWord,markLearned,dueWords,reviewQueue,reviewWord,streak,validateSettings,rescheduleDay,makeTest,scoreTest,notificationEvents} from './core.js';
const $=s=>document.querySelector(s), KEY='lexi-v1', UI_KEY='english-words-ui';
let state=emptyState(),storageFailed=false,recoveryRaw=null;
try{const raw=localStorage.getItem(KEY);if(raw!==null){const saved=JSON.parse(raw);if(!validBackup(saved))throw Error('invalid');state={...emptyState(),...saved,settings:{...defaults,...saved.settings}};}}catch{storageFailed=true;try{recoveryRaw=localStorage.getItem(KEY);}catch{recoveryRaw='storage unavailable';}}
migrateAdvanced(state);setCustomWords(state.advanced.customWords);
if(state.designVersion!==2){state.settings.theme='dark';state.designVersion=2;}
// Per-device interface conveniences (not learning data, never part of backups).
try{if(JSON.parse(localStorage.getItem(UI_KEY)||'{}').sidebarCollapsed)document.body.classList.add('sidebar-collapsed');}catch{}
let widgetSize='medium',widgetPlatform=detectPlatform(),grammarLevel='',focusSearchNext=false,lastRoute='';
let t=translator(state.settings.language),route=location.hash.slice(1).split('/')[0]||'dashboard',revealed=route==='details',search='',filter='all',reviewSession=null,reviewResult=null,result=null,settingsDirty=false,lastSpoken='',todayKey=dayKey();
const closeNav=()=>{document.body.classList.remove('nav-open');$('.mobile-menu')?.setAttribute('aria-expanded','false');};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(document.body.classList.contains('nav-open')){closeNav();$('.mobile-menu')?.focus();}document.querySelectorAll('details.dropdown[open]').forEach(d=>{d.open=false;d.querySelector('summary')?.focus();});}});
document.addEventListener('click',e=>{if(document.body.classList.contains('nav-open')&&!e.target.closest('.sidebar,.mobile-menu'))closeNav();document.querySelectorAll('details.dropdown[open]').forEach(d=>{if(!d.contains(e.target)||e.target.closest('.menu [data-action]'))d.open=false;});});
const byId=id=>words.find(w=>w.id===id);
const locale=()=>state.settings.language==='mn'?'mn-MN':'en-US';
const dateLabel=(v,options={month:'short',day:'numeric'})=>{const d=new Date(v);if(state.settings.language==='mn')return `${options.year?d.getFullYear()+' он, ':''}${options.weekday?(options.weekday==='long'?['Ням','Даваа','Мягмар','Лхагва','Пүрэв','Баасан','Бямба']:['Ня','Да','Мя','Лх','Пү','Ба','Бя'])[d.getDay()]+', ':''}${d.getMonth()+1}-р сарын ${d.getDate()}`;return d.toLocaleDateString(locale(),options);};
const timeLabel=v=>new Date(v).toLocaleTimeString(locale(),{hour:'2-digit',minute:'2-digit',hour12:false});
const today=()=>ensureDay(state,words);
function persist({quiet=false,fromCloud=false}={}){if(recoveryRaw!==null){storageFailed=true;return;}const earned=quiet?[]:updateAchievements(state);try{localStorage.setItem(KEY,JSON.stringify(state));storageFailed=false;}catch{storageFailed=true;toast(t('storageError'),true);return;}if(!fromCloud)syncEngine?.markDirty(quiet);refreshWidget();if(earned.length)announce(earned);}
/** Replaces the local document with one from the cloud (sync, restore). Validated by the caller. */
function applyState(next,{dirty=false}={}){state={...emptyState(),...JSON.parse(JSON.stringify(next)),designVersion:2};migrateAdvanced(state);setCustomWords(state.advanced.customWords);reviewSession=null;reviewResult=null;result=null;recoveryRaw=null;persist({quiet:true,fromCloud:!dirty});if(!settingsDirty)render();}
function resetLocal(){const fresh=emptyState();fresh.settings={...state.settings};fresh.designVersion=2;applyState(fresh,{dirty:false});}
function deviceId(){try{const ui=JSON.parse(localStorage.getItem(UI_KEY)||'{}');if(ui.deviceId)return ui.deviceId;const id=(crypto.randomUUID?.()||String(Date.now())).slice(0,36);saveUI({deviceId:id});return id;}catch{return null;}}
function announce(earned){const b=earned[0];setTimeout(()=>toast(`${u(state,'achievementUnlocked')}: ${b.target} · ${t('p.'+b.category)}${earned.length>1?` (+${earned.length-1})`:''}`,false,'trophy'),60);}
function toast(message,error=false,ic=''){const e=$('#toast');e.innerHTML=`${icon(ic||(error?'alert-circle':'circle-check'))}<span>${esc(message)}</span>`;e.className='show'+(error?' error':'');clearTimeout(toast.timer);toast.timer=setTimeout(()=>e.className='',error?12000:4000);}
function go(name){if(settingsDirty&&!confirm(t('unsaved')))return;settingsDirty=false;if(location.hash==='#'+name){route=name.split('/')[0];render();}else location.hash=name;}
function ctx(){return {state,t,byId,words,revealed,voiceResult,platform,timeLabel,dateLabel,countdown,today,reviewSession,reviewResult,result,search,filter,detailId};}
function render(){
 if(voicePractice.isListening()){voicePractice.stop(true);voiceResult={...voiceResult,status:'stopped'};}
 t=translator(state.settings.language);document.documentElement.lang=state.settings.language;document.documentElement.dataset.theme=state.settings.theme;document.body.classList.toggle('compact',state.settings.compact);
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',state.settings.theme==='light'?'#FCF0DA':'#202734');
 const views={...Object.fromEntries(platformRoutes.map(name=>[name,()=>platform.view(name)])),widget:()=>widgetPage(state,{t,esc,timeLabel},widgetSize,widgetPlatform),library:()=>platform.dictionary(),grammar:()=>grammarPage(state,{t,esc,dateLabel,level:grammarLevel}),dashboard:()=>homeView(state,today(),{t,timeLabel,dateLabel,countdown,persist,byId,locale:locale()}),learn:()=>learnView(ctx()),review:()=>reviewView(ctx()),test:()=>testView(ctx()),favorites:()=>wordListView(ctx(),true),history:()=>wordListView(ctx(),false),statistics:()=>platform.progress.overview(),settings:settingsPage,account:()=>accountUI.view(),leaderboard:()=>communityUI.view(),notifications:notificationsPage,results:()=>resultsView(ctx()),details:()=>detailView(ctx())};
 if(!views[route])route='dashboard';
 document.body.dataset.page=route;
 const focusMode=(route==='review'&&reviewSession)||(route==='test'&&state.activeTest)||(route==='practice'&&platform.practice.question);
 document.body.classList.toggle('focus-mode',Boolean(focusMode));
 const notices=`${storageFailed?notice(`${t(recoveryRaw!==null?'p.recovery':'storageError')}${recoveryRaw!==null?' '+button(t('p.recoverDownload'),{action:'recovery-export',kind:'secondary',size:'sm',ic:'download'}):''}`,{tone:'tone-danger',ic:'alert-triangle',role:'alert'}):''}${!navigator.onLine?notice(`<strong>${u(state,'offlineTitle')}</strong> ${t('p.offline')}`,{ic:'wifi-off',role:'status'}):''}`;
 const entering=route!==lastRoute;lastRoute=route;
 $('#app').innerHTML=`${sidebar(state,route,{t,day:today()})}<div class="nav-scrim" aria-hidden="true"></div><div class="workspace">${topbar(state,route,{t,title:routeTitle(route,state,t),dateText:dateLabel(Date.now(),{weekday:'short',month:'short',day:'numeric'}),sync:cloudEnabled?syncView():null})}<main id="main" tabindex="-1"><div class="page${entering?' page-enter':''}">${notices}${views[route]()}</div></main></div>${bottomNav(state,route,{t})}${pwaState().updateReady?`<div class="update-banner" role="status">${icon('sparkles')}<span>${u(state,'updateReady')}</span>${button(u(state,'reloadUpdate'),{action:'pwa-update',size:'sm',ic:'refresh'})}</div>`:''}<dialog id="confirm-dialog" class="modal" aria-labelledby="confirm-title"><div class="modal-body">${iconTile('alert-triangle','speaking',{size:'lg'})}<h2 id="confirm-title">${t('reset')}</h2><p>${t('resetConfirm')}</p><div class="form-actions">${button(t('cancel'),{action:'cancel-reset',kind:'secondary'})}${button(t('confirm'),{action:'confirm-reset',kind:'danger'})}</div></div></dialog>`;
 polishUI($('#app'),state,t);
 if(route==='learn'){const item=nextWord(state,today());if(item&&state.settings.autoSpeak&&lastSpoken!==item.id){lastSpoken=item.id;speak(byId(item.id).word);}}
 if(focusSearchNext){focusSearchNext=false;$('#p-query')?.focus();}
}
function countdown(at){let s=Math.max(0,Math.ceil((at-Date.now())/1000));return `${String(Math.floor(s/3600)).padStart(2,'0')}:${String(Math.floor(s/60)%60).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;}
let detailId=location.hash.slice(1).split('/')[1]||null;
function field(label,name,type='number',min='',max=''){return settingRow(t(label),`<input class="input ${type==='time'?'time':'num-input'}" name="${name}" type="${type}" value="${esc(state.settings[name])}" ${type==='number'?`min="${min}" max="${max}" step="1" inputmode="numeric"`:''} required>`);}
function toggle(label,name,help=''){return settingRow(t(label),switchControl(name,state.settings[name]),{help:help?t(help):''});}
function settingsPage(){const L=k=>u(state,k),sections=[['account','cloud',L('account')],['install','apps',L('installApp')],['appearance','palette',L('appearance')],['learning','book-2',t('learningSettings')],['reminders','bell',L('reminders')],['goals','target',t('p.goals')],['widget','device-mobile',t('widget')],['backup','database-export',L('backup')],['data','adjustments-horizontal',L('dataManagement')],['about','info-circle',L('about')]];
 const themeControl=`<span class="segmented" role="radiogroup" aria-label="${esc(t('theme'))}">${[['dark','moon'],['light','sun']].map(([v,ic])=>`<label class="${state.settings.theme===v?'active':''}"><input type="radio" class="sr-only" name="theme" value="${v}" ${state.settings.theme===v?'checked':''}>${icon(ic)}<span>${t(v)}</span></label>`).join('')}</span>`;
 return `${pageHeader({title:t('settings'),sub:t('settingsSub')})}<div class="settings-layout"><nav class="settings-nav" aria-label="${esc(t('settings'))}">${sections.map(([id,ic,label])=>`<a href="#settings" data-action="scroll-to:${id}">${icon(ic)}<span>${label}</span></a>`).join('')}</nav><div class="settings-content">
  <section class="profile-row">${brandMark()}<div><strong>${L('localProfile')}</strong><small>${t('localOnly')}</small></div><dl class="profile-stats"><div><dt>${t('words')}</dt><dd class="num">${Object.keys(state.learned).length}</dd></div><div><dt>${t('streak')}</dt><dd class="num">${streak(state)}</dd></div><div><dt>${t('testsTaken')}</dt><dd class="num">${state.tests.length}</dd></div></dl></section>
  ${accountSummary()}${installSection()}<form id="settings-form">
   <section class="settings-group" id="set-appearance"><h2 class="group-title">${L('appearance')}</h2><div class="group-body">${settingRow(t('language'),selectControl('language',[['mn','Монгол хэл'],['en','English']],state.settings.language,{label:t('language')}),{help:t('languageHelp')})}${settingRow(t('theme'),themeControl,{tag:'div'})}${toggle('compact','compact','compactHelp')}</div></section>
   <section class="settings-group" id="set-learning"><h2 class="group-title">${t('learningSettings')}</h2><div class="group-body">${field('target','dailyTarget','number',1,20)}${field('startTime','startTime','time')}${field('interval','interval','number',1,180)}${toggle('autoSpeak','autoSpeak','autoSpeakHelp')}<p class="group-note">${icon('info-circle')}${t('scheduleUpdated')}</p></div></section>
   <section class="settings-group" id="set-reminders"><h2 class="group-title">${L('reminders')}</h2><div class="group-body">${field('reviewTime','reviewTime','time')}${field('testTime','testTime','time')}${linkRow('#notifications',L('manageNotifications'),{ic:'bell',meta:t(state.settings.notifications?'granted':'notificationsOff')})}</div></section>
   <div id="settings-error" role="alert"></div>
   <div class="save-bar">${button(t('saveSettings'),{ic:'check'})}</div>
  </form>
  <section class="settings-group" id="set-goals"><h2 class="group-title">${t('p.goals')}</h2><div class="group-body">${linkRow('#goals',t('p.goals'),{ic:'target',help:L('goalsHelp')})}</div></section>
  <section class="settings-group" id="set-widget"><h2 class="group-title">${t('widget')}</h2><div class="group-body">${linkRow('#widget',t('widget'),{ic:'device-mobile',help:L('widgetHelp')})}</div></section>
  <section class="settings-group" id="set-backup"><h2 class="group-title">${L('backup')}</h2><div class="group-body"><div class="setting-row"><span class="setting-icon">${icon('database-export')}</span><span class="setting-copy"><strong>${t('localData')}</strong><small>${t('localDataSub')}</small></span><span class="setting-control">${button(t('export'),{action:'export',kind:'secondary',size:'sm',ic:'download'})}<label class="btn secondary sm file-button">${icon('upload')}<span>${t('import')}</span><input id="import" class="sr-only" type="file" accept="application/json,.json"></label></span></div><p class="group-note">${icon('alert-triangle')}${t('backupWarning')}</p>${linkRow('#import',t('p.import'),{ic:'file-import',help:L('importHelp')})}</div></section>
  <section class="settings-group" id="set-data"><h2 class="group-title">${L('dataManagement')}</h2><div class="group-body"><div class="setting-row"><span class="setting-icon">${icon('arrow-back-up')}</span><span class="setting-copy"><strong>${t('reset')}</strong><small>${L('resetHelp')}</small></span><span class="setting-control">${button(t('reset'),{action:'reset',kind:'danger-ghost',size:'sm'})}</span></div></div></section>
  <section class="settings-group" id="set-about"><h2 class="group-title">${L('about')}</h2><div class="group-body about-body">${brandMark()}<div><strong>English Words</strong><p>${L('aboutText')}</p><small>${L('credits')}</small></div></div></section>
 </div></div>`;}
function permission(){return 'Notification' in window?Notification.permission:'unsupported';}
function notificationsPage(){const p=permission(),tone={granted:'tone-mint',denied:'tone-danger',default:'tone-warning',unsupported:''}[p];
 return `<a class="back-link" href="#settings">${icon('arrow-left')}<span>${t('settings')}</span></a>${pageHeader({title:t('notificationTitle'),sub:t('notificationSub')})}<div class="settings-content narrow">
  <section class="permission-panel">${iconTile('bell','listening')}<div><strong>${t('permission')}</strong><p>${t('permissionHelp')}</p></div>${badge(t(p),tone)}${p==='default'?button(t('enable'),{action:'permission',kind:'secondary',size:'sm'}):''}${p==='granted'?button(u(state,'testNotification'),{action:'notify-test',kind:'secondary',size:'sm',ic:'bell'}):''}</section>
  <form id="notification-form">
   <section class="settings-group"><div class="group-body">${toggle('master','notifications','masterHelp')}</div></section>
   <section class="settings-group"><h2 class="group-title">${t('scheduleSettings')}</h2><div class="group-body">${toggle('newNotify','newNotifications')}${field('startTime','startTime','time')}${toggle('reviewNotify','reviewNotifications')}${field('reviewTime','reviewTime','time')}${toggle('testNotify','testNotifications')}${field('testTime','testTime','time')}</div></section>
   <section class="settings-group"><h2 class="group-title">${u(state,'reminders')}</h2><div class="group-body">${toggle('sound','sound')}${toggle('vibration','vibration')}${linkRow('#tools',u(state,'extraReminders'),{ic:'bolt'})}</div></section>
   <div id="settings-error" role="alert"></div><div class="save-bar">${button(t('saveSettings'),{ic:'check'})}</div>
  </form>${notice(t('notificationLimit'))}</div>`;}
async function speak(word,rate=.85,onStarted=null){voicePractice.stop();if(!('speechSynthesis' in window)){toast(t('unsupportedAudio'),true);return;}speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(word);utterance.lang='en-US';utterance.onstart=()=>{audioFeedback(true,state);onStarted?.();};utterance.onend=()=>audioFeedback(false,state);utterance.rate=rate;const voice=speechSynthesis.getVoices().find(v=>v.lang.startsWith('en'));if(voice)utterance.voice=voice;utterance.onerror=e=>{audioFeedback(false,state);if(!['interrupted','canceled'].includes(e.error))toast(t('audioError'),true);};speechSynthesis.speak(utterance);}
function toggleArray(name,id){const a=state[name],index=a.indexOf(id);if(index===-1)a.push(id);else a.splice(index,1);persist();render();}
/** Pushes today's card to the Windows 11 Widgets Board, at most once a second. Does nothing on
 *  browsers without widgets, which today means every browser except Edge on Windows 11. */
let widgetTimer=null;
function refreshWidget(){clearTimeout(widgetTimer);widgetTimer=setTimeout(()=>{
 publishWidget(state,words,{ready:t('newWords'),waiting:t('nextWord'),done:t('done'),waitingSub:t('waitingSub'),doneSub:t('allDoneSub'),open:u(state,'continue'),review:u(state,'review'),time:timeLabel});
},1000);}
/** Shows one notification through the service worker when there is one (so it survives a closed
 *  tab) and through the page otherwise. Returns false when the browser refused it. */
async function pushNotification(title,options){try{const reg=swRegistration();if(reg)await reg.showNotification(title,options);else new Notification(title,options);if(state.settings.vibration&&navigator.vibrate)navigator.vibrate([120,60,120]);return true;}catch{return false;}}
async function requestPermission(){if(!('Notification' in window)){toast(t('unsupported'),true);return;}try{await Notification.requestPermission();render();}catch{toast(t('permissionHelp'),true);}}
function saveUI(patch){try{localStorage.setItem(UI_KEY,JSON.stringify({...JSON.parse(localStorage.getItem(UI_KEY)||'{}'),...patch}));}catch{}}
document.addEventListener('click',async e=>{const el=e.target.closest('[data-action]');if(!el)return;const [action,value]=el.dataset.action.split(':');
 if(action==='recovery-export'){downloadFile(recoveryRaw,'english-words-recovery.txt','text/plain');return;}
 if(action==='collapse-sidebar'){const collapsed=document.body.classList.toggle('sidebar-collapsed');el.setAttribute('aria-expanded',String(!collapsed));saveUI({sidebarCollapsed:collapsed});return;}
 if(action==='theme-toggle'){if(settingsDirty&&!confirm(t('unsaved')))return;settingsDirty=false;state.settings.theme=state.settings.theme==='light'?'dark':'light';persist();render();$('[data-action="theme-toggle"]')?.focus();return;}
 if(action==='focus-search'){if(route==='dictionary'||route==='library'){e.preventDefault();$('#p-query')?.focus();}else focusSearchNext=true;return;}
 if(action==='scroll-to'){e.preventDefault();$('#set-'+value)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});return;}
 if(action==='grammar-level'){grammarLevel=value;render();$(`[data-action="grammar-level:${value}"]`)?.focus();return;}
 if(action==='notify-test'){if(permission()!=='granted'){await requestPermission();return;}
  const ok=await pushNotification('English Words',{body:t('notificationBody'),icon:'./icon.svg',tag:'english-words-test',silent:!state.settings.sound,data:{url:'./#dashboard'}});
  toast(ok?u(state,'testSent'):t('permissionHelp'),!ok);return;}
 if(action==='pwa-install'){const outcome=await promptInstall();if(outcome==='accepted')toast(u(state,'installed'));render();return;}
 if(action==='pwa-update'){if(settingsDirty&&!confirm(t('unsaved')))return;settingsDirty=false;persist({quiet:true});applyUpdate();return;}
 if(await communityUI.click(action,value))return;
 if(await accountUI.click(action,value))return;
 if(await platform.click(action,value))return;
 if(action==='go'){if(value!=='review'){reviewResult=null;}go(value);}
 else if(action==='menu'){const open=document.body.classList.toggle('nav-open');el.setAttribute('aria-expanded',String(open));if(open)document.querySelector('.sidebar a')?.focus();}
 else if(action==='reveal'){revealed=!revealed;render();}
 else if(action==='speak')speak(byId(value).word);
 else if(action==='slow')speak(byId(value).word,.6);
 else if(action==='word-example')speak(byId(value).example);
 else if(action==='word-usage')speak(byId(value).usage);
 else if(action==='word-full'){const word=byId(value);speak(word.word+'. '+word.example+' '+word.usage);}
 else if(action==='audio-stop'){window.speechSynthesis?.cancel();audioFeedback(false,state);}
 else if(action==='mic-start'){voiceWordId=value;voicePractice.start(byId(value).word);}
 else if(action==='mic-stop')voicePractice.stop();
 else if(action==='grammar-start'){startGrammar(state);persist();render();}
 else if(action==='grammar-audio'){const lesson=lessons.find(item=>item.id===value);if(lesson)speak(lesson.example);}
 else if(action==='grammar-retry'){if(state.grammar){delete state.grammar.attempts[value];persist();render();}}
 else if(action==='favorite')toggleArray('favorites',value);
 else if(action==='difficult')toggleArray('difficult',value);
 else if(action==='detail'){detailId=value;revealed=true;go('details/'+value);}
 else if(action==='learned'){if(nextWord(state,today())?.id!==value)return;markLearned(state,value);persist();revealed=false;render();toast(t('learned')+': '+byId(value).word);}
 else if(action==='filter'){filter=value;render();}
 else if(action==='widget-size'){widgetSize=value==='small'?'small':'medium';render();}
 else if(action==='widget-platform'){widgetPlatform=['ios','android','windows'].includes(value)?value:'windows';render();$(`[data-action="widget-platform:${widgetPlatform}"]`)?.focus();}
 else if(action==='widget-download'){
  const script=buildWidgetScript(state),url=URL.createObjectURL(new Blob([script],{type:'text/javascript;charset=utf-8'}));
  const link=document.createElement('a');link.href=url;link.download='English Words.js';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(t('widgetDownloaded'));
 }
 else if(action==='widget-code'||action==='widget-copy'){
  const script=buildWidgetScript(state);
  if(action==='widget-copy'){try{await navigator.clipboard.writeText(script);toast(t('widgetCopied'));return;}catch{toast(t('widgetCopyFailed'),true);}}
  const panel=document.querySelector('#widget-code-panel'),input=document.querySelector('#widget-source');panel.hidden=false;input.value=script;input.focus();input.select();
 }
 else if(action==='start-review'){reviewSession={ids:reviewQueue(state,words),index:0,correct:0};reviewResult=null;revealed=false;render();}
 else if(action==='review-answer'){if(!reviewSession||!revealed)return;reviewWord(state,reviewSession.ids[reviewSession.index],value==='1');reviewSession.correct+=Number(value);reviewSession.index++;if(reviewSession.index===reviewSession.ids.length){reviewResult={correct:reviewSession.correct,total:reviewSession.ids.length};reviewSession=null;}persist();revealed=false;render();}
 else if(action==='start-test'){state.activeTest=makeTest(words,Object.keys(state.learned));result=null;persist();go('test');}
 else if(action==='next-question'){const a=state.activeTest;if(!a?.answers[a.index])return;if(a.index===a.questions.length-1){a.finishedAt=Date.now();state.tests.push(a);result=a;state.activeTest=null;persist();go('results');}else{a.index++;persist();render();}}
 else if(action==='result'){result=state.tests.find(x=>x.finishedAt===Number(value));go('results');}
 else if(action==='reset')$('#confirm-dialog').showModal();
 else if(action==='cancel-reset')$('#confirm-dialog').close();
 else if(action==='confirm-reset'){state.settings={...defaults};rescheduleDay(state,words);settingsDirty=false;persist();render();toast(t('saved'));}
 else if(action==='permission')await requestPermission();
 else if(action==='export'){const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`lexi-backup-${dayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast(t('downloaded'));}
});
document.addEventListener('submit',async e=>{e.preventDefault();if(await communityUI.submit(e.target))return;if(await accountUI.submit(e.target))return;if(await platform.submit(e.target))return;if(e.target.id==='grammar-form'){
 const id=e.target.dataset.lesson,lesson=lessons.find(item=>item.id===id);if(!lesson)return;
 const data=new FormData(e.target),answers=lesson.questions.map((_,i)=>data.has('q'+i)?Number(data.get('q'+i)):-1);
 if(checkGrammar(state,id,answers)){recordGrammarMistakes(state,lessons.find(l=>l.id===id),state.grammar.attempts[id]);persist();render();document.querySelector('.lesson-exercises .feedback')?.scrollIntoView({block:'center'});}return;
 }if(e.target.id==='test-form'){const a=state.activeTest,q=a.questions[a.index];if(a.answers[a.index])return;const value=new FormData(e.target).get('answer')?.trim();if(!value)return;const correct=['fill','audio'].includes(q.type)?value.toLowerCase()===byId(q.id).word.toLowerCase():value===q.id;a.answers.push({value,correct});persist();render();$('[data-action="next-question"]')?.focus();return;}
 if(['settings-form','notification-form'].includes(e.target.id)){const form=e.target,fd=new FormData(form),old=state.settings,s={...old};for(const [key,val]of fd)s[key]=['dailyTarget','interval'].includes(key)?Number(val):val;for(const input of form.querySelectorAll('input[type="checkbox"]'))s[input.name]=input.checked;if(!validateSettings(s)){$('#settings-error').innerHTML=notice(t('invalidSettings'),{tone:'tone-danger',ic:'alert-triangle'});return;}state.settings=s;if(s.startTime!==old.startTime||s.interval!==old.interval||s.dailyTarget!==old.dailyTarget)rescheduleDay(state,words);settingsDirty=false;persist();if(s.notifications&&!old.notifications&&permission()==='default')await requestPermission();render();toast(t('saved'));}
});
document.addEventListener('input',e=>{if(communityUI.input(e.target))return;if(e.target.name==='email'&&e.target.closest('#a-auth-form')){accountUI.draftEmail=e.target.value;return;}if(platform.input(e.target))return;if(e.target.id==='search'){search=e.target.value;const start=e.target.selectionStart;render();const input=$('#search');input.focus();input.setSelectionRange(start,start);}else if(e.target.closest('#settings-form,#notification-form'))settingsDirty=true;});
document.addEventListener('change',async e=>{if(e.target.name==='theme'&&e.target.closest('#settings-form')){e.target.closest('.segmented').querySelectorAll('label').forEach(l=>l.classList.toggle('active',l.contains(e.target)));}if(platform.input(e.target))return;if(e.target.closest('#settings-form,#notification-form'))settingsDirty=true;if(e.target.id==='import'){try{const file=e.target.files[0];if(!file)return;if(file.size>5000000)throw Error();const data=JSON.parse(await file.text());if(!validBackup(data))throw Error();if(!confirm(t('importConfirm')))return;state={...emptyState(),...data,designVersion:2};migrateAdvanced(state);setCustomWords(state.advanced.customWords);recoveryRaw=null;reviewSession=null;reviewResult=null;result=null;settingsDirty=false;persist();render();toast(t('imported'));}catch{toast(t('importError'),true);}}});
window.addEventListener('hashchange',()=>{const target=location.hash.slice(1);if(settingsDirty&&!confirm(t('unsaved'))){history.replaceState(null,'','#'+route);return;}settingsDirty=false;route=target.split('/')[0];if(route==='details')detailId=target.split('/')[1]||detailId;revealed=route==='details';search='';filter='all';reviewResult=null;closeNav();render();window.scrollTo(0,0);});
window.addEventListener('beforeunload',e=>{if(settingsDirty){e.preventDefault();e.returnValue='';}});
window.addEventListener('storage',e=>{if(e.key!==KEY||!e.newValue)return;try{const data=JSON.parse(e.newValue);if(validBackup(data)){state={...emptyState(),...data,designVersion:2};migrateAdvanced(state);setCustomWords(state.advanced.customWords);if(!settingsDirty)render();}}catch{}});
function downloadFile(data,name,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const platform=new PlatformUI({state:()=>state,t:()=>t,render,persist,toast,esc,dateLabel,speak,go,download:downloadFile,openWord(id){detailId=id;revealed=true;go('details/'+id);}});
window.addEventListener('online',()=>{syncEngine?.syncNow();if(!settingsDirty)render();});window.addEventListener('offline',()=>{if(!settingsDirty)render();});
let voiceResult={status:'idle'},voiceWordId=null;
const voicePractice=createSpeechPractice({scope:window,onChange(result){
 voiceResult={...result,wordId:voiceWordId};if(result.status==='result'){state.advanced.speaking.push({id:crypto.randomUUID(),wordId:voiceWordId,at:Date.now(),matched:result.matched});persist();}
 const panel=document.querySelector('[data-voice-panel]');
 if(panel&&panel.dataset.voicePanel===voiceWordId)panel.innerHTML=voicePanel(byId(voiceWordId),voiceResult,{t,esc});
}});
window.addEventListener('pagehide',()=>{voicePractice.stop(true);window.speechSynthesis?.cancel();});
initPwa();onPwaChange(()=>{if(!settingsDirty)render();});
// ---------- cloud account & sync (inactive unless the build has Supabase configuration) ----------
let cloudEnabled=false,cloudStarted=false;
const communityUI=new CommunityUI({state:()=>state,t:()=>t,render:()=>{if(!settingsDirty)render();},deviceId,sync:()=>syncEngine,dateLabel});
const accountUI=new AccountUI({state:()=>state,t:()=>t,render:()=>{if(!settingsDirty)render();},toast,persist,applyState,resetLocal,download:downloadFile,dateLabel,timeLabel,sync:()=>syncEngine});
const syncEngine=createSyncEngine({api:{fetchState:()=>data.fetchState(),pushState:(s,b)=>data.pushState(s,b,deviceId()),createBackup:(s,r,l)=>data.createBackup(s,r,l)},getState:()=>state,applyState:s=>applyState(s),validate:validBackup,onChange:snap=>{const el=document.querySelector('.sync-indicator');if(el){el.outerHTML=syncButton(snap);}if(route==='account'&&!document.activeElement?.matches?.('input,textarea')&&!settingsDirty)render();}});
function syncButton(snap=syncEngine.snapshot()){const s=snap.status,label=u(state,syncLabel[s]||'localOnlyState');return `<a class="icon-btn sync-indicator is-${s}" href="#account" aria-label="${esc(label)}" data-tooltip="${esc(label)}">${icon(syncIcon[s]||'cloud')}</a>`;}
function syncView(){return syncButton();}
function accountSummary(){if(!cloudEnabled)return `<section class="settings-group" id="set-account"><h2 class="group-title">${u(state,'account')}</h2><div class="group-body">${linkRow('#account',u(state,'localOnlyState'),{ic:'cloud-off',help:u(state,'cloudOff')})}</div></section>`;const snap=syncEngine.snapshot(),L=k=>u(state,k);return `<section class="settings-group" id="set-account"><h2 class="group-title">${L('account')}</h2><div class="group-body">${linkRow('#account',snap.user?esc(snap.user.email):L('guestTitle'),{ic:syncIcon[snap.status]||'cloud',help:snap.user?L(syncLabel[snap.status]||'synced'):L('signIn')+' · '+L('signUp'),meta:snap.user&&snap.lastSyncedAt?timeLabel(snap.lastSyncedAt):''})}</div></section>`;}
function installSection(){const p=pwaState(),L=k=>u(state,k),steps=(title,items,ic)=>`<div class="install-steps"><h3>${icon(ic)}${title}</h3><ol>${items.map(k=>`<li>${L(k)}</li>`).join('')}</ol></div>`;
 return `<section class="settings-group" id="set-install"><h2 class="group-title">${L('installApp')}</h2><div class="group-body"><div class="setting-row"><span class="setting-icon">${icon(p.installed?'circle-check':'apps')}</span><span class="setting-copy"><strong>${L(p.installed?'installed':'installApp')}</strong><small>${L(p.installed?'installedHelp':'installHelp')}</small></span><span class="setting-control">${p.installed?badge(L('installed'),'tone-mint'):p.canPrompt?button(L('installNow'),{action:'pwa-install',size:'sm',ic:'download'}):''}</span></div>
  ${p.installed?'':`<div class="install-guide">${steps(L('iosTitle'),['ios1','ios2','ios3','ios4'],'device-mobile')}${steps(L('androidTitle'),['android1','android2'],'device-mobile')}${steps(L('desktopTitle'),['desktop1'],'device-desktop')}</div><p class="group-note">${icon('info-circle')}${L('iosNote')}</p>`}</div></section>`;}
/** One account, one active device: signing in here takes the account over, and the device that had
 *  it finds out on its next push (the database refuses it) and can take it back from the Players
 *  screen. Failures are not fatal — learning keeps working without the community features. */
async function claimThisDevice(){
 try{await community.claimDevice(deviceId(),deviceLabel());await community.syncProfile();}
 catch(e){console.warn('Device claim unavailable:',e?.message||e);}
}
async function startCloud(){if(cloudStarted)return;cloudStarted=true;try{const session=await auth.session();syncEngine.setUser(session?.user||null);await auth.onChange((event,session)=>{if(event==='PASSWORD_RECOVERY'){accountUI.recovery=true;if(route!=='account')go('account');}if(event==='SIGNED_OUT')syncEngine.setUser(null);else if(session?.user)syncEngine.setUser(session.user);if(event==='SIGNED_IN'){accountUI.backups=null;accountUI.message=null;communityUI.board=null;claimThisDevice();}if(!settingsDirty)render();});}catch(e){cloudStarted=false;console.warn('Cloud sync unavailable:',e?.message||e);}}
cloudConfig().then(cfg=>{cloudEnabled=Boolean(cfg);if(!cfg)return;
 // Load the cloud client only for signed-in devices, auth redirects, or when the account page is opened.
 const hasSession=(()=>{try{return Boolean(localStorage.getItem('english-words-auth'));}catch{return false;}})();
 if(hasSession||/[?&](code|error_description)=/.test(location.search)||['account','leaderboard'].includes(route))startCloud().then(()=>{if(route==='leaderboard')communityUI.load();});
 if(!settingsDirty)render();});
window.addEventListener('hashchange',()=>{if(cloudEnabled&&/^#(account|leaderboard)/.test(location.hash)){startCloud();communityUI.load();}});
setInterval(()=>{if(!document.hidden&&syncEngine.snapshot().user&&syncEngine.snapshot().dirty)syncEngine.syncNow();},120000);
async function notifyTick(){const events=[...notificationEvents(state,today()),...advancedReminders(state)];if(!events.length||permission()!=='granted')return;for(const event of events){const deliver=async()=>{if(state.notified.includes(event.key))return;state.notified.push(event.key);persist();if(event.stale)return;const title=`English Words · ${t(event.type==='learn'?'newWords':['goals','challenges'].includes(event.type)?'p.'+event.type:event.type)}`,options={body:t('notificationBody'),icon:'./icon.svg',tag:event.key,silent:!state.settings.sound,data:{url:`./#${event.type}`}};if(!await pushNotification(title,options))toast(t('permissionHelp'),true);};if(navigator.locks)await navigator.locks.request('lexi-notifications',async()=>{try{const fresh=JSON.parse(localStorage.getItem(KEY));if(fresh?.notified)state.notified=[...new Set([...state.notified,...fresh.notified])];}catch{}await deliver();});else await deliver();}}
setInterval(()=>{if(dayKey()!==todayKey){todayKey=dayKey();ensureDay(state,words);pruneNotified(state);persist();render();}document.querySelectorAll('[data-until]').forEach(el=>{el.textContent=countdown(Number(el.dataset.until));if(Number(el.dataset.until)<=Date.now())render();});notifyTick();},1000);
document.addEventListener('visibilitychange',()=>{if(!document.hidden){ensureDay(state,words);if(!settingsDirty)render();notifyTick();}});
ensureDay(state,words);pruneNotified(state);persist();render();

for(const type of ['dragstart','dragover','drop'])document.addEventListener(type,event=>platform.practice.drag(event));

let lastActive=Date.now(),lastSample=Date.now();for(const name of ['pointerdown','keydown','scroll'])document.addEventListener(name,()=>lastActive=Date.now(),{passive:true});setInterval(()=>{const now=Date.now(),seconds=Math.min(15,(now-lastSample)/1000);lastSample=now;if(!document.hidden&&document.hasFocus()&&now-lastActive<60000){recordStudyTime(state,route,seconds,now);persist({quiet:true});}},15000);

document.addEventListener('change',e=>{if(e.target.id==='vocab-file')platform.importer.file(e.target.files[0]);});document.addEventListener('dragover',e=>{if(e.target.closest('#vocab-drop')){e.preventDefault();e.target.closest('#vocab-drop').classList.add('is-over');}});document.addEventListener('dragleave',e=>{if(e.target.closest('#vocab-drop'))e.target.closest('#vocab-drop').classList.remove('is-over');});document.addEventListener('drop',e=>{if(e.target.closest('#vocab-drop')){e.preventDefault();platform.importer.file(e.dataTransfer.files[0]);}});

document.addEventListener('click',event=>{if(event.target.closest('[data-skip-main]')){event.preventDefault();document.querySelector('#main')?.focus();}});
document.addEventListener('keydown',event=>{if(event.key==='Tab'&&document.body.classList.contains('nav-open')){const links=[...document.querySelectorAll('.sidebar a,.sidebar button')].filter(el=>el.getClientRects().length),first=links[0],last=links.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}});
// Keyboard shortcuts: "/" search, Space reveal, 1/2 answer during review.
document.addEventListener('keydown',event=>{
 const target=event.target,typing=target.closest?.('input,textarea,select,[contenteditable="true"]');if(typing||event.metaKey||event.ctrlKey||event.altKey||document.querySelector('dialog[open]'))return;
 if(event.key==='/'){event.preventDefault();if(route==='dictionary'||route==='library')$('#p-query')?.focus();else{focusSearchNext=true;go('library');}return;}
 const onControl=target.closest?.('button,a,summary,label');
 if((event.key===' '||event.key==='Enter')&&!onControl&&!revealed&&((route==='review'&&reviewSession)||(route==='learn'&&nextWord(state,today())))){event.preventDefault();revealed=true;render();return;}
 if(route==='review'&&reviewSession&&revealed&&['1','2'].includes(event.key)){event.preventDefault();$(`[data-action="review-answer:${event.key==='2'?1:0}"]`)?.click();}
});
