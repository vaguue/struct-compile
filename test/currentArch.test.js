import { strict as assert } from 'node:assert';
import test from 'node:test';

import { currentArch } from '#src/currentArch';

test('currentArch', (t) => {
  assert.equal(typeof currentArch.bits, 'number');
  assert.equal(typeof currentArch.pointerSize, 'number');
  assert.ok(['BE', 'LE'].includes(currentArch.endianness));
});
