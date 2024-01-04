import { strict as assert } from 'node:assert';
import test from 'node:test';

import { compile } from '#src/index';

test('compile', (t) => {
  assert.deepEqual(compile('kek'), {});
  assert.deepEqual(compile('struct Kek;'), {});
  assert.deepEqual(compile(`
    struct Kek {
      uint32_t long;
    };
  `), {});

  const { Kek } = compile(`
    struct Kek {
      uint32_t i;
      char* p;
    };
  `);

  const kek = new Kek();
  kek.i = 32;

  assert.equal(kek.length, 16);
  assert.equal(Buffer.compare(kek.buffer, Buffer.from([0x20, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])), 0);
});
