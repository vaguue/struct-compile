# struct-compile [![codecov](https://codecov.io/github/vaguue/struct-compile/graph/badge.svg?token=RX79CQ4RME)](https://codecov.io/github/vaguue/struct-compile) [![GitHub license](https://img.shields.io/github/license/vaguue/struct-compile?style=flat)](https://github.com/vaguue/struct-compile/blob/main/LICENSE) [![npm](https://img.shields.io/npm/v/struct-compile)](https://www.npmjs.com/package/struct-compile)

## Installation

```bash
npm i struct-compile --save
```

## Overview

*This project is used internally by [over-the-wire](https://github.com/vaguue/over-the-wire). I'm not sure if it has any use outside its main purpose.*

The goal of this project is to generate efficient binary parsers and serializers in JavaScript directly from C-style structure declarations.

`compile` turns every `struct` declaration into a JavaScript class. All of the code that touches the buffer is generated for that particular struct (constant offsets, integer reads inlined as byte arithmetic, members accessed by name), so the class can be used in two ways, whichever fits the call site:

- **Lazily**, as a view over a buffer: `new Struct(buffer)` reads nothing, each member is decoded when it's accessed and written in place when it's assigned. Good when a few fields of a header are inspected or patched.
- **Eagerly**, through the static codecs: `Struct.decode(buffer, offset)` returns a plain object with every member decoded (no instance, no `subarray`), `Struct.encode(buffer, offset, values)` writes one. Good for tight parsing loops.

Both work for every struct, including the ones with bit fields, arrays, nested structs and unions, and both agree with each other: `Struct.decode(buf, 0)` equals `new Struct(buf).toObject()`.

## System Requirements

- Node.js >= 16.18.0

## Getting Started

`compile(string, [arch], [BufferImpl]) => { [StructName]: StructClass }`

```javascript
import { compile } from 'struct-compile';
// CommonJS: const { compile } = require('struct-compile');

const { Data, PDU } = compile(`
  // simple example
  struct Data {
    uint8_t c;
    int v;
    unsigned long da;
  };

  //@NE Network endianness for all members of this struct
  struct __attribute__((__packed__)) PDU {
    // Some useful comment
    char name /*in-between comment*/ [16];
    double dbl;
    int p;
  };
`);

// Construct an empty record
const obj = new PDU();
obj.name = 'seva';
obj.dbl  = 1.1;

console.log('PDU size:   ', obj.length);
console.log('PDU buffer: ', obj.buffer);

// Parse raw binary
const parsed = new PDU(Buffer.from([
  0x73, 0x65, 0x76, 0x61, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x3f, 0xf1, 0x99, 0x99, 0x99, 0x99, 0x99, 0x9a,
  0x00, 0x00, 0x00, 0x00,
]));

console.log(parsed.name.toString());
console.log(parsed.dbl);
```

The struct syntax follows C alignment rules; auxiliary comments control endianness. See the references on [Microsoft's padding and alignment guide](https://learn.microsoft.com/en-us/cpp/c-language/padding-and-alignment-of-structure-members) and [GCC type attributes](https://gcc.gnu.org/onlinedocs/gcc-4.1.2/gcc/Type-Attributes.html).

`fromConfig(config, [arch], [BufferImpl])` builds a single class from a struct AST (the shape found in `Struct.prototype.config`), skipping the C parser.

### Instances

| Member                        | Description                                                                                   |
|-------------------------------|-----------------------------------------------------------------------------------------------|
| `new Struct()`                | Allocates a zeroed buffer of `Struct.size` bytes.                                              |
| `new Struct(buffer)`          | Wraps `buffer` without copying; throws if it's shorter than the struct.                        |
| `new Struct(object)`          | Allocates a buffer and `merge`s the object into it.                                            |
| `instance.<member>`           | Reads / writes the member in place. Arrays return an indexable view (`pdu.name[3]`, `m[1][2]`) and accept a `Buffer`, a string or an array on assignment. |
| `instance.buffer`             | The underlying buffer.                                                                         |
| `instance.length`             | Size in bytes.                                                                                 |
| `instance.toObject()`         | Every member as a plain object, arrays as (nested) JS arrays.                                  |
| `instance.merge(object)`      | Assigns the members present in `object`.                                                       |

### Static codecs

```javascript
const { PacketHeader } = compile(`
  //@LE
  struct __attribute__((__packed__)) PacketHeader {
    uint32_t tv_sec;
    uint32_t tv_usec;
    uint32_t caplen;
    uint32_t len;
  };
`);

console.log(PacketHeader.size); // 16

// Decode at an offset: a plain object with a fixed shape, no class instance
const buf = Buffer.from('64fa125e000000006000000060000000', 'hex');
const record = PacketHeader.decode(buf, 0);
// → { tv_sec: 1578302052, tv_usec: 0, caplen: 96, len: 96 }

// Encode into a caller-provided Buffer
const out = Buffer.allocUnsafe(PacketHeader.size);
PacketHeader.encode(out, 0, { tv_sec: 1, tv_usec: 2, caplen: 60, len: 60 });

// Endianness can be overridden at the call site
PacketHeader.encodeBE(out, 0, { tv_sec: 1, tv_usec: 2, caplen: 60, len: 60 });
const r = PacketHeader.decodeBE(out, 0);
```

| Member                                   | Description                                                                 |
|------------------------------------------|-----------------------------------------------------------------------------|
| `Struct.size` / `Struct.align`           | Size and alignment in bytes.                                                |
| `Struct.decode(buffer, [offset])`        | Decodes all members; throws a `RangeError` if the struct doesn't fit.       |
| `Struct.encode(buffer, offset, values)`  | Writes all members (padding bytes are left untouched).                      |
| `decodeLE` / `decodeBE` / `encodeLE` / `encodeBE` | Same, forcing one byte order for every member.                     |
| `Struct.createReader()` / `Struct.createSingleReader()` | Stream helpers that cut a byte stream into records.          |

`decode` / `encode` honour the endianness pinned via `//@LE` / `//@BE` / `//@NE` comments (or the struct-level default); the `LE` / `BE` variants ignore the annotations, which is convenient when the same wire layout exists in both byte orders (e.g. classic pcap).

### Which one to use

| Scenario                                               | Use                              |
|--------------------------------------------------------|----------------------------------|
| Tight parse loop, most members needed                  | `Struct.decode(buf, offset)`     |
| A few members out of a large record                    | `new Struct(buf)` + accessors    |
| Patching members of an existing buffer in place        | `new Struct(buf)` + accessors    |
| Serialising a full record                              | `Struct.encode(buf, offset, v)`  |

`npm run perf` prints the numbers for your machine.

### Nested structures and unions

A member can be another struct or union: one declared earlier in the same `compile` call, or one defined inline. Arrays of them work as well.

```javascript
const { Line } = compile(`
  struct Point {
    uint16_t x;
    uint16_t y;
  };

  struct Line {
    // reference by name
    struct Point from;
    // array of structs
    struct Point path[4];
    // inline definition
    struct { uint8_t r, g, b; } color;
  };
`);

const line = Line.decode(buf, 0);
// → { from: { x, y }, path: [{ x, y }, ...], color: { r, g, b } }

const view = new Line(buf);
view.from.x = 10;          // `view.from` is a Point over the same bytes
view.path[2] = { y: 7 };   // objects are merged, buffers and instances are copied
```

- The eager paths (`decode`, `encode`, `toObject`) reach nested members at constant offsets. The lazy accessor creates a view of the nested struct on each access, so prefer `decode` (or keep the view in a variable) in hot loops.
- A nested struct inherits the default byte order of the enclosing one unless it has its own `//@LE` / `//@BE` / `//@NE`. A comment on the member (`//@BE struct Point p;`) sets it for that member.
- Nested structs keep their own packing and alignment, as in C.
- A struct or union without a member name is anonymous: its members become members of the enclosing struct.

Members of a `union` share the same bytes. Decoding returns every member; encoding writes only the members that are present in the values, in declaration order.

```javascript
const { ICMP } = compile(`
  //@NE
  struct __attribute__((packed)) ICMP {
    uint8_t type;
    uint8_t code;
    uint16_t checksum;
    union {
      struct { uint16_t id; uint16_t sequence; } echo;
      uint32_t gateway;
    };
  };
`);

ICMP.decode(buf, 0);
// → { type, code, checksum, echo: { id, sequence }, gateway }

ICMP.encode(out, 0, { type: 8, code: 0, checksum: 0, echo: { id: 1, sequence: 2 } });
```

As in C, a union is as large as its largest member, so the buffer has to hold that many bytes whichever member is actually in use.

### Custom buffer implementations

`BufferImpl` defaults to `Buffer`. Any `Uint8Array` subclass providing the Node.js `Buffer` read/write methods gets the inlined reads; other implementations are driven through their `readXxx` / `writeXxx` methods only.

## Compatibility and Project Checklist

The input syntax is a *subset* of C; current grammar can be viewed [here](https://raw.githack.com/vaguue/struct-compile/main/assets/generated_diagrams.html).

| Feature              | Supported | Notes                                        |
|----------------------|:---------:|----------------------------------------------|
| C structure parsing  | ✅        |                                              |
| Binary data creation | ✅        |                                              |
| Endianness setting   | ✅        | Via `//@LE` / `//@BE` / `//@NE` comments     |
| Bit fields           | ✅        |                                              |
| Arrays               | ✅        |                                              |
| Nested structures    | ✅        | By name or inline, arrays of structs         |
| Unions               | ✅        | Named and anonymous                          |
| Enums                | ❌        |                                              |
| Browser support      | ❌        | Node.js `Buffer` API is required             |

Contributions or suggestions for the unsupported features are welcome.

## Questions or Suggestions

If you have any ideas, or something is not working correctly, feel free to open an issue.
