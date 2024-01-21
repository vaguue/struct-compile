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
    meta: {},
  }]);

  const resultMoreFeatures = traverseResult(parsedMoreFeatures);
  assert.deepStrictEqual(resultMoreFeatures, [
    {
      name: 'Example1',
      attributes: { packed: true, aligned: 4 },
      members: [
        { 
          type: 'uint8_t',
          meta: {},
          vars: [{ name: 'c', d: [] }]
        },
        { 
          type: 'int',
          comment: '@BE this value will be big-endian',
          meta: { BE: true },
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
          type: 'double',
          meta: {},
          vars: [{ name: 'dbl', d: [] }]
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
      meta: { NE: true },
      comment: '@NE',
    },
    {
      attributes: null,
      members: [
        {
          meta: {},
          type: 'uint8_t',
          vars: [ { d: [], name: 'c' } ]
        },
        {
          meta: {},
          type: 'double',
          vars: [{ d: [16, 16], name: 'm' }]
        }
      ],
      meta: {},
      name: 'Example3'
    },
    {
      attributes: {},
      members: [
        {
          meta: {},
          type: 'uint8_t',
          vars: [{ d: [], name: 'version', bits: 4 }, { d: [], name: 'headerLength', bits: 4 }, { bits: 3, d: [], name: 'something' }]
        },
        {
          meta: {},
          type: 'uint8_t',
          vars: [{ d: [], name: 'typeOfService' }]
        }
      ],
      meta: {},
      name: 'Example4'
    }
  ]);

});
