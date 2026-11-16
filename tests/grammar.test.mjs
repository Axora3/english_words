import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lessons } from '../grammar-data.js';
import { emptyState } from '../core.js';
import { levels, startGrammar, availableLessons, lessonUnlockDate, currentLesson, checkGrammar, validGrammar } from '../grammar.js';
import { validBackup } from '../backup.js';

test('100 unique bilingual lessons cover A1 through C1 with valid practice answers', () => {
  assert.equal(lessons.length, 100);
  assert.equal(new Set(lessons.map(l => l.id)).size, 100);
  for (const level of levels) assert.equal(lessons.filter(l => l.level === level).length, 20);
  for (const lesson of lessons) {
    for (const lang of ['en', 'mn']) {
      assert.ok(lesson.title[lang].length > 5);
      assert.ok(lesson.rule[lang].length > 50);
    }
    assert.ok(lesson.example && lesson.exampleMn && lesson.pattern);
    assert.equal(lesson.questions.length, 2);
    for (const q of lesson.questions) {
      assert.equal(new Set(q.options).size, q.options.length);
      assert.ok(q.options[q.correct]);
      assert.ok(q.options.every(Boolean));
    }
  }
});

test('enrolment is stable and unlocks exactly one lesson per seven calendar days', () => {
  const state = emptyState(), start = new Date(2026, 10, 16, 23, 45);
  assert.equal(availableLessons(state.grammar, start), 0);
  startGrammar(state, start);
  assert.equal(availableLessons(state.grammar, start), 1);
  assert.equal(availableLessons(state.grammar, new Date(2026, 10, 22, 23, 59)), 1);
  assert.equal(availableLessons(state.grammar, new Date(2026, 10, 23, 0, 0)), 2);
  startGrammar(state, new Date(2026, 11, 20));
  assert.equal(state.grammar.startedOn, '2026-11-16');
  assert.equal(lessonUnlockDate(state.grammar, 1).getDate(), 23);
  assert.equal(availableLessons(state.grammar, new Date(2040, 0, 1)), 100);
  assert.equal(availableLessons(state.grammar, new Date(2026, 10, 15)), 0);
});

test('locked lessons cannot be completed; passing does not unlock next week early', () => {
  const state = emptyState(), now = new Date(2026, 10, 16);
  startGrammar(state, now);
  const first = lessons[0], second = lessons[1];
  assert.equal(checkGrammar(state, second.id, second.questions.map(q => q.correct), now), null);
  const result = checkGrammar(state, first.id, first.questions.map(q => q.correct), now);
  assert.equal(result.score, 2);
  assert.ok(state.grammar.completed[first.id]);
  assert.equal(availableLessons(state.grammar, now), 1);
  assert.equal(currentLesson(state.grammar, now).id, first.id);
  assert.equal(currentLesson(state.grammar, new Date(2026, 10, 23)).id, second.id);
});

test('incorrect grammar practice is stored but not completed; refresh and backup retain progress', () => {
  const state = emptyState(), now = new Date(2026, 10, 16);
  startGrammar(state, now);
  assert.equal(checkGrammar(state, lessons[0].id, [1, 1], now).score, 0);
  assert.equal(Object.keys(state.grammar.completed).length, 0);
  const restored = JSON.parse(JSON.stringify(state));
  assert.equal(validBackup(restored), true);
  assert.deepEqual(restored.grammar, state.grammar);
  assert.equal(validGrammar({ ...state.grammar, startedOn: '2026-02-30' }), false);
  assert.equal(validGrammar({ ...state.grammar, completed: { invalid: { at: 1 } } }), false);
  assert.equal(validGrammar({ ...state.grammar, attempts: { [lessons[0].id]: { answers: [99], score: 1, at: 1 } } }), false);
  assert.equal(validGrammar(undefined), true);
  assert.equal(validGrammar(null), true);
  delete restored.grammar;
  assert.equal(validBackup(restored), true);
});
