import { strict as assert } from 'node:assert';
import test from 'node:test';

import { traverseResult } from '#src/visitor';

import parsedBasic from './data/parsed-basic.json' assert { type: 'json' };
import parsedMoreFeatures from './data/parsed-more-features.json' assert { type: 'json' };


test('visitor', (t) => {
  const resultBasic = traverseResult(parsedBasic);
  assert.deepStrictEqual(resultBasic, [{
    name: 'Basic',
    attributes: null,
    members: [{
      type: 'uint8_t',
      vars: [{ name: 'c', d: [] }],
      meta: {}
    }],
    meta:{},
  }]);

  const resultMoreFeatures = traverseResult(parsedMoreFeatures);
  assert.deepStrictEqual(resultMoreFeatures, [
    {
      name: 'Example1',
      attributes: { packed: true, aligned: 4 },
      members: [
        { 
          type: 'uint8_t',
          meta: { BE: true, LE: true },
          vars: [{ name: 'c', d: [] }]
        },
        { 
          type: 'int',
          meta: {},
          vars: [{ name: 'v', d: [] }]
        },
        { 
          type: 'unsigned long',
          meta: {},
          vars: [{ name: 'da', d: [] }]
        },
      ],
      meta: {}
    },
    {
      name: 'Example2',
      attributes: { packed: true },
      members: [
        {
          type: 'char',
          meta: {},
          vars: [{ name: 'name', d: [16] }]
        },
        {
          type: 'int *',
          meta: {},
          vars: [{ name: 'p', d: [] }]
        },
        {
          type: 'uint32_t *',
          meta: {},
          vars: [{ name: 'da', d: [0] }]
        },
      ],
      meta: { BE: true }
    }
  ]);

});
