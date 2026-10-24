import test from 'node:test';
import assert from 'node:assert/strict';
import { profileTextProblem } from './text-policy.js';

test('allows ordinary multilingual profile text', () => {
  assert.equal(profileTextProblem(['Music, sports, games and walks', 'Berlin', 'I like reading']), false);
  assert.equal(profileTextProblem(['Музыка, спорт, прогулки', 'Гамбург']), false);
  assert.equal(profileTextProblem(['Musik, Sport und Spaziergänge', 'Bremen']), false);
});

test('rejects prohibited sexual wording and profanity in English', () => {
  assert.equal(profileTextProblem(['I want to post porn']), true);
  assert.equal(profileTextProblem(['This is fucking awful']), true);
});

test('rejects prohibited wording in Russian and German', () => {
  assert.equal(profileTextProblem(['Это блядский текст']), true);
  assert.equal(profileTextProblem(['Das ist scheiße']), true);
});

test('normalizes compatibility characters and catches basic obfuscation', () => {
  assert.equal(profileTextProblem(['p.o.r.n']), true);
  assert.equal(profileTextProblem(['ＦＵＣＫ']), true);
  assert.equal(profileTextProblem(['s.e.x']), true);
});

test('does not reject harmless words containing short prohibited substrings', () => {
  assert.equal(profileTextProblem(['I live in Essex and enjoy grapes']), false);
  assert.equal(profileTextProblem(['The grape harvest is excellent']), false);
});

test('ignores non-string fields safely', () => {
  assert.equal(profileTextProblem([null, undefined, 42, { text: 'porn' }]), false);
});
