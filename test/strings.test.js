import { strict as assert } from 'node:assert';
import test from 'node:test';

import { isWhitespace, skipWhitespace, trim, isCapital, trimWithEllipsis } from '#src/strings';

test('isWhitespace', (t) => {
  assert.ok(isWhitespace(' '));
  assert.ok(isWhitespace('\n'));
  assert.ok(!isWhitespace('A'));
});

test('skipWhitespace', (t) => {
  const str = '1234      5678';
  assert.equal(skipWhitespace(str, str.indexOf(' ')), str.indexOf('5'));
});

test('trim', (t) => {
  const str = '\n1234  \n   5678   ';
  assert.equal(trim(str), '1234 5678');
});

test('isCapital', (t) => {
  assert.equal(isCapital('Kek'), true);
  assert.equal(isCapital('lol'), false);
});

test('trimWithEllipsis', (t) => {
  assert.equal(trimWithEllipsis('Kek', 2), 'Ke...');
  assert.equal(trimWithEllipsis('Kek', 3), 'Kek');
});
