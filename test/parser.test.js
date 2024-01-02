import path, { dirname } from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import test from 'node:test';
import { strict as assert } from 'node:assert';

import _ from 'lodash';

import { parseInput } from '#src/parser';

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
                TypeKeyword: [{ image: 'uint8_t' }],
                memberName: [{ children: { Identifier: [{ image: 'c' }] } }],
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

