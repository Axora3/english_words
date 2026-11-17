import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyState,ensureDay,schedule,nextWord,markLearned,reviewWord,dueWords,rescheduleDay,dayKey,streak,makeTest,scoreTest,notificationEvents,validateSettings} from '../core.js';
import {words} from '../words.js';
import {dictionaries} from '../i18n.js';
const now=new Date(2026,10,16,9,0,0);
// The first words of the shipped vocabulary; ids are stable but the list grows, so never hard-code them.
const [id1,id2]=words.map(w=>w.id);
test('daily schedule unlocks only the next due word and survives serialization',()=>{const s=emptyState(),day=ensureDay(s,words,now);assert.equal(day.ids.length,5);assert.equal(nextWord(s,day,now.getTime()-1),null);assert.equal(nextWord(s,day,+now).id,id1);markLearned(s,id1,+now);assert.equal(nextWord(s,day,+now),null);const restored=JSON.parse(JSON.stringify(s));assert.deepEqual(ensureDay(restored,words,now),day);assert.equal(nextWord(restored,restored.days[dayKey(now)],+now+600000).id,id2);});
test('a new day excludes learned words and preserves the old schedule',()=>{const s=emptyState(),old=ensureDay(s,words,now);markLearned(s,id1,+now);const day2=ensureDay(s,words,new Date(2026,10,17));assert.equal(day2.ids[0],id2);assert.equal(old.ids[0],id1);assert.equal(Object.keys(s.days).length,2);});
test('changed schedule preserves learned progress and validates midnight overflow',()=>{const s=emptyState();ensureDay(s,words,now);markLearned(s,id1,+now);s.settings.dailyTarget=2;s.settings.interval=30;rescheduleDay(s,words,now);assert.deepEqual(s.days[dayKey(now)].ids,[id1,id2]);assert.equal(schedule(s.days[dayKey(now)])[1].at,+now+1800000);assert.equal(validateSettings({...s.settings,startTime:'23:50',interval:30}),false);assert.equal(validateSettings({...s.settings,dailyTarget:0}),false);assert.equal(validateSettings({...s.settings,startTime:'24:00'}),false);});
test('review intervals expand on recall and reset on failure',()=>{const s=emptyState();markLearned(s,'1',+now);assert.deepEqual(dueWords(s,+now),['1']);reviewWord(s,'1',true,+now);assert.equal(s.learned['1'].dueAt,+now+86400000);reviewWord(s,'1',true,+now+86400000);assert.equal(s.learned['1'].stage,2);assert.equal(s.learned['1'].dueAt,+now+4*86400000);reviewWord(s,'1',false,+now+4*86400000);assert.equal(s.learned['1'].stage,0);assert.equal(s.reviews.length,3);assert.equal(s.learned['1'].dueAt,+now+4*86400000+600000);});
test('learning streak tolerates an unfinished current day but no skipped days',()=>{const s=emptyState();markLearned(s,'1',+now);markLearned(s,'2',+now-86400000);assert.equal(streak(s,now),2);assert.equal(streak(s,new Date(+now+86400000)),2);assert.equal(streak(s,new Date(+now+2*86400000)),0);});
test('test covers all six question types using learned vocabulary and scores actual answers',()=>{assert.equal(makeTest(words,[]),null);const t=makeTest(words,['1','2'],+now);assert.equal(new Set(t.questions.map(q=>q.type)).size,6);assert.ok(t.questions.every(q=>['1','2'].includes(q.id)&&q.options.includes(q.id)&&new Set(q.options).size===4));t.answers=t.questions.map((_,i)=>({correct:i<4,value:'1'}));assert.deepEqual(scoreTest(t),{correct:4,total:6,percent:67});});
test('notifications respect master, individual toggles, exact time, expiry and deduplication',()=>{const s=emptyState(),day=ensureDay(s,words,now);assert.deepEqual(notificationEvents(s,day,+now),[]);s.settings.notifications=true;let events=notificationEvents(s,day,+now);assert.equal(events.length,1);s.notified.push(events[0].key);assert.equal(notificationEvents(s,day,+now).length,0);assert.equal(notificationEvents(s,day,+now+60000).length,0);s.settings.newNotifications=false;assert.equal(notificationEvents(s,day,+now+600000).length,0);s.settings.notifications=false;assert.equal(notificationEvents(s,day,+now+1200000).length,0);});
test('a reminder missed while the app was closed is caught up, newest of each kind only',()=>{
 const s=emptyState(),day=ensureDay(s,words,now);s.settings.notifications=true;
 // Three words came due while the app was closed (09:00, 09:10, 09:20); it is opened at 09:25.
 const events=notificationEvents(s,day,+now+25*60000);
 assert.equal(events.length,3,'nothing is dropped: every missed reminder is accounted for');
 assert.deepEqual(events.map(e=>Boolean(e.stale)),[true,true,false],'only the newest one is shown');
 for(const e of events)s.notified.push(e.key);
 assert.deepEqual(notificationEvents(s,day,+now+25*60000),[],'delivered reminders never come back');
 assert.equal(notificationEvents(s,day,+now+31*60000).length,1,'the next word still arrives on time');
});
test('all UI translation keys exist in both languages',()=>{assert.deepEqual(Object.keys(dictionaries.en).sort(),Object.keys(dictionaries.mn).sort());});
