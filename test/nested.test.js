import os from 'node:os';
import { strict as assert } from 'node:assert';
import test from 'node:test';

import { compile, fromConfig } from '#src/index';

const arch = { pointerSize: 8, bits: 64, endianness: 'LE' };

test('nested: reference to a previously declared struct', () => {
  const { Point, Line } = compile(`
    struct Point {
      uint16_t x;
      uint16_t y;
    };

    struct Line {
      uint8_t color;
      struct Point from;
      struct Point to;
    };
  `, arch);

  assert.equal(Point.size, 4);
  // 1 byte + 1 byte of padding (Point is aligned to 2) + 2 * 4
  assert.equal(Line.size, 10);

  const values = { color: 7, from: { x: 1, y: 2 }, to: { x: 3, y: 4 } };
  const buf = Buffer.alloc(Line.size + 1);
  Line.encode(buf, 1, values);
  assert.equal(buf.toString('hex'), '00' + '0700' + '01000200' + '03000400');
  assert.deepEqual(Line.decode(buf, 1), values);

  const line = new Line(buf.subarray(1));
  assert.deepEqual(line.toObject(), values);

  // lazy access returns a view of the nested struct
  assert.ok(line.to instanceof Point);
  assert.equal(line.to.y, 4);
  line.to.y = 0x1234;
  assert.equal(buf.readUInt16LE(1 + 8), 0x1234);

  // assignment accepts objects (merged), instances and buffers
  line.from = { y: 9 };
  assert.deepEqual(line.from.toObject(), { x: 1, y: 9 });
  line.from = line.to;
  assert.deepEqual(line.from.toObject(), { x: 3, y: 0x1234 });
  line.from = Buffer.from([1, 0, 2, 0, 0xff, 0xff]);
  assert.deepEqual(line.toObject(), { color: 7, from: { x: 1, y: 2 }, to: { x: 3, y: 0x1234 } });

  const built = new Line({ color: 1, to: { x: 5 } });
  assert.deepEqual(built.toObject(), { color: 1, from: { x: 0, y: 0 }, to: { x: 5, y: 0 } });
});

test('nested: inline, anonymous and deeply nested definitions', () => {
  const { Packet, Tag } = compile(`
    struct __attribute__((packed)) Packet {
      uint8_t type;
      struct {
        uint8_t major;
        uint8_t minor;
      } version;
      struct Tag {
        uint8_t id;
        struct { uint16_t lo; uint16_t hi; } range;
      } __attribute__((packed)) first, second;
      // members of an anonymous struct belong to the enclosing one
      struct {
        uint8_t a:4, b:4;
        uint8_t c;
      };
      struct Tag last;
    };
  `, arch);

  // Tag isn't a top level declaration, but can be referenced after its definition
  assert.equal(Tag, undefined);
  assert.equal(Packet.size, 1 + 2 + 5 + 5 + 2 + 5);

  const values = {
    type: 1,
    version: { major: 2, minor: 3 },
    first: { id: 4, range: { lo: 5, hi: 6 } },
    second: { id: 7, range: { lo: 8, hi: 9 } },
    a: 0xa,
    b: 0xb,
    c: 0xc,
    last: { id: 10, range: { lo: 11, hi: 12 } },
  };

  const packet = new Packet(values);
  assert.equal(packet.buffer.toString('hex'), '01' + '0203' + '0405000600' + '0708000900' + 'ba0c' + '0a0b000c00');
  assert.deepEqual(packet.toObject(), values);
  assert.deepEqual(Packet.decode(packet.buffer), values);
  assert.equal(packet.second.range.hi, 9);
  assert.equal(packet.b, 0xb);

  const buf = Buffer.alloc(Packet.size);
  Packet.encode(buf, 0, values);
  assert.deepEqual(buf, packet.buffer);
});

test('nested: arrays of structs', () => {
  const { Table } = compile(`
    struct Entry {
      uint8_t key;
      uint8_t value;
    };

    struct Table {
      uint8_t count;
      struct Entry entries[3];
      struct Entry grid[2][2];
      struct Entry many[40];
    };
  `, arch);

  assert.equal(Table.size, 1 + 6 + 8 + 80);

  const entry = (i) => ({ key: i, value: i * 2 });
  const values = {
    count: 3,
    entries: [entry(1), entry(2), entry(3)],
    grid: [[entry(4), entry(5)], [entry(6), entry(7)]],
    many: Array.from({ length: 40 }, (_, i) => entry(i)),
  };

  const buf = Buffer.alloc(Table.size);
  Table.encode(buf, 0, values);
  assert.equal(buf.subarray(0, 7).toString('hex'), '03' + '0102' + '0204' + '0306');
  assert.deepEqual(Table.decode(buf), values);

  const table = new Table(buf);
  assert.deepEqual(table.toObject(), values);
  assert.equal(table.entries[2].value, 6);
  assert.equal(table.grid[1][0].key, 6);
  assert.throws(() => table.entries[3]);

  // elements are views, writes land in the buffer
  table.entries[1].value = 0x55;
  assert.equal(buf[4], 0x55);
  table.entries[0] = { key: 9 };
  assert.deepEqual(table.entries[0].toObject(), { key: 9, value: 2 });

  const merged = new Table({ entries: [{ key: 1 }, { value: 2 }] });
  assert.deepEqual(merged.toObject().entries, [{ key: 1, value: 0 }, { key: 0, value: 2 }, { key: 0, value: 0 }]);
});

