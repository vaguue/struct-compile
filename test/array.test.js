import { strict as assert } from 'node:assert';
import test from 'node:test';

import { multiDimGet } from '#src/array';

test('multiDimGet', (t) => {
  const d = [2, 4];
  const ar = Array.from({ length: 2 }, () => Array.from({ length: 4 }, (_, i) => i));
  assert.deepEqual(multiDimGet(ar, d), ar);
});
