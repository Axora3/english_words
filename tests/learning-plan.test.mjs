import test from 'node:test';import assert from 'node:assert/strict';
import {emptyState,dayKey,nextWord,reviewWord,validateSettings} from '../core.js';
import {migrateAdvanced} from '../advanced-state.js';import {baseWords} from '../words.js';
import {saveLearningPlan,plannedWords,learningSummary} from '../learning-plan.js';
import {validBackup} from '../backup.js';import {mergeStates} from '../merge.js';
test('a personalised plan starts immediately at the chosen level and survives sync and backup',()=>{
 const s=emptyState();migrateAdvanced(s);const now=new Date(2026,10,18,23,59);
 saveLearningPlan(s,{level:'B1',minutes:20,goal:'work'},baseWords,now);
 assert.equal(s.settings.dailyTarget,10);assert.equal(s.advanced.goals.weeklyMinutes,140);
 assert.equal(plannedWords(s,baseWords)[0].level,'B1');assert.ok(nextWord(s,s.days[dayKey(now)],now.getTime()));
 assert.equal(validateSettings(s.settings),true);assert.equal(validBackup(s),true);
 const merged=mergeStates(emptyState(),s,emptyState());assert.equal(merged.settings.learningPlan.goal,'work');
 assert.throws(()=>saveLearningPlan(s,{level:'X',minutes:10,goal:'work'},baseWords));
});
test('retention summary distinguishes newly seen, retained and forgotten words',()=>{const s=emptyState();s.learned.a={learnedAt:1,stage:4,dueAt:99999};s.learned.b={learnedAt:1,stage:0,dueAt:1};assert.equal(learningSummary(s,100).mastered,1);assert.equal(learningSummary(s,100).due,1);reviewWord(s,'a',false,100);assert.equal(learningSummary(s,100).mastered,0);});
