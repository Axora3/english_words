import test from 'node:test';
import assert from 'node:assert/strict';
import {validateProfile,authErrorKey,validAvatar,stageAvatar,pendingAvatar} from '../profile.js';
import {AccountUI} from '../account-ui.js';
import {emptyState} from '../core.js';
import {translator} from '../i18n.js';
import {auth} from '../cloud.js';

test('profile accepts Mongolian names and validates nickname, length and control characters',()=>{
 assert.deepEqual(validateProfile({last_name:' Болд ',first_name:' Бат ',nickname:'bat_12'}).value,{last_name:'Болд',first_name:'Бат',nickname:'bat_12'});
 for(const nickname of ['ab','has space','<script>','a'.repeat(25)])assert.equal(validateProfile({first_name:'Bat',last_name:'Bold',nickname}).error,'nicknameInvalid');
 assert.equal(validateProfile({first_name:'Bat\n',last_name:'',nickname:'bat'}).error,'namesRequired');
});
test('provider authentication errors have distinct useful messages',()=>{
 assert.equal(authErrorKey({message:'Invalid login credentials'}),'invalidCredentials');
 assert.equal(authErrorKey({code:'email_not_confirmed'}),'emailNotConfirmed');
 assert.equal(authErrorKey({code:'over_email_send_rate_limit'}),'rateLimited');
 assert.equal(authErrorKey({message:'Unknown failure'}),null);
});
test('avatar accepts only bounded raster data and rejects SVG and external URLs',()=>{
 assert.equal(validAvatar('data:image/jpeg;base64,YQ=='),true);
 assert.equal(validAvatar(null),true);
 for(const value of ['https://example.test/me.jpg','data:image/svg+xml;base64,YQ==','data:image/png;base64,'+'A'.repeat(120001),'javascript:alert(1)'])assert.equal(validAvatar(value),false);
});
test('registration photo is bound to the exact account and email before first sign-in',()=>{
 const values=new Map(),storage={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k)};
 const avatar='data:image/jpeg;base64,YQ==';stageAvatar({id:'owner'},'Person@Example.test',avatar,storage);
 assert.equal(pendingAvatar({id:'owner',email:'person@example.test'},storage),avatar);
 assert.equal(pendingAvatar({id:'other',email:'person@example.test'},storage),null);
 assert.equal(pendingAvatar({id:'owner',email:'other@example.test'},storage),null);
});
function ui(){const state=emptyState(),a=Object.create(AccountUI.prototype);Object.assign(a,{ctx:{state:()=>state,t:()=>translator('mn'),render(){},sync:()=>({snapshot:()=>({user:null})})},mode:'signUp',busy:'',message:null,signupDraft:{},profileDraft:{},draftEmail:'',configured:true});return a;}
test('registration renders identity and repeated password fields; mismatched passwords never reach auth',async()=>{
 const a=ui(),html=a.authForm({entry:true});
 for(const name of ['first_name','last_name','nickname','password_repeat'])assert.match(html,new RegExp(`name="${name}"`));
 const originalFormData=globalThis.FormData,originalSignUp=auth.signUp;let calls=0,payload;
 globalThis.FormData=class extends Map{constructor(form){super(Object.entries(form.fields));}};
 auth.signUp=async(...args)=>{calls++;payload=args;return {session:null};};
 try{
  const fields={first_name:'Bat',last_name:'Bold',nickname:'bat_12',email:' bat@example.test ',password:'testpass123',password_repeat:'different'};
  await a.submit({id:'a-auth-form',fields});assert.equal(calls,0);assert.match(a.message.text,/таарахгүй/);
  fields.password_repeat=fields.password;await a.submit({id:'a-auth-form',fields});
  assert.equal(calls,1);assert.equal(payload[0],'bat@example.test');assert.deepEqual(payload[2],{first_name:'Bat',last_name:'Bold',nickname:'bat_12'});
  assert.equal(a.confirmationNeeded,true);assert.equal(a.mode,'signIn');
 }finally{globalThis.FormData=originalFormData;auth.signUp=originalSignUp;}
});
