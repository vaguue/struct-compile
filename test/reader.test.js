import { strict as assert } from 'node:assert';
import test from 'node:test';

import { SingleStructReader, StructReader } from '#src/reader';

class Struct {
  constructor(buf) {
    this.buffer = buf;
  }
};

Struct.prototype.config = {
  length: 20,
};

const getPromise = () => {
  let resolve, reject;

  const p = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { p, resolve, reject };
};

test('SingleStructReader', async (t) => {
  const { p, resolve, reject } = getPromise();
  const reader = new SingleStructReader({ Struct });

  reader.write(Buffer.from(Array.from({ length: 18 }, () => 0xAA)));
  reader.write(Buffer.from(Array.from({ length: 5 }, () => 0xBB)));

  assert.equal(Buffer.compare(reader.remaining, Buffer.from([0xBB, 0xBB, 0xBB])), 0);
});

test('StructReader', async (t) => {
  await t.test('Basic usage', (t) => {
    const { p, resolve, reject } = getPromise();
    const reader = new StructReader({ Struct, toObject: false });

    let count = 0;

    reader.write(Buffer.from(Array.from({ length: 28 }, () => 0xAA)));
    reader.write(Buffer.from(Array.from({ length: 20 }, () => 0xBB)));

    reader.on('data', obj => {
      if (count == 0) {
        assert.equal(Buffer.compare(obj.buffer, 
          Buffer.from(Array.from({ length: 20 }, () => 0xAA))), 0);
      }
      else if (count == 1) {
        assert.equal(Buffer.compare(obj.buffer, 
          Buffer.from([...Array.from({ length: 8 }, () => 0xAA), ...Array.from({ length: 12 }, () => 0xBB)])), 0);
        resolve();
      }

      count++;
    });

    return p;
  });
});
