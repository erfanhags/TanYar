const assert = require('node:assert/strict');
const { test } = require('node:test');
const { matchFace, enrollSamples, createTracker, MODEL } = require('../js/face-matcher.js');

const vector = value => Array(128).fill(value);
const user = (username, value) => ({ username, faceLogin: { model: MODEL, descriptor: vector(value) } });

test('a registered face selects its own account', () => {
  assert.equal(matchFace(vector(0.1), [user('first', 0.1), user('second', 0.3)]), 'first');
});

test('unknown, invalid, and ambiguously similar faces cannot log in', () => {
  assert.equal(matchFace(vector(0.8), [user('first', 0.1)]), null);
  assert.equal(matchFace([0.1], [user('first', 0.1)]), null);
  assert.equal(matchFace(vector(NaN), [user('first', 0.1)]), null);
  assert.equal(matchFace(vector(0.1), [user('first', 0.1), user('second', 0.101)]), null);
  assert.equal(matchFace(vector(0.1), [{ username: 'broken', faceLogin: { model: MODEL, descriptor: [0.1] } }]), null);
});

test('templates from a different recognition model cannot log in', () => {
  const enrolled = user('first', 0.1);
  enrolled.faceLogin.model = 'another-model';
  assert.equal(matchFace(vector(0.1), [enrolled]), null);
});

test('registration needs three consistent samples from one face', () => {
  assert.equal(enrollSamples([vector(0.1), vector(0.1)]), null);
  assert.equal(enrollSamples([vector(0.1), vector(0.1), vector(0.8)]), null);
  const enrolled = enrollSamples([vector(0.1), vector(0.11), vector(0.12)]);
  assert.equal(enrolled.model, MODEL);
  assert.equal(enrolled.descriptor.length, 128);
  assert.ok(Math.abs(enrolled.descriptor[0] - 0.11) < 1e-10);
});

test('login requires three consecutive matches and resets after a missing or different face', () => {
  const tracker = createTracker();
  assert.equal(tracker.push('first'), false);
  assert.equal(tracker.push('first'), false);
  assert.equal(tracker.push(null), false);
  assert.equal(tracker.push('first'), false);
  assert.equal(tracker.push('second'), false);
  assert.equal(tracker.push('second'), false);
  assert.equal(tracker.push('second'), true);
});
