import { strict as assert } from 'node:assert';
import test from 'node:test';

import { maybeNumber, forSize, createMask } from '#src/number';

test('maybeNumber', (t) => {
  assert.strictEqual(maybeNumber('123'), 123);
  assert.strictEqual(maybeNumber('kek'), 'kek');
});

test('forSize', (t) => {
  assert.strictEqual(forSize(32, '123'), 123);
  assert.strictEqual(typeof forSize(64, '123'), 'bigint');
  assert.strictEqual(forSize(8, 'A'), 0x41);
});

test('createMask', (t) => {
  assert.deepEqual(createMask(32, 32, false, 64), [0xffffffffn, 32n]);
  assert.deepEqual(createMask(16, 4, false, 32), [0xffff, 4]);
});
