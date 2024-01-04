import { strict as assert } from 'node:assert';
import test from 'node:test';

import { maybeNumber } from '#src/number';

test('maybeNumber', (t) => {
  assert.strictEqual(maybeNumber('123'), 123);
  assert.strictEqual(maybeNumber('kek'), 'kek');
});
