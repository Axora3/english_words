import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpeech, speechMatch, createSpeechPractice, recognitionConstructor } from '../speech.js';

test('speech comparison normalises punctuation but does not pretend similar words are correct', () => {
  assert.equal(normalizeSpeech('  Serendipity! '), 'serendipity');
  assert.equal(speechMatch('embrace', 'Embrace.'), true);
  assert.equal(speechMatch('resilient', 'resilience'), false);
  assert.equal(speechMatch('kindness', 'kind'), false);
  assert.equal(speechMatch('thrive', 'I thrive'), false);
});

test('unsupported recognition reports an honest fallback without starting a microphone', () => {
  const changes = [];
  const practice = createSpeechPractice({ scope: {}, onChange: result => changes.push(result) });
  practice.start('hello');
  assert.equal(recognitionConstructor({}), null);
  assert.equal(changes.at(-1).status, 'unsupported');
  assert.equal(practice.isListening(), false);
});

test('recognition results, errors, cancellation and stale events are handled without storing audio', () => {
  const engines = [], changes = [];
  class Recognition {
    constructor() { engines.push(this); }
    start() {}
    abort() { this.aborted = true; }
  }
  const practice = createSpeechPractice({ scope: { SpeechRecognition: Recognition }, onChange: result => changes.push(result) });
  practice.start('hello');
  assert.equal(practice.isListening(), true);
  const staleResult = engines[0].onresult;
  engines[0].onresult({ results: [[{ transcript: 'Hello.' }]] });
  assert.deepEqual(changes.at(-1), { status: 'result', transcript: 'Hello.', matched: true });
  assert.equal(practice.isListening(), false);
  practice.start('world');
  staleResult({ results: [[{ transcript: 'hello' }]] });
  assert.equal(changes.at(-1).status, 'listening');
  engines[1].onerror({ error: 'not-allowed' });
  assert.equal(changes.at(-1).error, 'not-allowed');
  practice.start('again');
  practice.stop();
  assert.equal(engines[2].aborted, true);
  assert.equal(changes.at(-1).status, 'stopped');
  assert.equal(practice.isListening(), false);
});