test('nested: alignment', () => {
  const { Outer, Packed } = compile(`
    struct Inner {
      uint8_t a;
      uint32_t b;
    };

    struct Outer {
      uint8_t x;
      struct Inner inner;
      uint8_t y;
    };

    struct __attribute__((packed)) Packed {
      uint8_t x;
      struct Inner inner;
    };
  `, arch);

  // x at 0, inner aligned to 4 (8 bytes), y at 12, padded to 16
  assert.equal(Outer.size, 16);
  assert.equal(Outer.align, 4);
  const outer = new Outer({ x: 1, inner: { a: 2, b: 3 }, y: 4 });
  assert.equal(outer.buffer.toString('hex'), '01000000' + '0200000003000000' + '04000000');

  // packing the outer struct doesn't repack the inner one
  assert.equal(Packed.size, 9);
});

test('nested: endianness is inherited unless the inner struct sets it', () => {
  const { Inner, Fixed, Outer } = compile(`
    struct Inner {
      uint16_t v;
    };

    //@LE
    struct Fixed {
      uint16_t v;
    };

    //@BE
    struct Outer {
      struct Inner a;
      struct Fixed b;
      //@LE
      struct Inner c;
    };
  `, arch);

  const values = { a: { v: 0x0102 }, b: { v: 0x0304 }, c: { v: 0x0506 } };
  const buf = Buffer.alloc(Outer.size);
  Outer.encode(buf, 0, values);
  assert.equal(buf.toString('hex'), '0102' + '0403' + '0605');
  assert.deepEqual(Outer.decode(buf), values);
  assert.deepEqual(new Outer(buf).toObject(), values);

  const outer = new Outer(buf);
  // the default byte order differs from the standalone Inner, so it's another class
  assert.ok(!(outer.a instanceof Inner));
  assert.ok(outer.b instanceof Fixed);
  assert.ok(outer.c instanceof Inner);

  // forced variants apply to the whole tree
  Outer.encodeLE(buf, 0, values);
  assert.equal(buf.toString('hex'), '0201' + '0403' + '0605');
  assert.deepEqual(Outer.decodeLE(buf), values);
  assert.equal(Outer.decodeBE(buf).a.v, 0x0201);
});

test('nested: errors', () => {
  assert.throws(() => compile(`struct A { struct Missing m; };`, arch), /Unknown type: struct Missing/);
  assert.throws(() => compile(`struct A { struct A self; };`, arch), /Unknown type/);
  assert.throws(() => compile(`
    struct A { uint8_t a; };
    struct B { union A a; };
  `, arch), /declared as a struct/);
  assert.throws(() => compile(`struct A { uint8_t a; struct { uint8_t a; }; };`, arch), /Duplicate member names/);
});

test('nested: pointers to structs are plain pointers', () => {
  const { Node } = compile(`
    struct Node {
      uint32_t value;
      struct Node *next;
    };
  `, arch);

  assert.equal(Node.size, 16);
  const node = new Node({ value: 1, next: 0xdeadbeefn });
  assert.equal(node.next, 0xdeadbeefn);
});

test('nested: fromConfig rebuilds a struct with nested members', () => {
  const { Outer } = compile(`
    struct Inner { uint16_t v; };
    struct Outer { uint8_t a; struct Inner inner; struct Inner list[2]; };
  `, arch);

  const { config } = Outer.prototype;
  const BE = fromConfig({ ...config, meta: { BE: true } }, arch);
  assert.equal(BE.size, Outer.size);

  const values = { a: 1, inner: { v: 0x0102 }, list: [{ v: 3 }, { v: 4 }] };
  const be = new BE(values);
  assert.equal(be.buffer.toString('hex'), '0100' + '0102' + '0003' + '0004');
  assert.deepEqual(be.toObject(), values);
});

