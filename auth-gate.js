// Authentication is required before mounting any learning screen or handling its actions.
import {esc, notice, button} from './ui.js';
import {brandMark} from './shell.js';
import {icon} from './icons.js';

export const entryActions = new Set(['a-mode', 'a-password-toggle', 'a-resend-confirm', 'community-claim', 'a-signout', 'pwa-install', 'pwa-update', 'auth-retry']);
export function isEntryAction(action, value) {
  return entryActions.has(action) && (action !== 'a-mode' || ['signIn', 'signUp', 'forgot'].includes(value)) && (action!=='a-password-toggle'||['password','password_repeat'].includes(value));
}
export const isEntryForm = id => ['a-auth-form', 'a-password-form'].includes(id);
export const requiresEntry = (ready, user, recovery = false) => !ready || !user || recovery;

function wordScene(mn){
 return `<div class="entry-scene" aria-hidden="true"><div class="scene-orbit orbit-outer"><span class="orbit-dot"></span></div><div class="scene-orbit orbit-inner"></div><div class="scene-halo"></div>
  <div class="scene-word-tile tile-aa">Aa<span>ENGLISH</span></div><div class="scene-level">A1<span></span>C2${icon('arrow-up-right')}</div>
  <div class="scene-word-card"><div class="word-card-top"><span class="word-card-tag">${icon('sparkles')}${mn?'НЭГ ҮГ. НЭГ АЛХАМ.':'ONE WORD. ONE STEP.'}</span>${icon('volume')}</div><div class="scene-word">grow<span>.</span></div><div class="scene-phonetic">verb <span>·</span> /ɡroʊ/</div><div class="scene-meaning">${mn?'өсөх, хөгжих':'to become a little more'}</div><div class="scene-card-foot"><span>Small steps. Real progress.</span><span class="scene-wave"><i></i><i></i><i></i><i></i><i></i></span></div></div>
  <div class="scene-chip scene-chip-top"><span class="scene-chip-icon">${icon('trending-up')}</span><span>${mn?'Өөрийн хурдаар':'At your own pace'}<small>${mn?'Өдөр бүр бага багаар':'A little, every day'}</small></span></div>
  <div class="scene-chip scene-chip-bottom">${icon('shield-check')}<span>${mn?'Таны ахиц. Таны орон зай.':'Your progress. Your space.'}</span></div>
  <span class="scene-spark spark-one"></span><span class="scene-spark spark-two"></span><span class="scene-spark spark-three"></span></div>`;
}

