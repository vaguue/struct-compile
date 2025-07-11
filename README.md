# struct-compile [![codecov](https://codecov.io/github/vaguue/struct-compile/graph/badge.svg?token=RX79CQ4RME)](https://codecov.io/github/vaguue/struct-compile) [![GitHub license](https://img.shields.io/github/license/vaguue/struct-compile?style=flat)](https://github.com/vaguue/struct-compile/blob/main/LICENSE) [![npm](https://img.shields.io/npm/v/struct-compile)](https://www.npmjs.com/package/struct-compile)

## Installation

```bash
npm i struct-compile --save
```

## Overview

*This project is used internally by [over-the-wire](https://github.com/vaguue/over-the-wire). I'm not sure if it has any use outside its main purpose.*

The goal of this project is to provide a convenient function for creating a JavaScript class from a C structure, allowing for easy parsing or construction of binary data.

I chose to implement it myself instead of using an existing alternative because of the lazy reading feature: when the struct is initialized with a `Buffer` instance, it doesn't immediately read all the fields—only those that are accessed.

This approach is especially useful for parsing network packets, where many fields are often unnecessary to read. I also believe it can slightly improve overall performance.

## System Requirements

- Node.js >= 16.18.0

## Getting Started

The main function is `compile` with the signature: 

`compile(string, [arch], [BufferImpl]) => object`

### Example Usage

```javascript
import { compile } from 'struct-compile';

// also available for commonJS
// const { compile } = require('struct-compile');

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

// creating objects
const obj = new PDU();

obj.name = 'seva';
obj.dbl = 1.1;

console.log('PDU size: ', obj.length);
console.log('PDU buffer example: ', obj.buffer);

// parsing raw binary data
const parsed = new PDU(
  Buffer.from([0x73, 0x65, 0x76, 0x61,
               0x00, 0x00, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x00,
               0x00, 0x00, 0x00, 0x00,
               0x3f, 0xf1, 0x99, 0x99,
               0x99, 0x99, 0x99, 0x9a,
               0x00, 0x00, 0x00, 0x00])
);

console.log(parsed.name.toString());
console.log(parsed.dbl);
```

The syntax for creating structures takes into account C rules for aligning objects within a structure, and auxiliary comments help to automatically set the endianness of the field. Learn more about alignment [here](https://learn.microsoft.com/en-us/cpp/c-language/padding-and-alignment-of-structure-members) and [here](https://gcc.gnu.org/onlinedocs/gcc-4.1.2/gcc/Type-Attributes.html).

## Compatibility and Project Checklist

An important note is that the input syntax is the *subset* of the C syntax, current syntax rules can be viewed [here](https://raw.githack.com/vaguue/struct-compile/main/assets/generated_diagrams.html). 

This project has been tailored with specific compatibilities and limitations. Below is a checklist highlighting the current state of support for various features:

| Feature             | Supported        | Notes                                         |
|---------------------|------------------|-----------------------------------------------|
| Nested Structures   | ❌ No            |                                               |
| Enums               | ❌ No            |                                               |
| Browser Support     | ❌ No            | Currently, there is no support for browsers.  |
| Bitfields           | ✅ Yes           |                                               |
| C Structure Parsing | ✅ Yes           |                                               |
| Binary Data Creation| ✅ Yes           |                                               |
| Endianness Setting  | ✅ Yes           | Via auxiliary comments within the structure.  |

Please note that while some features like bitfields, nested structures, and enums are not currently supported, the project is continually evolving. Contributions or suggestions for these areas are welcome.


## Questions or Suggestions

If you have any ideas, or something is not working correctly, feel free to open an issue.
