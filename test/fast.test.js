import os from 'node:os';
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { compileFast, fastFromConfig } from '#src/index';

const arch = { pointerSize: 8, bits: 64, endianness: os.endianness() };

test('compileFast: basic LE struct', () => {
  const { PacketHeader } = compileFast(`
    //@LE
    struct PacketHeader {
      uint32_t tv_sec;
      uint32_t tv_usec;
      uint32_t caplen;
      uint32_t len;
    };
  `, arch);

  assert.equal(PacketHeader.size, 16);
  assert.equal(PacketHeader.name, 'PacketHeader');

  const buf = Buffer.alloc(16);
  PacketHeader.encodeLE(buf, 0, { tv_sec: 1, tv_usec: 2, caplen: 60, len: 60 });
  assert.equal(buf.toString('hex'), '01000000020000003c0000003c000000');

  assert.deepEqual(
    PacketHeader.decode(buf, 0),
    { tv_sec: 1, tv_usec: 2, caplen: 60, len: 60 }
  );
  assert.deepEqual(
    PacketHeader.decodeLE(buf, 0),
    { tv_sec: 1, tv_usec: 2, caplen: 60, len: 60 }
  );
});

test('compileFast: BE override produces big-endian byte stream', () => {
  const { Hdr } = compileFast(`
    //@LE
    struct __attribute__((__packed__)) Hdr {
      uint16_t a;
      uint32_t b;
    };
  `, arch);

  assert.equal(Hdr.size, 6);

  const buf = Buffer.alloc(Hdr.size);
  Hdr.encodeBE(buf, 0, { a: 0x1234, b: 0xdeadbeef });
  assert.equal(buf.slice(0, 2).toString('hex'), '1234');
  assert.equal(buf.slice(2, 6).toString('hex'), 'deadbeef');
  assert.deepEqual(Hdr.decodeBE(buf, 0), { a: 0x1234, b: 0xdeadbeef });
});

test('compileFast: per-field endianness override via meta', () => {
  const { Mixed } = compileFast(`
    //@LE
    struct __attribute__((__packed__)) Mixed {
      uint16_t a;
      //@BE this one is big-endian
      uint32_t b;
      uint16_t c;
    };
  `, arch);

  assert.equal(Mixed.size, 8);

  const buf = Buffer.alloc(Mixed.size);
  Mixed.encode(buf, 0, { a: 0x1234, b: 0xdeadbeef, c: 0x5678 });
  assert.equal(buf.slice(0, 2).toString('hex'), '3412');     // a — LE
  assert.equal(buf.slice(2, 6).toString('hex'), 'deadbeef'); // b — BE
  assert.equal(buf.slice(6, 8).toString('hex'), '7856');     // c — LE
  assert.deepEqual(Mixed.decode(buf, 0), { a: 0x1234, b: 0xdeadbeef, c: 0x5678 });
});

test('compileFast: signed and 64-bit BigInt fields', () => {
  const { S } = compileFast(`
    //@LE
    struct S {
      int32_t x;
      uint64_t y;
      int64_t z;
    };
  `, arch);

  const buf = Buffer.alloc(S.size);
  S.encodeLE(buf, 0, { x: -1, y: 0xffffffffffffffffn, z: -1n });
  assert.deepEqual(S.decodeLE(buf, 0), { x: -1, y: 0xffffffffffffffffn, z: -1n });
});

test('compileFast: respects struct alignment', () => {
  const { A } = compileFast(`
    //@LE
    struct A {
      uint8_t  a;
      uint32_t b;
    };
  `, arch);

  // a at 0, padding to 4, b at 4 — total 8 bytes (struct aligned to 4)
  assert.equal(A.size, 8);
});

test('compileFast: packed attribute removes padding', () => {
  const { P } = compileFast(`
    //@LE
    struct __attribute__((__packed__)) P {
      uint8_t  a;
      uint32_t b;
    };
  `, arch);

  assert.equal(P.size, 5);
});

test('compileFast: bit fields are rejected', () => {
  assert.throws(() => compileFast(`
    struct B {
      uint8_t a : 3;
      uint8_t b : 5;
    };
  `, arch), /bit fields/);
});

test('compileFast: arrays are rejected', () => {
  assert.throws(() => compileFast(`
    struct A {
      uint8_t name[16];
    };
  `, arch), /arrays/);
});

test('fastFromConfig: drives a single struct from AST', () => {
  const { PacketHeader } = compileFast(`
    //@LE
    struct PacketHeader {
      uint32_t tv_sec;
      uint32_t tv_usec;
      uint32_t caplen;
      uint32_t len;
    };
  `, arch);

  // Re-derive via fastFromConfig — confirms the helper works on raw AST.
  const cfg = {
    name: 'PH',
    attributes: null,
    members: [
      { type: 'uint32_t', vars: [{ name: 'a', d: [], bits: undefined }], meta: {} },
      { type: 'uint32_t', vars: [{ name: 'b', d: [], bits: undefined }], meta: {} },
    ],
    meta: { LE: true },
  };
  const PH = fastFromConfig(cfg, arch);
  assert.equal(PH.size, 8);

  const buf = Buffer.alloc(8);
  PH.encodeLE(buf, 0, { a: 0x11223344, b: 0x55667788 });
  assert.equal(buf.toString('hex'), '4433221188776655');
});
