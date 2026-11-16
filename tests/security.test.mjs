import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hashPassword,
  passwordMatches,
  roleForEmail,
  setupCodeMatches,
} from '../server/security.mjs';

test('password hashes are salted and verifiable', () => {
  const first = hashPassword('a-long-private-password');
  const second = hashPassword('a-long-private-password');
  assert.notEqual(first, second);
  assert.equal(passwordMatches('a-long-private-password', first), true);
  assert.equal(passwordMatches('the-wrong-password', first), false);
});

test('only the configured exact emails receive privileged roles', () => {
  assert.equal(roleForEmail(' Owner@Example.com ', 'owner@example.com', 'admin@example.com'), 'OWNER');
  assert.equal(roleForEmail('admin@example.com', 'owner@example.com', 'admin@example.com'), 'ADMIN');
  assert.equal(roleForEmail('friend@example.com', 'owner@example.com', 'admin@example.com'), 'MEMBER');
});

test('the temporary setup code must match', () => {
  assert.equal(setupCodeMatches('one-time-code', 'one-time-code'), true);
  assert.equal(setupCodeMatches('  one-time-code  ', 'one-time-code'), true);
  assert.equal(setupCodeMatches('BOOTSTRAP_CODE=one-time-code', 'one-time-code'), true);
  assert.equal(setupCodeMatches('"one-time-code"', 'one-time-code'), true);
  assert.equal(setupCodeMatches('wrong-code', 'one-time-code'), false);
  assert.equal(setupCodeMatches('', 'one-time-code'), false);
});
