# struct-compile [![codecov](https://codecov.io/github/vaguue/struct-compile/graph/badge.svg?token=RX79CQ4RME)](https://codecov.io/github/vaguue/struct-compile) [![GitHub license](https://img.shields.io/github/license/vaguue/struct-compile?style=flat)](https://github.com/vaguue/struct-compile/blob/main/LICENSE) [![npm](https://img.shields.io/npm/v/struct-compile)](https://www.npmjs.com/package/struct-compile)

## Installation

```bash
npm i struct-compile --save
```

## Overview

*This project is used internally by [over-the-wire](https://github.com/vaguue/over-the-wire). I'm not sure if it has any use outside its main purpose.*

The goal of this project is to generate efficient binary parsers and serializers in JavaScript directly from C-style structure declarations.

Two modes are available:

- **Class mode** (`compile`) – returns a `Struct` class per declaration. The class lazily reads fields on access through `Object.defineProperty` getters; great when only a few fields of a large struct are inspected at runtime.
- **Fast mode** (`compileFast`) – returns plain `{ size, decode, encode, decodeLE, decodeBE, encodeLE, encodeBE }` objects per declaration. The decode/encode functions are emitted as inline `new Function`s that produce monomorphic object literals with constant-offset `Buffer` reads. This is roughly an order of magnitude faster than the class-based path on hot loops, at the cost of allocating the full record on every decode and not supporting bit fields or arrays.

## System Requirements

- Node.js >= 16.18.0

## Getting Started — Class Mode

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

## Getting Started — Fast Mode

`compileFast(string, [arch]) => { [StructName]: { size, decode, encode, decodeLE, decodeBE, encodeLE, encodeBE } }`

```javascript
import { compileFast } from 'struct-compile';
// CommonJS: const { compileFast } = require('struct-compile');

const { PacketHeader } = compileFast(`
  //@LE
  struct __attribute__((__packed__)) PacketHeader {
    uint32_t tv_sec;
    uint32_t tv_usec;
    uint32_t caplen;
    uint32_t len;
  };
`);

console.log(PacketHeader.size); // 16

// Decode — returns a plain object with a fixed shape, no class instance
const buf = Buffer.from('64fa125e000000006000000060000000', 'hex');
const record = PacketHeader.decode(buf, 0);
// → { tv_sec: 1578302052, tv_usec: 0, caplen: 96, len: 96 }

// Encode — writes scalars into a caller-provided Buffer
const out = Buffer.allocUnsafe(PacketHeader.size);
PacketHeader.encode(out, 0, { tv_sec: 1, tv_usec: 2, caplen: 60, len: 60 });

// Endianness can be overridden at the call site
PacketHeader.encodeBE(out, 0, { tv_sec: 1, tv_usec: 2, caplen: 60, len: 60 });
const r = PacketHeader.decodeBE(out, 0);
```

`decode` / `encode` honour the per-field endianness pinned via `//@LE` / `//@BE` comments (or the struct-level default); `decodeLE/encodeLE/decodeBE/encodeBE` force a single endianness across all fields, which is convenient when the same wire layout is used in both byte orders (e.g. classic pcap).

### When to pick which

| Scenario                                            | Recommended       |
|-----------------------------------------------------|-------------------|
| Tight parse loops on packed binary protocols        | **Fast mode**     |
| Random read of a few fields out of a large record   | Class mode (lazy) |
| Mutation of fields on a backing buffer in place     | Class mode        |
| Need bit fields or arrays                           | Class mode        |
| You only need `{ size, decode, encode }` from an AST | `fastFromConfig`  |

`fastFromConfig(config, [arch])` accepts a single struct AST (the same shape `compileFast` produces internally) and is useful when you want to skip the C-source parser entirely and build the layout programmatically.

## Compatibility and Project Checklist

The input syntax is a *subset* of C; current grammar can be viewed [here](https://raw.githack.com/vaguue/struct-compile/main/assets/generated_diagrams.html).

| Feature              | Class mode (`compile`) | Fast mode (`compileFast`) | Notes                                        |
|----------------------|:----------------------:|:-------------------------:|----------------------------------------------|
| C structure parsing  | ✅                     | ✅                        |                                              |
| Binary data creation | ✅                     | ✅                        |                                              |
| Endianness setting   | ✅                     | ✅                        | Via `//@LE` / `//@BE` / `//@NE` comments     |
| Bit fields           | ✅                     | ❌                        | Throws at compile time in fast mode          |
| Arrays               | ✅                     | ❌                        | Throws at compile time in fast mode          |
| Nested structures    | ❌                     | ❌                        |                                              |
| Enums                | ❌                     | ❌                        |                                              |
| Browser support      | ❌                     | ❌                        | Node.js `Buffer` API is required             |

Contributions or suggestions for the unsupported features are welcome.

## Questions or Suggestions

If you have any ideas, or something is not working correctly, feel free to open an issue.
