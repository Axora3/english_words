import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lessons } from '../grammar-data.js';
import { emptyState } from '../core.js';
import { levels, startGrammar, availableLessons, currentLesson, checkGrammar, validGrammar } from '../grammar.js';
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

test('enrolment is stable and opens the first lesson, and only the first', () => {
  const state = emptyState(), start = new Date(2026, 10, 16, 23, 45);
  assert.equal(availableLessons(state.grammar), 0);
  startGrammar(state, start);
  assert.equal(availableLessons(state.grammar), 1, 'one open lesson, whatever the date');
  assert.equal(availableLessons(state.grammar, new Date(2040, 0, 1)), 1, 'waiting unlocks nothing');
  startGrammar(state, new Date(2026, 11, 20));
  assert.equal(state.grammar.startedOn, '2026-11-16', 're-entering the course does not restart it');
  assert.equal(currentLesson(state.grammar).id, lessons[0].id);
});

test('a lesson unlocks the next one and nothing beyond it', () => {
  const state = emptyState(), now = new Date(2026, 10, 16);
  startGrammar(state, now);
  const [first, second, third] = lessons;
  assert.equal(checkGrammar(state, second.id, second.questions.map(q => q.correct), now), null, 'locked lessons refuse answers');
  assert.equal(checkGrammar(state, first.id, [1, 1], now).score, 0);
  assert.equal(availableLessons(state.grammar), 1, 'a wrong answer unlocks nothing');
  const result = checkGrammar(state, first.id, first.questions.map(q => q.correct), now);
  assert.equal(result.score, 2);
  assert.ok(state.grammar.completed[first.id]);
  assert.equal(availableLessons(state.grammar), 2, 'finishing the first opens the second');
  assert.equal(currentLesson(state.grammar).id, second.id);
  assert.equal(checkGrammar(state, third.id, third.questions.map(q => q.correct), now), null, 'the third stays locked');
  checkGrammar(state, second.id, second.questions.map(q => q.correct), now);
  assert.equal(availableLessons(state.grammar), 3);
  assert.equal(currentLesson(state.grammar).id, third.id);
});

test('progress from the old weekly schedule is honoured, including gaps', () => {
  const state = emptyState(), now = new Date(2026, 10, 16);
  startGrammar(state, now);
  // A backup written while lessons unlocked by date can hold a lesson finished out of order.
  state.grammar.completed[lessons[2].id] = {at: now.getTime()};
  assert.equal(validGrammar(state.grammar), true);
  assert.equal(availableLessons(state.grammar), 1, 'the course resumes at the first unfinished lesson');
  assert.equal(currentLesson(state.grammar).id, lessons[0].id);
  for (const lesson of lessons.slice(0, 2)) checkGrammar(state, lesson.id, lesson.questions.map(q => q.correct), now);
  assert.equal(availableLessons(state.grammar), 4, 'the lesson already finished is counted, not repeated');
  assert.equal(currentLesson(state.grammar).id, lessons[3].id);
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
