import os from 'node:os';
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { createMany } from '#src/createStruct/index';

import traversedBasic from './data/traversed-basic.json' assert { type: 'json' };
import traversedMoreFeatures from './data/traversed-more-features.json' assert { type: 'json' };

test('error handling', async (t) => {
  const { Basic } = createMany(traversedBasic, { pointerSize: 8, bits: 64, endianness: os.endianness() }, Buffer);
  assert.throws(() => new Basic(Buffer.alloc(0)), { message: /Invalid buffer length/ });

  const basic = new Basic();
  assert.throws(() => basic.buffer = Buffer.alloc(0), { message: /Invalid buffer length/ });
  assert.throws(() => basic.buffer = 'data', { message: /Invalid buffer type/ });
});

test('createMany basic', async (t) => {
  const { Basic } = createMany(traversedBasic, { pointerSize: 8, bits: 64, endianness: os.endianness() }, Buffer);

  await t.test('basic usage', (t) => {
    const basic = new Basic();
    assert.equal(basic.length, 1);
    basic.c = 0x42;
    assert.equal(basic.c, 0x42);
    assert.deepEqual(basic.toObject(), { c: 0x42 });
    assert.equal(Buffer.compare(basic.buffer, Buffer.from([0x42])), 0);
  });

  await t.test('constructor with fields', (t) => {
    const basic = new Basic({ c: 0x42 });
    assert.equal(basic.c, 0x42);
    assert.equal(Buffer.compare(basic.buffer, Buffer.from([0x42])), 0);
  });
});

test('merge', async (t) => {
  const { Example1 } = createMany(traversedMoreFeatures, { pointerSize: 8, bits: 64, endianness: os.endianness() }, Buffer);

  const e1 = new Example1();

  e1.merge({ c: 'a', v: 4, da: 0xaaaabbbbaaaa });

  assert.deepEqual(e1.toObject(), { c: 97, v: 4, da: 0xaaaabbbbaaaan });

  assert.equal(Buffer.compare(e1.buffer, 
    Buffer.from([0x61, 0x00, 0x00, 0x00, 0x04, 0xaa, 0xaa, 0xbb, 0xbb, 0xaa, 0xaa, 0x00, 0x00, 0x00, 0x00, 0x00])), 0);
});

test('createMany with more features', (t) => {
  const { Example1, Example2 } = createMany(traversedMoreFeatures, { pointerSize: 8, bits: 64, endianness: os.endianness() }, Buffer);
  assert.equal(Example1.comments.v, '@BE this value will be big-endian');
  assert.equal(Example2.comments.main, '@NE');
  const e1 = new Example1();
  assert.equal(e1.length, 16);
  e1.c = 'A';
  assert.equal(e1.c, 0x41);
  e1.v = 0x0AAAAAAA;
  assert.equal(e1.v, 0x0AAAAAAA);
  e1.da = 0xAAAAAAAABBBBBBBBn;
  assert.equal(e1.da, 0xAAAAAAAABBBBBBBBn);
  
  assert.deepEqual(e1.toObject(), { c: 65, v: 178956970, da: 12297829382759365563n });
  assert.equal(Buffer.compare(e1.buffer, Buffer.from([0x41, 0x0a, 0xaa, 0xaa, 0xaa, 0xbb, 0xbb, 0xbb, 0xbb, 0xaa, 0xaa, 0xaa, 0xaa, 0x00, 0x00, 0x00])), 0);

  const e2 = new Example2();
  assert.equal(e2.length, 32);

  e2.dbl = 1.1;
  e2.p = 0xAAAAAAAABBBBBBBBn;
  assert.equal(e2.dbl, 1.1);
  assert.equal(e2.p, 0xAAAAAAAABBBBBBBBn);

  e2.name = 'Sava';

  assert.equal(e2.name.toString().slice(0, 4), 'Sava');

  e2.name[1] = 'e';
  e2.name[4] = ' ';
  e2.name[5] = 'D';
  e2.name[6] = '.';
  assert.throws(() => e2.name[16] = '?'.charCodeAt(0));

  assert.equal(e2.name.toString().slice(0, 7), 'Seva D.');
  assert.equal(e2.name[1], 'e'.charCodeAt(0));
});

test('createMany with more array access', async (t) => {
  const { Example3 } = createMany(traversedMoreFeatures, { pointerSize: 8, bits: 64, endianness: os.endianness() }, Buffer);
  const testArray = Array.from({ length: 16 }, () => Array.from({ length: 16 }, () => 0));
  testArray[0][1] = 1.1;
  testArray[0][3] = 2.2;
  testArray[1][0] = 1.1;

  await t.test('accessors', (t) => {
    const e = new Example3();
    assert.equal(e.length, 2056);

    e.c = 123;
    assert.equal(e.c, 123);

    e.m[0][1] = 1.1;
    e.m[0][3] = 2.2;
    assert.equal(e.m[0][1], 1.1);
    assert.equal(e.m[0][3], 2.2);
    e.m[1] = Buffer.from([0x9a, 0x99, 0x99, 0x99, 0x99, 0x99, 0xf1, 0x3f]);
    assert.equal(e.m[1][0], 1.1);

    assert.deepEqual(e.toObject().m, testArray);
  });

  await t.test('constructor with buffer', (t) => {
    const e = new Example3({ c: 123, m: Buffer.from([0x9a, 0x99, 0x99, 0x99, 0x99, 0x99, 0xf1, 0x3f]) });

    assert.equal(e.c, 123);
    assert.equal(e.m[0][0], 1.1);
  });

  await t.test('constructor with array', (t) => {
    const e = new Example3({ c: 123, m: testArray });

    assert.deepEqual(e.toObject().m, testArray);
  });
});

test('createMany with bitfields', async (t) => {
  const { Example4 } = createMany(traversedMoreFeatures, { pointerSize: 8, bits: 64, endianness: os.endianness() }, Buffer);

  const e = new Example4;
  e.version = 0x06;
  e.headerLength = 0x0a;
  e.typeOfService = 0xcc;
  e.something = 0x11;

  assert.equal(Buffer.compare(e.buffer, Buffer.from([0xa6, 0x01, 0xcc])), 0);
  assert.equal(e.version, 0x06);
  assert.equal(e.headerLength, 0x0a);
  assert.equal(e.typeOfService, 0xcc);
  assert.equal(e.something, 0x01);
});
