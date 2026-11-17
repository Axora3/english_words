// Account & sync screen (#account): guest vs cloud explanation, authentication, first-sync choice,
// sync status, cloud backups, profile, password, sign-out and account deletion.
import {icon} from './icons.js';
import {u} from './labels.js';
import {auth,data,cloudConfig} from './cloud.js';
import {validBackup} from './backup.js';
import {profileText,validateProfile,authErrorKey,readAvatar,validAvatar,stageAvatar,signupPhotoHelp} from './profile.js';
import {community} from './cloud.js';
import {button,pageHeader,sectionHeader,notice,badge,iconTile,segmented,esc} from './ui.js';

export const syncIcon={'signed-out':'cloud','device':'device-mobile','idle':'cloud','synced':'cloud-check','syncing':'cloud-upload','pending':'cloud-upload','offline':'cloud-off','error':'cloud-off','needs-choice':'cloud'};
export const syncLabel={'signed-out':'localOnlyState','device':'deviceElsewhere','idle':'synced','synced':'synced','syncing':'syncing','pending':'pending','offline':'offlineSync','error':'syncError','needs-choice':'needsChoice'};
const tone={synced:'tone-mint',idle:'tone-mint',device:'tone-warning',syncing:'tone-accent',pending:'tone-accent',offline:'tone-warning',error:'tone-danger','needs-choice':'tone-warning','signed-out':''};

export class AccountUI{
 constructor(ctx){this.ctx=ctx;this.configured=null;this.mode='signIn';this.busy='';this.message=null;this.backups=null;this.profile=null;this.recovery=false;this.draftEmail='';this.signupDraft={};this.profileDraft={};this.avatarDraft=undefined;this.confirmationNeeded=false;cloudConfig().then(c=>{this.configured=Boolean(c);ctx.render();});}
 P(k){return profileText(this.state,k);}
 get state(){return this.ctx.state();}get t(){return this.ctx.t();}L(k){return u(this.state,k);}
 say(text,tone=''){this.message={text,tone};this.ctx.render();}
 async run(action,fn){if(this.busy)return;const owner=this.ctx.sync()?.snapshot()?.user?.id||null,operation={};this.operation=operation;const guard=()=>{if((this.ctx.sync()?.snapshot()?.user?.id||null)!==owner||this.operation!==operation)throw Object.assign(Error('Account changed'),{code:'stale-account'});};this.busy=action;this.message=null;this.ctx.render();try{await fn(guard);}catch(e){if(e?.code==='stale-account'||this.operation!==operation)return;const m=e?.message||String(e),key=authErrorKey(e);if(key==='emailNotConfirmed')this.confirmationNeeded=true;this.message={text:key?this.P(key):e?.code==='not-configured'?this.L('cloudOff'):!navigator.onLine?this.L('needsInternet'):/failed to fetch|network|load failed|fetch failed/i.test(m)?this.L('cloudUnreachable'):['PGRST204','42703'].includes(e?.code)?this.P('profileMigration'):m,tone:'tone-danger'};}finally{if(this.operation===operation){this.busy='';this.ctx.render();}}}
 async loadCloud(){const owner=this.ctx.sync()?.snapshot()?.user;if(!navigator.onLine){this.backups=[];this.message={text:this.L('needsInternet'),tone:'tone-warning'};this.ctx.render();return;}try{const [backups,profile]=await Promise.all([data.listBackups(owner?.id),data.initializeProfile(owner)]);if(this.ctx.sync()?.snapshot()?.user?.id!==owner?.id)return;this.backups=backups;this.profile=profile;}catch(e){this.backups=this.backups||[];this.message={text:['PGRST204','42703'].includes(e?.code)?this.P('profileMigration'):e.message,tone:'tone-danger'};}this.ctx.render();}
 fmt(v){return v?`${this.ctx.dateLabel(v,{month:'short',day:'numeric',year:'numeric'})} · ${this.ctx.timeLabel(v)}`:this.L('never');}
 btnBusy(action){return this.busy===action?'aria-busy="true" disabled':this.busy?'disabled':'';}

