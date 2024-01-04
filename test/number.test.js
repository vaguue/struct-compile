import { strict as assert } from 'node:assert';
import test from 'node:test';

import { maybeNumber, forSize } from '#src/number';

test('maybeNumber', (t) => {
  assert.strictEqual(maybeNumber('123'), 123);
  assert.strictEqual(maybeNumber('kek'), 'kek');
});

test('forSize', (t) => {
  assert.strictEqual(forSize(32, '123'), 123);
  assert.strictEqual(typeof forSize(64, '123'), 'bigint');
  assert.strictEqual(forSize(8, 'A'), 0x41);
});
