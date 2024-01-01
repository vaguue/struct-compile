import path, { dirname } from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import test from 'node:test';
import { strict as assert } from 'node:assert';

import _ from 'lodash';

import { parseInput } from '#src/parser';
import { traverseResult } from '#src/visitor';

import parsedBasic from './data/parsed-basic.json' assert { type: 'json' };
import parsedMoreFeatures from './data/parsed-more-features.json' assert { type: 'json' };

const __dirname = dirname(fileURLToPath(import.meta.url));
const [basic, moreFeatures] = await Promise.all(['basic.h', 'more-features.h'].map(e => 
  fs.readFile(path.resolve(__dirname, '..', 'examples', e)).then(buf => buf.toString())
));

function lameComparator(objValue, othValue) {
  if (typeof objValue == 'object' && typeof othValue == 'object') {
    Object.keys(objValue).forEach(k => {
      if (othValue[k] === undefined) {
        delete objValue[k];
      }
    });
  }
  if (othValue === undefined) return true;
}

function compareLame(obj1, obj2) {
  assert.ok(_.isEqualWith(obj1, obj2, lameComparator), 'Unexpected result from parser');
}

test('parser', (t) => {
  const { cstOutput } = parseInput(basic);
  compareLame(cstOutput, {
    name: 'structs',
    children: {
      struct: [
        {
          name: 'struct',
          children: {
            Struct: [{ image: 'struct' }],
            Identifier: [{ image: 'Basic' }],
            BracesOpen: [{ image: '{' }],
            member: [{
              name: 'member',
              children: {
                Identifier: [{ image: 'uint8_t' }, { image: 'c' }],
                Semicolon: [{ image: ';' }]
              }
            }],
            BracesClose: [{ image: '}' }],
            Semicolon: [{ image: ';' }]
          }
        }
      ]
    }
  });

  assert.ok(parseInput(moreFeatures));
});

test('visitor', (t) => {
  const resultBasic = traverseResult(parsedBasic);
  assert.deepStrictEqual(resultBasic, [{
    name: 'Basic',
    attributes: null,
    members: [{
      value: ['uint8_t','c'],
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
        { value: [ 'uint8_t', 'c' ], meta: { BE: true, LE: true } },
        { value: [ 'int', 'v' ], meta: {} },
        { value: [ 'unsigned', 'long', 'da' ], meta: {} }
      ],
      meta: {}
    },
    {
      name: 'Example2',
      attributes: { packed: true },
      members: [
        { value: [ 'char', 'name', '[16]' ], meta: {} },
        { value: [ 'int*', 'p' ], meta: {} },
        { value: [ 'uint32_t*', 'da', '[]' ], meta: {} }
      ],
      meta: { BE: true }
    }
  ]);

});
