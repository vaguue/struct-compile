import { compile } from '#src/index';

// also available for commonJS
// const { compile } = require('struct-compile');

const { Data, PDU } = compile(`
  struct Data {
    uint8_t c;
    //@BE this value will be big-endian because of this comment
    int v;
    unsigned long da;
  } __attribute__((__packed__, aligned(4)));

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

console.log('PDU size: ', obj.length);
console.log('PDU buffer example: ', obj.buffer);

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