 view(){const L=k=>this.L(k),sync=this.ctx.sync()?.snapshot()||{status:'signed-out'},user=sync.user;
  const head=pageHeader({eyebrow:this.t('settings'),title:L('account'),sub:user?'':L('guestHelp'),back:{href:'#settings',label:this.t('settings')}});
  const msg=this.message?notice(esc(this.message.text),{tone:this.message.tone,ic:this.message.tone==='tone-danger'?'alert-triangle':'info-circle',role:this.message.tone==='tone-danger'?'alert':'status'}):'';
  if(this.configured===null)return head+`<div class="skeleton-group" aria-busy="true"><span class="skeleton"></span><span class="skeleton"></span></div>`;
  if(!this.configured)return head+notice(`<strong>${L('cloudOff')}</strong> ${L('cloudOffHelp')}`,{ic:'cloud-off'})+this.compare();
  if(this.recovery)return head+msg+this.passwordForm(true);
  if(!user)return head+msg+this.compare()+this.authForm();
  if(this.backups===null){this.backups=undefined;this.loadCloud();}
  return head+msg+this.status(sync)+(sync.plan?this.firstSync(sync):'')+(sync.presync?this.presync(sync):'')+this.backupsView()+this.profileView()+this.passwordForm(false)+this.signOutView(sync)+this.deleteView();
 }
 compare(){const L=k=>this.L(k);return `<section class="compare-grid"><div class="panel">${iconTile('device-mobile','listening')}<h2>${L('deviceData')}</h2><p class="muted-copy">${L('cloudOffHelp')}</p></div><div class="panel">${iconTile('cloud','quiz')}<h2>${L('cloudData')}</h2><p class="muted-copy">${L('cloudBenefits')}</p></div></section>`;}
 authPassword(name,label,autocomplete,hint=''){
  const show=this.state.settings.language==='mn'?'Нууц үг харах':'Show password';
  return `<label class="field"><span class="field-label">${label}</span><span class="input-shell"><input class="input" id="auth-field-${name}" type="password" name="${name}" aria-label="${esc(label)}" autocomplete="${autocomplete}" required minlength="8" maxlength="72"><button class="password-visibility" type="button" data-action="a-password-toggle:${name}" aria-controls="auth-field-${name}" aria-label="${show}" aria-pressed="false">${icon('eye')}</button></span>${hint?`<small class="key-hint">${hint}</small>`:''}</label>`;
 }
 authForm({entry=false}={}){const L=k=>this.L(k),m=this.mode,pw=m==='signIn'||m==='signUp';
  const modes=entry?[['signIn','login'],['signUp','user-circle']]:[['signIn','login'],['signUp','user-circle'],['magicLink','mail'],['forgot','key']];
  const tabs=segmented(modes.map(([k,ic])=>({label:L(k),ic,action:'a-mode:'+k,active:m===k})),{label:L('account')});
  return `<section class="panel auth-panel">${tabs}<form id="a-auth-form" class="auth-form" novalidate>
   ${m==='signUp'?`<label class="field signup-photo"><span class="field-label">${this.P('photo')}</span>${this.signupAvatar?`<img class="signup-avatar" src="${esc(this.signupAvatar)}" alt="" width="64" height="64">`:''}<input class="input" type="file" name="signup_avatar" accept="image/jpeg,image/png,image/webp"><small class="key-hint">${signupPhotoHelp(this.state)}</small></label>`:''}
   ${m==='signUp'?`<div class="auth-identity-grid">${['last_name','first_name','nickname'].map((name,i)=>`<label class="field"><span class="field-label">${this.P(['lastName','firstName','nickname'][i])}</span><input class="input" name="${name}" autocomplete="${['family-name','given-name','nickname'][i]}" required maxlength="${name==='nickname'?24:60}" value="${esc(this.signupDraft[name]||'')}"></label>`).join('')}</div>`:''}
   <label class="field"><span class="field-label">${L('email')}</span><input class="input" type="email" name="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required maxlength="254" value="${esc(this.draftEmail||'')}"></label>
   <p class="key-hint">${this.P('emailHelp')}</p>
   ${pw?this.authPassword('password',L('password'),m==='signUp'?'new-password':'current-password',m==='signUp'?L('passwordHint'):''):''}
   ${m==='signUp'?this.authPassword('password_repeat',this.P('repeatPassword'),'new-password'):''}
   ${button(L(m==='forgot'?'sendReset':m==='magicLink'?'sendLink':m),{full:true,size:'lg',ic:m==='signUp'?'user-circle':m==='signIn'?'login':'mail',attrs:this.btnBusy('auth')})}
   ${this.confirmationNeeded?button(this.P('resendConfirmation'),{action:'a-resend-confirm',kind:'secondary',type:'button',attrs:this.btnBusy('resend')}):''}
   ${entry?button(L('forgot'),{action:'a-mode:forgot',kind:'ghost',size:'sm',type:'button'}):''}
   ${!navigator.onLine?`<p class="key-hint">${icon('wifi-off')}${L('needsInternet')}</p>`:''}</form></section>`;}
 status(sync){const L=k=>this.L(k),s=sync.status;
  return `<section class="panel sync-panel"><div class="sync-head">${iconTile(syncIcon[s]||'cloud',s==='error'?'speaking':s==='offline'?'writing':'spelling')}<div><p class="eyebrow">${L('signedInAs')}</p><h2>${esc(sync.user.email)}</h2></div>${badge(L(syncLabel[s]||'synced'),tone[s])}</div>
   <dl class="facts"><div><dt>${L('lastSynced')}</dt><dd>${this.fmt(sync.lastSyncedAt)}</dd></div></dl>${sync.error?notice(esc(sync.error),{tone:'tone-danger',ic:'alert-triangle'}):''}
   <div class="form-actions start">${button(L('syncNow'),{action:'a-sync',ic:'refresh',kind:'secondary',attrs:s==='syncing'||!navigator.onLine?'disabled':''})}</div></section>`;}
 firstSync(sync){const L=k=>this.L(k),p=sync.plan,row=(k,v)=>`<li><span>${this.t(k)}</span><b class="num">${v}</b></li>`;
  const summary=x=>x?`<ul class="summary-list">${row('learned',x.learned)}${row('reviewed',x.reviews)}${row('favorites',x.favorites)}${row('grammar',x.grammar)}${row('p.collections',x.collections)}</ul>`:'';
  return `<section class="panel first-sync" aria-labelledby="first-sync-title">${sectionHeader(L('firstSync'),{id:'first-sync-title',sub:L('firstSyncHelp')})}${p.foreign?notice(L('foreignWarn'),{tone:'tone-warning',ic:'alert-triangle'}):''}
   <div class="compare-grid"><div class="panel">${icon('device-mobile')}<h3>${L('deviceData')}</h3>${summary(p.local)}</div>${p.cloud?`<div class="panel">${icon('cloud')}<h3>${L('cloudData')}</h3>${summary(p.cloud)}<small class="key-hint">${this.fmt(p.cloudUpdatedAt&&new Date(p.cloudUpdatedAt).getTime())}</small></div>`:''}</div>
   <div class="form-actions start">${p.kind==='upload'?button(L('uploadDevice'),{action:'a-choose:use-device',ic:'cloud-upload'}):`${button(L('mergeBoth'),{action:'a-choose:merge',ic:'arrows-shuffle'})}${button(L('useCloud'),{action:'a-choose:use-cloud',kind:'secondary',ic:'cloud-download'})}${button(L('useDevice'),{action:'a-choose:use-device',kind:'secondary',ic:'device-mobile'})}`}</div>
   <p class="key-hint">${icon('shield-check')}${L('choiceNote')}</p></section>`;}
 presync(sync){const L=k=>this.L(k);return `<section class="panel inline-panel">${icon('history')}<div><strong>${L('presync')}</strong><small>${this.fmt(sync.presync.at)}</small></div><div class="form-actions">${button(L('download'),{action:'a-presync-download',kind:'secondary',size:'sm',ic:'download'})}${button(L('discard'),{action:'a-presync-discard',kind:'ghost',size:'sm'})}</div></section>`;}
 backupsView(){const L=k=>this.L(k),reasons={'manual':'reasonManual','before-restore':'reasonBeforeRestore','before-replace':'reasonBeforeReplace','migration':'reasonMigration'};
  const list=this.backups===undefined?`<div class="skeleton-group"><span class="skeleton"></span><span class="skeleton"></span></div>`:!this.backups?.length?`<p class="muted-copy">${L('noBackups')}</p>`:`<ul class="backup-list">${this.backups.map(b=>`<li><div><strong>${this.fmt(new Date(b.created_at).getTime())}</strong><small>${badge(L(reasons[b.reason]||'reasonManual'))} <span class="num">${b.words_learned}</span> ${this.t('words')}${b.label?' · '+esc(b.label):''}</small></div><div class="form-actions">${button(L('restore'),{action:'a-restore:'+b.id,kind:'secondary',size:'sm',ic:'arrow-back-up',attrs:this.btnBusy('restore')})}${button('',{action:'a-backup-delete:'+b.id,kind:'ghost',size:'sm',ic:'trash',attrs:`aria-label="${esc(this.t('p.delete'))}" ${this.busy?'disabled':''}`})}</div></li>`).join('')}</ul>`;
  return `<section class="panel">${sectionHeader(L('cloudBackups'),{action:button(L('createBackup'),{action:'a-backup',ic:'cloud-upload',size:'sm',attrs:this.btnBusy('backup')+(navigator.onLine?'':' disabled')})})}${list}</section>`;}
 profilePage(){
  if(this.backups===null){this.backups=undefined;this.loadCloud();}
  const head=pageHeader({title:this.P('profile'),sub:esc(this.ctx.sync()?.snapshot()?.user?.email||'')});
  const message=this.message?notice(esc(this.message.text),{tone:this.message.tone,role:'status'}):'';
  return head+message+this.profileView()+this.passwordForm(false)+this.signOutView(this.ctx.sync().snapshot());
 }
 profileView(){
  const p={...this.profile,...this.profileDraft},avatar=this.avatarDraft===undefined?p.avatar_data:this.avatarDraft;
  const photo=validAvatar(avatar||null)&&avatar?`<img src="${esc(avatar)}" alt="${esc(this.P('photo'))}" width="96" height="96">`:`<span aria-hidden="true">${esc((p.nickname||p.first_name||'?').slice(0,1).toUpperCase())}</span>`;
  return `<form id="a-profile-form" class="settings-group"><h2 class="group-title">${this.P('profile')}</h2><div class="group-body">
   <div class="profile-photo-row"><div class="profile-avatar">${photo}</div><div><label class="field"><span class="field-label">${this.P('photo')}</span><input class="input" type="file" name="avatar" accept="image/jpeg,image/png,image/webp" ${this.busy?'disabled':''}><small class="key-hint">${this.P('photoHelp')}</small></label>${avatar?button(this.P('removePhoto'),{action:'a-remove-photo',kind:'ghost',size:'sm',type:'button'}):''}</div></div>
   ${['last_name','first_name','nickname'].map((name,i)=>`<label class="setting-row"><span class="setting-copy"><strong>${this.P(['lastName','firstName','nickname'][i])}</strong></span><span class="setting-control"><input class="input" name="${name}" required maxlength="${name==='nickname'?24:60}" autocomplete="${['family-name','given-name','nickname'][i]}" value="${esc(p[name]||'')}"></span></label>`).join('')}
   <div class="group-foot">${button(this.t('p.save'),{ic:'check',size:'sm',attrs:this.btnBusy('profile')})}</div></div></form>`;
 }
 input(target){
  const name=target.name;
  if(target.closest('#a-auth-form')&&['first_name','last_name','nickname'].includes(name)){this.signupDraft[name]=target.value;return true;}
  if(target.closest('#a-profile-form')&&['first_name','last_name','nickname'].includes(name)){this.profileDraft[name]=target.value;return true;}
  return false;
 }
 async change(target){
  if(target.name==='signup_avatar'&&target.closest('#a-auth-form')){
   const file=target.files?.[0];if(file)await this.run('photo',async()=>{try{this.signupAvatar=await readAvatar(file);}catch(e){throw Error(this.P(e.message));}});
   return true;
  }
  if(target.name!=='avatar'||!target.closest('#a-profile-form'))return false;
  const file=target.files?.[0];if(file)await this.run('photo',async()=>{try{this.avatarDraft=await readAvatar(file);}catch(e){throw Error(this.P(e.message));}});
  return true;
 }
 passwordForm(recovery){const L=k=>this.L(k);return `<form id="a-password-form" class="settings-group"><h2 class="group-title">${L(recovery?'setNewPassword':'security')}</h2><div class="group-body"><label class="setting-row"><span class="setting-copy"><strong>${L('newPassword')}</strong><small>${L('passwordHint')}</small></span><span class="setting-control"><input class="input" type="password" name="password" autocomplete="new-password" minlength="8" maxlength="72" required></span></label><div class="group-foot">${button(L('setNewPassword'),{ic:'key',size:'sm',attrs:this.btnBusy('password')})}</div></div></form>`;}
 signOutView(sync){const L=k=>this.L(k);return `<section class="settings-group"><h2 class="group-title">${L('signOut')}</h2><div class="group-body">${sync.dirty?`<p class="group-note">${icon('alert-triangle')}${L('unsyncedWarn')}</p>`:''}<div class="setting-row"><span class="setting-copy"><strong>${L('signOutKeep')}</strong></span><span class="setting-control">${button(L('signOut'),{action:'a-signout:keep',kind:'secondary',size:'sm',ic:'logout',attrs:this.btnBusy('signout')})}</span></div><div class="setting-row"><span class="setting-copy"><strong>${L('signOutClear')}</strong></span><span class="setting-control">${button(L('signOut'),{action:'a-signout:clear',kind:'danger-ghost',size:'sm',ic:'logout',attrs:this.btnBusy('signout')})}</span></div></div></section>`;}
 deleteView(){const L=k=>this.L(k);return `<form id="a-delete-form" class="settings-group danger-group"><h2 class="group-title">${L('dangerZone')}</h2><div class="group-body"><p class="group-note">${icon('alert-triangle')}${L('deleteHelp')}</p><label class="setting-row"><span class="setting-copy"><strong>${L('deleteType')}</strong></span><span class="setting-control"><input class="input" name="confirm" autocomplete="off" spellcheck="false" required pattern="DELETE" aria-label="${esc(L('deleteType'))}"></span></label><label class="setting-row"><span class="setting-copy"><strong>${L('deleteKeepLocal')}</strong></span><span class="setting-control"><span class="switch"><input type="checkbox" role="switch" name="keepLocal" checked><span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span></span></span></label><div class="group-foot">${button(L('deleteAccount'),{kind:'danger',ic:'trash',attrs:this.btnBusy('delete')})}</div></div></form>`;}