test('union: top level', () => {
  const { Value } = compile(`
    //@BE
    union Value {
      uint32_t word;
      uint16_t halves[2];
      uint8_t bytes[4];
      struct { uint8_t top; uint8_t rest[3]; } parts;
      uint8_t flag:1;
    };
  `, arch);

  assert.equal(Value.size, 4);

  const value = new Value();
  value.word = 0x01020304;
  assert.deepEqual(value.toObject(), {
    word: 0x01020304,
    halves: [0x0102, 0x0304],
    bytes: [1, 2, 3, 4],
    parts: { top: 1, rest: [2, 3, 4] },
    flag: 1,
  });
  assert.deepEqual(Value.decode(value.buffer), value.toObject());

  value.parts.top = 0xff;
  assert.equal(value.word, 0xff020304);

  // encode writes only the members that are provided
  const buf = Buffer.alloc(4);
  Value.encode(buf, 0, { halves: [0xaabb, 0xccdd] });
  assert.equal(buf.toString('hex'), 'aabbccdd');
  Value.encode(buf, 0, { parts: { top: 1, rest: [2, 3, 4] } });
  assert.equal(buf.toString('hex'), '01020304');
  Value.encode(buf, 0, { flag: 0 });
  assert.equal(buf.toString('hex'), '00020304');
  Value.encode(buf, 0, {});
  assert.equal(buf.toString('hex'), '00020304');

  // decode -> encode is a roundtrip, the views agree with each other
  buf.writeUInt32BE(0xcafebabe);
  const copy = Buffer.alloc(4);
  Value.encode(copy, 0, Value.decode(buf));
  assert.deepEqual(copy, buf);
});

test('union: size and alignment', () => {
  const { U, Holder } = compile(`
    union U {
      uint8_t small;
      uint16_t medium[3];
    };

    struct Holder {
      uint8_t tag;
      union U u;
      uint8_t after;
    };
  `, arch);

  // 6 bytes of data, aligned to 2
  assert.equal(U.size, 6);
  assert.equal(U.align, 2);
  // tag, 1 byte of padding, the union, after, 1 byte of padding
  assert.equal(Holder.size, 10);

  const holder = new Holder({ tag: 1, u: { medium: [1, 2, 3] }, after: 9 });
  assert.equal(holder.buffer.toString('hex'), '0100' + '010002000300' + '0900');
  assert.equal(holder.u.small, 1);
});

test('union: anonymous union as a tagged variant', () => {
  const { ICMP } = compile(`
    //@NE
    struct __attribute__((packed)) ICMP {
      uint8_t type;
      uint8_t code;
      uint16_t checksum;
      union {
        struct {
          uint16_t id;
          uint16_t sequence;
        } echo;
        uint32_t gateway;
        struct {
          uint16_t unused;
          uint16_t mtu;
        };
      };
    };
  `, arch);

  assert.equal(ICMP.size, 8);

  const buf = Buffer.from('0800f7ff' + '12340001', 'hex');
  const icmp = new ICMP(buf);
  assert.equal(icmp.type, 8);
  assert.equal(icmp.echo.id, 0x1234);
  assert.equal(icmp.echo.sequence, 1);
  assert.equal(icmp.gateway, 0x12340001);
  assert.equal(icmp.mtu, 1);

  assert.deepEqual(ICMP.decode(buf), {
    type: 8,
    code: 0,
    checksum: 0xf7ff,
    echo: { id: 0x1234, sequence: 1 },
    gateway: 0x12340001,
    unused: 0x1234,
    mtu: 1,
  });

  const out = Buffer.alloc(ICMP.size);
  ICMP.encode(out, 0, { type: 8, code: 0, checksum: 0xf7ff, echo: { id: 0x1234, sequence: 1 } });
  assert.deepEqual(out, buf);

  ICMP.encode(out, 0, { type: 5, code: 0, checksum: 0, gateway: 0x0a000001 });
  assert.equal(out.toString('hex'), '05000000' + '0a000001');

  const built = new ICMP({ type: 3, code: 4, mtu: 1500 });
  assert.equal(built.buffer.toString('hex'), '03040000' + '000005dc');
});

test('union: nested unions and structs keep field names usable as identifiers', () => {
  const { S } = compile(`
    struct S {
      union { uint8_t a; int8_t b; } u[2];
      struct union_like { uint8_t structure; } constant;
    };
  `, arch);

  const s = new S({ u: [{ a: 255 }, { b: -2 }], constant: { structure: 3 } });
  assert.deepEqual(s.toObject(), {
    u: [{ a: 255, b: -1 }, { a: 254, b: -2 }],
    constant: { structure: 3 },
  });
});
