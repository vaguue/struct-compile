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

test('reader', (t) => {
  const { Kek } = compile(`
    struct Kek {
      uint32_t val;
      char str[6];
    };
  `);

  const reader = Kek.createSingleReader({ toObject: false });

  reader.write(Buffer.from([0xAA, 0xBB, 0xAA, 0xBB]));

  assert.equal(reader.finished, false);

  reader.write(Buffer.from('lmfao\0\0\0'));

  assert.equal(reader.finished, true);
  assert.equal(reader.result.val, 0xBBAABBAA);
  assert.equal(reader.result.str.toString().slice(0, 5), 'lmfao');
});

test('readme', (t) => {
  const { Data, PDU } = compile(`
    //simple example
    struct Data {
      uint8_t c;
      int v;
      unsigned long da;
    };

    //@NE Network-endiannes for all members of this struct
    struct __attribute__((__packed__)) PDU {
      //Some useful comment
      char name /*in-between comment*/ [16];
      double dbl;
      int p;
    };
  `);

  const obj = new PDU();

  obj.name = 'seva';
  obj.dbl = 1.1;

  const buf = Buffer.from([0x73, 0x65, 0x76, 0x61,
                 0x00, 0x00, 0x00, 0x00,
                 0x00, 0x00, 0x00, 0x00,
                 0x00, 0x00, 0x00, 0x00,
                 0x3f, 0xf1, 0x99, 0x99,
                 0x99, 0x99, 0x99, 0x9a,
                 0x00, 0x00, 0x00, 0x00]);

  assert.equal(obj.length, 28);
  assert.deepEqual(obj.buffer, buf);

  const parsed = new PDU(
    Buffer.from([0x73, 0x65, 0x76, 0x61,
                 0x00, 0x00, 0x00, 0x00,
                 0x00, 0x00, 0x00, 0x00,
                 0x00, 0x00, 0x00, 0x00,
                 0x3f, 0xf1, 0x99, 0x99,
                 0x99, 0x99, 0x99, 0x9a,
                 0x00, 0x00, 0x00, 0x00])
  );

  assert.equal(parsed.name.toString().slice(0, 4), 'seva');
  assert.equal(parsed.dbl, 1.1);
});