 async click(action,value){if(!action.startsWith('a-'))return false;const L=k=>this.L(k),sync=this.ctx.sync();
  if(action==='a-mode'){this.mode=value;this.message=null;this.ctx.render();}
  else if(action==='a-password-toggle'){
   if(!['password','password_repeat'].includes(value))return true;
   const form=document.getElementById('a-auth-form'),input=form?.elements.namedItem(value);if(!input)return true;
   const show=input.type==='password';input.type=show?'text':'password';
   const control=form.querySelector(`[data-action="a-password-toggle:${value}"]`);
   control?.setAttribute('aria-pressed',String(show));control?.setAttribute('aria-label',this.state.settings.language==='mn'?(show?'Нууц үг нуух':'Нууц үг харах'):(show?'Hide password':'Show password'));
   if(control)control.innerHTML=icon(show?'eye-off':'eye');
  }
  else if(action==='a-resend-confirm'){if(!this.draftEmail){this.say(L('emailInvalid'),'tone-danger');return true;}await this.run('resend',async()=>{await auth.resendConfirmation(this.draftEmail.trim());this.message={text:this.P('confirmationSent'),tone:'tone-mint'};});}
  else if(action==='a-remove-photo'){this.avatarDraft=null;this.ctx.render();}
  else if(action==='a-sync')await this.run('sync',()=>sync.syncNow());
  else if(action==='a-choose')await this.run('choose',async()=>{await sync.choose(value);this.backups=null;});
  else if(action==='a-presync-download'){const s=sync.presyncState();if(s)this.ctx.download(JSON.stringify(s,null,2),'english-words-before-sync.json');}
  else if(action==='a-presync-discard'){if(confirm(L('discard')+'?'))sync.discardPresync();}
  else if(action==='a-backup')await this.run('backup',async guard=>{const owner=sync.snapshot().user?.id;await data.createBackup(this.state,'manual',null,owner);guard();const backups=await data.listBackups(owner);guard();this.backups=backups;this.ctx.toast(L('backupSaved'));});
  else if(action==='a-restore'){if(!confirm(L('restoreConfirm')))return true;await this.run('restore',async guard=>{const owner=sync.snapshot().user?.id;const restored=await data.getBackup(value,owner);guard();if(!validBackup(restored))throw Error(this.t('importError'));await data.createBackup(this.state,'before-restore',null,owner);guard();this.ctx.applyState(restored,{dirty:true});await sync.syncNow();guard();this.backups=await data.listBackups(owner);guard();this.ctx.toast(L('restored'));});}
  else if(action==='a-backup-delete'){if(!confirm(L('backupDeleteConfirm')))return true;await this.run('backup',async()=>{await data.deleteBackup(value);this.backups=await data.listBackups();});}
  else if(action==='a-signout'){const clear=value==='clear',owner=sync.snapshot().user?.id;if(clear&&!confirm(L('signOutClear')+'?'))return true;await this.run('signout',async()=>{if(sync.hasUnsynced()&&navigator.onLine)await sync.syncNow().catch(()=>{});if(sync.snapshot().user?.id!==owner)return;if(clear&&sync.hasUnsynced()&&!confirm(L('unsyncedWarn')))return;await auth.signOut();sync.forget();this.backups=null;this.profile=null;if(clear)this.ctx.clearAccountLocal(owner);this.ctx.toast(L('signedOut'));});}
  else return false;return true;}
 async submit(form){if(!form.id.startsWith('a-'))return false;const L=k=>this.L(k),f=new FormData(form);
  if(form.id==='a-auth-form'){const email=String(f.get('email')||'').trim(),password=String(f.get('password')||'');
   if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){this.say(L('emailInvalid'),'tone-danger');return true;}
   let registration;
   if(this.mode==='signUp'){
    registration=validateProfile(Object.fromEntries(f));
    this.signupDraft={first_name:f.get('first_name'),last_name:f.get('last_name'),nickname:f.get('nickname')};
    if(registration.error){this.say(this.P(registration.error),'tone-danger');return true;}
    if(password!==String(f.get('password_repeat')||'')){this.say(this.P('passwordMismatch'),'tone-danger');return true;}
   }
   if((this.mode==='signIn'&&!password)||(this.mode==='signUp'&&password.length<8)){this.say(L('passwordHint'),'tone-danger');return true;}
   this.draftEmail=email;
   await this.run('auth',async()=>{
    if(this.mode==='signIn'){await auth.signIn(email,password);}
    else if(this.mode==='signUp'){const r=await auth.signUp(email,password,registration.value);if(this.signupAvatar){try{stageAvatar(r.user,email,this.signupAvatar);if(r.session)await data.initializeProfile(r.user);}catch{this.ctx.toast(this.P('photoUnreadable'));}}this.message={text:r.session?L('synced'):L('confirmEmail'),tone:''};this.confirmationNeeded=!r.session;if(!r.session)this.mode='signIn';}
    else if(this.mode==='magicLink'){await auth.magicLink(email);this.message={text:L('checkEmail'),tone:''};}
    else{await auth.resetPassword(email);this.message={text:L('checkEmail'),tone:''};}});}
  else if(form.id==='a-password-form'){const p=String(f.get('password')||'');if(p.length<8){this.say(L('passwordHint'),'tone-danger');return true;}await this.run('password',async()=>{await auth.updatePassword(p);this.recovery=false;this.ctx.toast(L('passwordUpdated'));});}
  else if(form.id==='a-profile-form'){
   const validated=validateProfile(Object.fromEntries(f));if(validated.error){this.say(this.P(validated.error),'tone-danger');return true;}
   const owner=this.ctx.sync()?.snapshot()?.user?.id;
   const fields={...validated.value,display_name:validated.value.nickname,preferred_language:this.state.settings.language,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone?.slice(0,64)||null};
   if(this.avatarDraft!==undefined){if(!validAvatar(this.avatarDraft)){this.say(this.P('photoInvalid'),'tone-danger');return true;}fields.avatar_data=this.avatarDraft;}
   await this.run('profile',async guard=>{await data.saveProfile(fields,owner);guard();this.profile={...this.profile,...fields};this.profileDraft={};this.avatarDraft=undefined;await community.syncProfile(fields.nickname,owner);guard();this.ctx.toast(this.P('saved'));});
  }
  else if(form.id==='a-delete-form'){if(f.get('confirm')!=='DELETE'){this.say(L('deleteType'),'tone-danger');return true;}const keep=form.elements.keepLocal.checked,owner=this.ctx.sync().snapshot().user?.id;if(!confirm(L('deleteHelp')))return true;
   await this.run('delete',async guard=>{const r=await auth.deleteAccount(owner);guard();await auth.signOut().catch(()=>{});this.ctx.sync().forget();this.backups=null;if(!keep)this.ctx.clearAccountLocal(owner);this.ctx.toast(L(r?.login_deleted===false?'dataDeletedLoginKept':'accountDeleted'));});}
  return true;}
}