export function entryView({state, account, ready, error, install, deviceBlocked=false, updateReady=false}) {
  const mn = state.settings.language === 'mn';
  const signup=account.mode==='signUp',recovery=account.recovery||account.mode==='forgot';
  const title = deviceBlocked?(mn?'Төхөөрөмжийн эрх':'Active device'):recovery?(mn?'Шинэ нууц үг, шинэ эхлэл.':'A fresh start.'):signup?(mn?'Таны шинэ эхлэл.':'Your next chapter.'):mn?'Тавтай морил.':'Welcome back.';
  const sub = deviceBlocked?(mn?'Нэг дансыг нэг дор нэг төхөөрөмж дээр ашиглана.':'One account can be active on one device at a time.'):account.recovery?(mn?'Шинэ нууц үгээ тохируулаад үргэлжлүүлээрэй.':'Set a new password to continue.'):recovery?(mn?'Дансныхаа имэйл хаягийг ашиглан нууц үгээ сэргээнэ үү.':'Use your account email to recover your password.'):signup?(mn?'Дансаа үүсгээд, суралцах аяллаа эхлүүлээрэй.':'Make a space for your learning journey.'):mn?'Нэвтрээд, эхлүүлсэн аяллаа үргэлжлүүлээрэй.':'Sign in and pick up where you left off.';
  const message = account.message ? notice(esc(account.message.text), {tone:account.message.tone, role:'status'}) : '';
  let content;
  if (!ready) content = `<div class="skeleton-group" role="status" aria-label="${mn?'Нэвтрэлтийг шалгаж байна':'Checking your session'}"><span class="skeleton"></span><span class="skeleton"></span></div>`;
  else if(deviceBlocked) content=notice(mn?'Таны данс өөр төхөөрөмж дээр идэвхтэй байна. Нэг дор зөвхөн нэг төхөөрөмж ашиглана.':'Your account is active on another device. Only one device can be active at a time.',{tone:'tone-warning',role:'alert'})+button(mn?'Энэ төхөөрөмжийг ашиглах':'Use this device',{action:'community-claim',kind:'secondary'})+button(mn?'Гарах':'Sign out',{action:'a-signout:keep',kind:'ghost'});
  else if (error || !account.configured) content = notice(esc(error || (mn?'Нэвтрэх үйлчилгээ тохируулагдаагүй байна.':'Sign-in is not configured.')), {tone:'tone-danger',role:'alert'}) + button(mn?'Дахин оролдох':'Try again',{action:'auth-retry',kind:'secondary'});
  else content = message + (account.recovery ? account.passwordForm(true) : account.authForm({entry:true}));
  return `<div class="auth-entry ${signup?'entry-signup':''}"><div class="entry-ambient" aria-hidden="true"></div><header class="entry-header"><div class="entry-brand">${brandMark()}<span>English<span class="brand-word"> Words</span></span></div><span class="entry-header-note"><i></i>${mn?'ӨДӨР БҮР НЭГ АЛХАМ УРАГШ':'A LITTLE PROGRESS, EVERY DAY'}</span></header>
  <main id="main" tabindex="-1" class="entry-main"><section class="entry-story" aria-label="English Words"><p class="entry-overline"><span></span>${mn?'АНГЛИ ХЭЛЭЭ ӨӨРИЙН БОЛГО':'MAKE ENGLISH YOUR OWN'}</p><h2 class="entry-statement">${mn?'Шинэ үг.<br><em>Шинэ боломж.</em>':'New words.<br><em>New possibilities.</em>'}</h2><p class="entry-story-copy">${mn?'Ихийг нэг дор биш. Өдөр бүр бага багаар.<br> Өөрийн хурдаар, өөрийн ахицаар.':'Not everything at once. A little, every day.<br> At your own pace. In your own way.'}</p>${wordScene(mn)}<div class="entry-story-footer"><span>${icon('book-2')}${mn?'Үгсээс итгэл рүү.':'From words to confidence.'}</span><span class="entry-footer-line"></span><small>ENGLISH WORDS</small></div></section>
  <div class="entry-form-column"><section class="entry-account" aria-labelledby="entry-title"><div class="entry-card-heading"><span class="entry-welcome-icon">${icon(deviceBlocked?'device-mobile':signup?'user-circle':recovery?'key':'login')}</span><span class="entry-card-kicker">${mn?'ТАНЫ СУРАЛЦАХ ОРОН ЗАЙ':'YOUR SPACE TO GROW'}</span></div><h1 id="entry-title">${title}</h1><p class="muted-copy">${sub}</p>${content}<p class="entry-private">${icon('shield-check')}${mn?'Таны ахиц зөвхөн таны дансанд.':'Your progress stays with your account.'}</p></section>
  <aside class="entry-install" aria-label="${mn?'Апп суулгах заавар':'App installation guide'}"><details><summary><span class="entry-install-icon">${icon('device-mobile')}</span><span><strong>${mn?'Хаана ч, хэзээ ч.':'Take it with you.'}</strong><small>${mn?'Апп суулгах заавар':'How to install the app'}</small></span>${icon('chevron-down')}</summary><div class="entry-install-content">${install}</div></details>${updateReady?button(mn?'Шинэ хувилбарыг ачаалах':'Load the new version',{action:'pwa-update',kind:'secondary',ic:'refresh'}):''}</aside></div></main><footer class="entry-bottom"><span>English Words</span><span>${mn?'Бага алхам. Бодит ахиц.':'Small steps. Real progress.'}</span></footer></div>`;
}
