import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validBackup } from '../backup.js';
import { emptyState, ensureDay, markLearned, makeTest } from '../core.js';
import { words } from '../words.js';

test('backup round-trip preserves schedules, learned words, favorites and an in-progress quiz', () => {
  const state = emptyState();
  ensureDay(state, words);
  markLearned(state, '1');
  state.favorites.push('1');
  state.activeTest = makeTest(words, ['1']);
  state.activeTest.answers.push({ value: '1', correct: true });
  assert.equal(validBackup(JSON.parse(JSON.stringify(state))), true);
});

test('malformed imports cannot introduce missing words, broken options or invalid progress', () => {
  const state = emptyState();
  assert.equal(validBackup(state), true);
  assert.equal(validBackup(null), false);
  assert.equal(validBackup({ ...state, version: 999 }), false);
  assert.equal(validBackup({ ...state, favorites: ['999'] }), false);
  assert.equal(validBackup({ ...state, learned: { 1: { learnedAt: 1, dueAt: 1, stage: -1 } } }), false);
  state.activeTest = makeTest(words, ['1']);
  state.activeTest.questions[0].options = [];
  assert.equal(validBackup(state), false);
  state.activeTest = makeTest(words, ['1']);
  state.activeTest.index = 4;
  assert.equal(validBackup(state), false);
});
