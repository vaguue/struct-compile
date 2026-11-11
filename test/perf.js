import { compile } from '../src/index.js';
import { performance } from 'perf_hooks';

/*
 * Compares the generated code against handwritten Buffer parsing.
 * Run with: npm run perf
 */

const { TCP, PDU } = compile(`
  //@NE
  struct TCP {
    uint16_t src;
    uint16_t dst;
    uint32_t seq;
    uint32_t ack;
    //@LE
    uint16_t reserved:4, dataOffset:4, fin:1, syn:1, rst:1, psh:1, ackFlag:1, urg:1, ece:1, cwr:1;
    uint16_t windowSize;
    uint16_t checksum;
    uint16_t urgentPointer;
  } __attribute__((packed));

  //@LE
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

const COUNT = 2_000_000;
const RUNS = 5;

const tcpBuf = Buffer.from('c0de01bb0000a5a50000b6b6501200ff12340000', 'hex');

const pduBuf = Buffer.alloc(PDU.size);
pduBuf.write('kek', 0);
pduBuf.writeDoubleLE(1.1, 32);
pduBuf.writeInt32LE(12345, 40);
pduBuf.writeUInt8(7, 44);
pduBuf.writeBigUInt64LE(0x1234567890abcdefn, 45);
pduBuf.writeFloatLE(1.1, 53);
pduBuf.writeFloatLE(2.2, 57);
pduBuf.writeFloatLE(3.3, 61);
pduBuf.writeUInt16LE(10, 65);
pduBuf.write('payload!', 67);

function manualTCP(b, o) {
  const bits = b.readUInt16LE(o + 12);
  return {
    src: b.readUInt16BE(o),
    dst: b.readUInt16BE(o + 2),
    seq: b.readUInt32BE(o + 4),
    ack: b.readUInt32BE(o + 8),
    reserved: bits & 15,
    dataOffset: bits >>> 4 & 15,
    fin: bits >>> 8 & 1,
    syn: bits >>> 9 & 1,
    rst: bits >>> 10 & 1,
    psh: bits >>> 11 & 1,
    ackFlag: bits >>> 12 & 1,
    urg: bits >>> 13 & 1,
    ece: bits >>> 14 & 1,
    cwr: bits >>> 15 & 1,
    windowSize: b.readUInt16BE(o + 14),
    checksum: b.readUInt16BE(o + 16),
    urgentPointer: b.readUInt16BE(o + 18),
  };
}

const tcpValues = TCP.decode(tcpBuf);
const scratch = Buffer.alloc(TCP.size);
const reused = new TCP(scratch);

const cases = {
  'TCP  manual Buffer.readXxx (all fields)': () => manualTCP(tcpBuf, 0).seq,
  'TCP  Struct.decode (all fields)': () => TCP.decode(tcpBuf, 0).seq,
  'TCP  new Struct(buf).toObject()': () => new TCP(tcpBuf).toObject().seq,
  'TCP  new Struct(buf) + 3 fields': () => {
    const tcp = new TCP(tcpBuf);
    return tcp.src + tcp.dst + tcp.syn;
  },
  'TCP  Struct.encode': () => {
    TCP.encode(scratch, 0, tcpValues);
    return 0;
  },
  'TCP  instance.merge': () => {
    reused.merge(tcpValues);
    return 0;
  },
  'PDU  Struct.decode (arrays)': () => PDU.decode(pduBuf, 0).p,
  'PDU  new Struct(buf) + 1 scalar': () => new PDU(pduBuf).payload_size,
  'PDU  new Struct(buf) + array view': () => new PDU(pduBuf).name[0],
};

let sink = 0;
for (const [name, fn] of Object.entries(cases)) {
  for (let i = 0; i < 100_000; i++) sink += fn();
  let best = Infinity;
  for (let run = 0; run < RUNS; run++) {
    const start = performance.now();
    for (let i = 0; i < COUNT; i++) sink += fn();
    best = Math.min(best, performance.now() - start);
  }
  console.log(`${name.padEnd(42)} ${(best / COUNT * 1e6).toFixed(1).padStart(8)} ns/op`);
}
