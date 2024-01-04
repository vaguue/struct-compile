# struct-compile

## Overview

This project provides a convenient function to create a JavaScript class from a C structure, for further parsing or creating binary data.

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

const { Example, PDU } = compile(`
  struct Example {
    uint8_t c;
  };

  //@NE Network-endianness for all members of this struct
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

console.log('PDU size: ', obj.length);
console.log('PDU buffer example: ', obj.buffer);
```

The syntax for creating structures takes into account C rules for aligning objects within a structure, and auxiliary comments help to automatically set the endianness of the field. Learn more about alignment [here](https://learn.microsoft.com/en-us/cpp/c-language/padding-and-alignment-of-structure-members) and [here](https://gcc.gnu.org/onlinedocs/gcc-4.1.2/gcc/Type-Attributes.html).

## Compatibility and Project Checklist

This project has been tailored with specific compatibilities and limitations. Below is a checklist highlighting the current state of support for various features:

| Feature             | Supported        | Notes                                         |
|---------------------|------------------|-----------------------------------------------|
| Bitfields           | ❌ No            |                                               |
| Nested Structures   | ❌ No            |                                               |
| Enums               | ❌ No            |                                               |
| Browser Support     | ❌ No            | Currently, there is no support for browsers.  |
| C Structure Parsing | ✅ Yes           |                                               |
| Binary Data Creation| ✅ Yes           |                                               |
| Endianness Setting  | ✅ Yes           | Via auxiliary comments within the structure.  |

Please note that while some features like bitfields, nested structures, and enums are not currently supported, the project is continually evolving. Contributions or suggestions for these areas are welcome.


## Questions or Suggestions

If you have any ideas, or something is not working correctly, feel free to open an issue.
