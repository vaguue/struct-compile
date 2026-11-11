import os from 'node:os';
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { compile, fromConfig } from '#src/index';

const arch = { pointerSize: 8, bits: 64, endianness: os.endianness() };

test('codec: basic LE struct', () => {
  const { PacketHeader } = compile(`
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

test('codec: BE override produces big-endian byte stream', () => {
  const { Hdr } = compile(`
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

test('codec: per-field endianness override via meta', () => {
  const { Mixed } = compile(`
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

test('codec: signed and 64-bit BigInt fields', () => {
  const { S } = compile(`
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

test('codec: respects struct alignment', () => {
  const { A } = compile(`
    //@LE
    struct A {
      uint8_t  a;
      uint32_t b;
    };
  `, arch);

  // a at 0, padding to 4, b at 4 — total 8 bytes (struct aligned to 4)
  assert.equal(A.size, 8);
});

test('codec: packed attribute removes padding', () => {
  const { P } = compile(`
    //@LE
    struct __attribute__((__packed__)) P {
      uint8_t  a;
      uint32_t b;
    };
  `, arch);

  assert.equal(P.size, 5);
});

test('codec: fromConfig drives a single struct from AST', () => {
  const { PacketHeader } = compile(`
    //@LE
    struct PacketHeader {
      uint32_t tv_sec;
      uint32_t tv_usec;
      uint32_t caplen;
      uint32_t len;
    };
  `, arch);

  const cfg = {
    name: 'PH',
    attributes: null,
    members: [
      { type: 'uint32_t', vars: [{ name: 'a', d: [], bits: undefined }], meta: {} },
      { type: 'uint32_t', vars: [{ name: 'b', d: [], bits: undefined }], meta: {} },
    ],
    meta: { LE: true },
  };
  const PH = fromConfig(cfg, arch);
  assert.equal(PH.size, 8);

  const buf = Buffer.alloc(8);
  PH.encodeLE(buf, 0, { a: 0x11223344, b: 0x55667788 });
  assert.equal(buf.toString('hex'), '4433221188776655');
});

test('codec: bit fields are packed into their storage unit', () => {
  const { IP, TCPish } = compile(`
    struct IP {
      uint8_t version:4,
              headerLength:4,
              something:3;
      uint8_t typeOfService;
    } __attribute__((packed));

    //@NE
    struct TCPish {
      uint16_t src;
      //@LE
      uint16_t
        reserved:4,
        dataOffset:4,
        fin:1,
        syn:1,
        rst:1;
      uint16_t window;
    } __attribute__((packed));
  `, arch);

  const values = { version: 6, headerLength: 10, something: 1, typeOfService: 0xcc };
  const buf = Buffer.alloc(IP.size);
  IP.encode(buf, 0, values);
  assert.deepEqual(buf, Buffer.from([0xa6, 0x01, 0xcc]));
  assert.deepEqual(IP.decode(buf, 0), values);
  assert.deepEqual(new IP(buf).toObject(), values);

  const tcp = { src: 443, reserved: 0, dataOffset: 5, fin: 0, syn: 1, rst: 0, window: 1024 };
  const tcpBuf = Buffer.alloc(TCPish.size);
  TCPish.encode(tcpBuf, 0, tcp);
  assert.equal(tcpBuf.toString('hex'), '01bb' + '5002' + '0400');
  assert.deepEqual(TCPish.decode(tcpBuf), tcp);

  const instance = new TCPish(tcpBuf);
  instance.rst = 1;
  instance.syn = 0;
  assert.equal(tcpBuf.toString('hex'), '01bb' + '5004' + '0400');
  assert.deepEqual(TCPish.decode(tcpBuf), instance.toObject());
});

test('codec: wide bit fields', () => {
  const { W } = compile(`
    //@LE
    struct W {
      uint32_t a:1, b:31;
      uint32_t full:32;
      uint64_t lo:40, hi:24;
    };
  `, arch);

  assert.equal(W.size, 16);

  const w = new W();
  w.b = 0x7fffffff;
  w.full = 0xdeadbeef;
  w.lo = 0xaabbccddeen;
  w.hi = 0x123456;
  assert.deepEqual(w.toObject(), { a: 0, b: 0x7fffffff, full: 0xdeadbeef, lo: 0xaabbccddeen, hi: 0x123456n });
  w.a = 1;
  w.b = 0;
  assert.equal(w.buffer.readUInt32LE(0), 1);
  assert.deepEqual(W.decode(w.buffer), w.toObject());

  const buf = Buffer.alloc(W.size);
  W.encode(buf, 0, w.toObject());
  assert.deepEqual(buf, w.buffer);
});

test('codec: arrays', () => {
  const { A } = compile(`
    //@BE
    struct __attribute__((__packed__)) A {
      uint8_t mac[6];
      int16_t grid[2][3];
      char big[40];
      uint16_t tail;
    };
  `, arch);

  assert.equal(A.size, 6 + 12 + 40 + 2);

  const values = {
    mac: [1, 2, 3, 4, 5, 255],
    grid: [[1, -2, 3], [-4, 5, -6]],
    big: Array.from({ length: 40 }, (_, i) => i - 20),
    tail: 0xabcd,
  };

  const buf = Buffer.alloc(A.size + 3);
  A.encode(buf, 3, values);
  assert.deepEqual(A.decode(buf, 3), values);
  assert.deepEqual(new A(buf.subarray(3)).toObject(), values);
  assert.equal(buf.readInt16BE(3 + 6 + 2), -2);
  assert.equal(buf.readInt16LE(3 + 6 + 2), A.decodeLE(buf, 3).grid[0][1]);

  // Buffers and strings are accepted for array members too
  A.encode(buf, 3, { ...values, mac: Buffer.from('aabbccddeeff', 'hex'), big: 'hi' });
  const decoded = A.decode(buf, 3);
  assert.deepEqual(decoded.mac, [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]);
  assert.deepEqual(decoded.big.slice(0, 3), [104, 105, -18]);
});

test('codec: array setters stay within the member', () => {
  const { S } = compile(`
    struct __attribute__((__packed__)) S {
      uint8_t before;
      char name[4];
      uint8_t after;
    };
  `, arch);

  const s = new S();
  s.name = 'overflowing';
  assert.equal(s.after, 0);
  assert.equal(s.name.toString(), 'over');

  s.name = Buffer.from('123456');
  assert.equal(s.after, 0);
  assert.equal(s.before, 0);
  assert.equal(s.name.toString(), '1234');
});

test('codec: decode matches the lazy accessors', () => {
  const { M } = compile(`
    struct M {
      int8_t a;
      //@BE
      int16_t b;
      //@LE
      int16_t c;
      //@BE
      int32_t d;
      uint32_t e;
      //@BE
      uint64_t f;
      float g;
      //@BE
      double h;
      char *p;
    };
  `, arch);

  const buf = Buffer.alloc(M.size + 1);
  for (let i = 0; i < buf.length; ++i) {
    buf[i] = (i * 151 + 0x87) & 0xff;
  }

  const lazy = new M(buf.subarray(1));
  const decoded = M.decode(buf, 1);
  assert.deepEqual(decoded, lazy.toObject());
  assert.equal(decoded.a, buf.readInt8(1));
  assert.equal(decoded.b, buf.readInt16BE(1 + 2));
  assert.equal(decoded.c, buf.readInt16LE(1 + 4));
  assert.equal(decoded.d, buf.readInt32BE(1 + 8));
  assert.equal(decoded.e, os.endianness() == 'LE' ? buf.readUInt32LE(1 + 12) : buf.readUInt32BE(1 + 12));
  assert.equal(decoded.f, buf.readBigUInt64BE(1 + 16));

  const out = Buffer.alloc(M.size);
  M.encode(out, 0, decoded);
  const padded = new M(out).toObject();
  assert.deepEqual(padded, decoded);
});

test('codec: out of range decode throws', () => {
  const { S } = compile(`struct S { uint32_t a; uint32_t b; };`, arch);
  assert.throws(() => S.decode(Buffer.alloc(7), 0), RangeError);
  assert.throws(() => S.decode(Buffer.alloc(8), 1), RangeError);
  assert.throws(() => S.decode(Buffer.alloc(8), -1), RangeError);
  assert.deepEqual(S.decode(Buffer.alloc(8)), { a: 0, b: 0 });
});

test('codec: encode coerces values like the setters do', () => {
  const { S } = compile(`
    //@LE
    struct S { char c; uint64_t big; };
  `, arch);

  const buf = Buffer.alloc(S.size);
  S.encode(buf, 0, { c: 'A', big: 7 });
  assert.deepEqual(S.decode(buf), { c: 65, big: 7n });
});

test('codec: custom buffer implementation without indexed access', () => {
  class Wrapped {
    constructor(buf) { this.buf = buf; this.length = buf.length; }
    static alloc(n) { return new Wrapped(Buffer.alloc(n)); }
    readUInt16BE(o) { return this.buf.readUInt16BE(o); }
    writeUInt16BE(v, o) { return this.buf.writeUInt16BE(v, o); }
    readUInt8(o) { return this.buf.readUInt8(o); }
    writeUInt8(v, o) { return this.buf.writeUInt8(v, o); }
  }

  const { S } = compile(`
    //@BE
    struct S { uint16_t a; uint8_t x:4, y:4; };
  `, arch, Wrapped);

  const s = new S({ a: 0x1234, x: 1, y: 2 });
  assert.equal(s.buffer.buf.toString('hex'), '12342100');
  assert.deepEqual(s.toObject(), { a: 0x1234, x: 1, y: 2 });
  assert.deepEqual(S.decode(s.buffer, 0), { a: 0x1234, x: 1, y: 2 });
});

test('codec: fields registered after compilation', () => {
  const { S } = compile(`struct S { uint8_t a; };`, arch);

  class Sub extends S {
    get twice() { return this.a * 2; }
    set twice(v) { this.a = v / 2; }
  }
  Sub.prototype.config.fields.twice = { d: [] };

  const sub = new Sub({ twice: 10 });
  assert.deepEqual(sub.toObject(), { a: 5, twice: 10 });
  sub.merge({ twice: 4 });
  assert.equal(sub.a, 2);
});

test('codec: writes keep Buffer validation', () => {
  const { S } = compile(`
    //@BE
    struct S { uint8_t a; int8_t b; uint16_t c; int16_t d; uint32_t e; int32_t f; };
  `, arch);

  const s = new S();
  const values = { a: 255, b: -128, c: 0xfffe, d: -32768, e: 0xfffffffe, f: -2147483648 };
  s.merge(values);
  assert.deepEqual(s.toObject(), values);
  assert.equal(s.buffer.readUInt16BE(2), 0xfffe);
  assert.equal(s.buffer.readInt32BE(12), -2147483648);

  const buf = Buffer.alloc(S.size);
  S.encode(buf, 0, values);
  assert.deepEqual(buf, s.buffer);
  S.encodeLE(buf, 0, values);
  assert.equal(buf.readUInt16LE(2), 0xfffe);
  assert.equal(buf.readUInt32LE(8), 0xfffffffe);

  for (const [key, bad] of [['a', 256], ['a', -1], ['b', 128], ['c', 65536], ['d', -32769], ['e', -1], ['e', 2 ** 32], ['f', 2 ** 31]]) {
    assert.throws(() => { s[key] = bad; }, RangeError, `${key} = ${bad}`);
    assert.throws(() => S.encode(buf, 0, { ...values, [key]: bad }), RangeError, `encode ${key} = ${bad}`);
  }
  assert.deepEqual(s.toObject(), values);

  // fractional values are truncated by Buffer, same as before
  s.c = 1.9;
  assert.equal(s.c, Buffer.alloc(2).writeUInt16BE(1.9) && 1);

  assert.throws(() => S.encode(Buffer.alloc(S.size - 1), 0, values), RangeError);
});
