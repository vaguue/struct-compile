import { strict as assert } from 'node:assert';
import test from 'node:test';

import { matchType } from '#src/dataTypes';

test('matchType', (t) => {
  assert.deepEqual(matchType('unsigned long', 0), ['unsigned long']);
  assert.deepEqual(matchType('uint32_t', 0), ['uint32_t']);

  const withPadding = 'AAAAAAAAAAAA unsigned \n\nlong   long AAAAAAAA';
  assert.deepEqual(matchType(withPadding, withPadding.indexOf('u')), ['unsigned \n\nlong   long']);

  assert.deepEqual(matchType('uint;32_t'), null);
});
