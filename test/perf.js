import { compile } from '../src/index.js';
import { performance } from 'perf_hooks';

const { PDU } = compile(`
  struct __attribute__((__packed__)) PDU {
    char name[32];
    double dbl;
    int p;
    uint8_t flags;
    uint64_t session_id;
    float coords[3];
    uint16_t payload_size;
    char payload[64];
  };
`);

const COUNT = 100_000;
const rawBuf = Buffer.alloc(131);
rawBuf.write('kek', 0);
rawBuf.writeDoubleLE(1.1, 32);
rawBuf.writeInt32LE(12345, 40);
rawBuf.writeUInt8(7, 44);
rawBuf.writeBigUInt64LE(BigInt(0x1234567890abcdefn), 45);
rawBuf.writeFloatLE(1.1, 53);
rawBuf.writeFloatLE(2.2, 57);
rawBuf.writeFloatLE(3.3, 61);
rawBuf.writeUInt16LE(10, 65);
rawBuf.write('payload!', 67);

let t0 = performance.now();
let lazyObjs = [];
for (let i = 0; i < COUNT; i++) {
  let obj = new PDU(rawBuf);
  let val = obj.name;
  lazyObjs.push(val);
}
let t1 = performance.now();
console.log(`Lazy access (1 field): ${(t1 - t0).toFixed(2)} ms`);

function parsePDU(buffer) {
  const name = buffer.subarray(0, 32).toString();
  const dbl = buffer.readDoubleLE(32);
  const p = buffer.readInt32LE(40);
  const flags = buffer.readUInt8(44);
  const session_id = buffer.readBigUInt64LE(45);
  const coords = [
    buffer.readFloatLE(53),
    buffer.readFloatLE(57),
    buffer.readFloatLE(61)
  ];
  const payload_size = buffer.readUInt16LE(65);
  const payload = buffer.subarray(67, 131).toString();
  return {
    name,
    dbl,
    p,
    flags,
    session_id,
    coords,
    payload_size,
    payload
  };
}

let t2 = performance.now();
let eagerObjs = [];
for (let i = 0; i < COUNT; i++) {
  const obj = parsePDU(rawBuf);
  eagerObjs.push(obj);
}
let t3 = performance.now();
console.log(`Eager manual parse (all fields): ${(t3 - t2).toFixed(2)} ms`);

let t4 = performance.now();
let structObjs = [];
for (let i = 0; i < COUNT; i++) {
  const obj = new PDU(rawBuf).toObject();
  structObjs.push(obj);
}
let t5 = performance.now();
console.log(`struct-compile toObject (all fields): ${(t5 - t4).toFixed(2)} ms`);
