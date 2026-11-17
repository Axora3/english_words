import test from 'node:test';
import assert from 'node:assert/strict';
import {requiresEntry,isEntryAction,isEntryForm,entryView} from '../auth-gate.js';

test('session check and sign-out close access; recovery stays on entry until completed',()=>{
 assert.equal(requiresEntry(false,{id:'cached'}),true);
 assert.equal(requiresEntry(true,null),true);
 assert.equal(requiresEntry(true,{id:'signed-in'}),false);
 assert.equal(requiresEntry(true,{id:'signed-in'},true),true);
});
test('signed-out actions allow authentication and installation, rejecting learning and account mutations',()=>{
 for(const a of ['learn','review-answer','import','export','community-refresh','a-delete','a-sync','go'])assert.equal(isEntryAction(a),false,a);
 assert.equal(isEntryAction('a-mode','signUp'),true);
 assert.equal(isEntryAction('a-mode','magicLink'),false);
 assert.equal(isEntryAction('pwa-install'),true);
 assert.equal(isEntryForm('settings-form'),false);
 assert.equal(isEntryForm('a-auth-form'),true);
});
test('entry mounts only authentication and installation and fails closed without cloud configuration',()=>{
 const account={configured:true,message:null,recovery:false,authForm:()=>'<form id="a-auth-form"></form>'};
 const args={state:{settings:{language:'mn'}},account,ready:true,install:'<section>Суулгах заавар</section>'};
 const html=entryView(args);
 assert.match(html,/a-auth-form/);assert.match(html,/Суулгах заавар/);
 assert.doesNotMatch(html,/#dashboard|#library|sidebar-navigation|bottom-nav|#settings/);
 account.configured=false;
 assert.doesNotMatch(entryView(args),/a-auth-form/);
 assert.match(entryView(args),/auth-retry/);
 assert.doesNotMatch(entryView({...args,ready:false}),/a-auth-form/);
});
