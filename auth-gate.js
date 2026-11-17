// Authentication is required before mounting any learning screen or handling its actions.
import {esc, notice, button} from './ui.js';
import {brandMark} from './shell.js';

export const entryActions = new Set(['a-mode', 'pwa-install', 'pwa-update', 'auth-retry']);
export function isEntryAction(action, value) {
  return entryActions.has(action) && (action !== 'a-mode' || ['signIn', 'signUp', 'forgot'].includes(value));
}
export const isEntryForm = id => ['a-auth-form', 'a-password-form'].includes(id);
export const requiresEntry = (ready, user, recovery = false) => !ready || !user || recovery;

export function entryView({state, account, ready, error, install}) {
  const mn = state.settings.language === 'mn';
  const title = mn ? 'Тавтай морил' : 'Welcome';
  const sub = mn ? 'Үргэлжлүүлэхийн тулд нэвтрэх эсвэл бүртгүүлнэ үү.' : 'Sign in or create an account to continue.';
  const message = account.message ? notice(esc(account.message.text), {tone:account.message.tone, role:'status'}) : '';
  let content;
  if (!ready) content = `<div class="skeleton-group" role="status" aria-label="${mn?'Нэвтрэлтийг шалгаж байна':'Checking your session'}"><span class="skeleton"></span><span class="skeleton"></span></div>`;
  else if (error || !account.configured) content = notice(esc(error || (mn?'Нэвтрэх үйлчилгээ тохируулагдаагүй байна.':'Sign-in is not configured.')), {tone:'tone-danger',role:'alert'}) + button(mn?'Дахин оролдох':'Try again',{action:'auth-retry',kind:'secondary'});
  else content = message + (account.recovery ? account.passwordForm(true) : account.authForm({entry:true}));
  return `<div class="auth-entry"><header class="entry-brand">${brandMark()}<span>English Words</span></header><main id="main" tabindex="-1" class="entry-main"><section class="entry-account" aria-labelledby="entry-title"><p class="eyebrow">${mn?'Өдөр бүр нэг алхам урагш':'A little progress every day'}</p><h1 id="entry-title">${title}</h1><p class="muted-copy">${sub}</p>${content}</section><aside class="entry-install" aria-label="${mn?'Апп суулгах заавар':'App installation guide'}">${install}</aside></main></div>`;
}
