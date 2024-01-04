export class BufferPolyfill {
  constructor(arg) {
    if (typeof arg == 'number') {
      this.buffer = new ArrayBuffer(arg);
      this.uint8 = new Uint8Array(this.buffer);
      this.view = new DataView(this.buffer);
    }
    else if (typeof arg == 'object') {
      this.buffer = arg.buffer;
      this.uint8 = arg.uint8;
      this.view = arg.view;
    }
    else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  write(string, offset = 0, length, encoding = 'utf8') {

  }

  copy(target, targetStart, sourceStart = 0, sourceEnd = undefined) {
    if (sourceEnd === undefined) {
      sourceEnd = this.length;
    }
    target.uint8.set(this.uint8.subarray(sourceStart, sourceEnd), targetStart);
  } 

  get length() {
    return this.uint8.byteLength;
  }

  subarray(start, end) {
    return new BufferPolyfill({
      buffer: this.buffer,
      view: this.view,
      uint8: this.uint8.subarray(start, end),
    });
  }

  toString() {
    return this.buffer;
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return this.buffer;
  }
};

const accessors = [
  ['BigInt64', 'BigInt64'],
  ['BigUInt64', 'BigUint64'],
  ['Float', 'Float32'],
  ['Double', 'Float64'],
  ['Int16', 'Int16'],
  ['Int32', 'Int32'],
  ['Int8', 'Int8'],
  ['UInt16', 'Uint16'],
  ['UInt32', 'Uint32'],
  ['UInt8', 'Uint8'],
];

accessors.forEach(ac => {
  const [nodeName, browserName] = ac;

  const node = {
    readBE: `read${nodeName}BE`,
    writeBE: `write${nodeName}BE`,
    readLE: `read${nodeName}LE`,
    writeLE: `write${nodeName}LE`,
  };

  const browser = {
    read: `get${browserName}`,
    write: `set${browserName}`,
  };

  BufferPolyfill.prototype[node.readBE] = function(offset = 0) {
    return this.view[browser.read](this.uint8.byteOffset + offset, false);
  };

  BufferPolyfill.prototype[node.readLE] = function(offset = 0) {
    return this.view[browser.read](this.uint8.byteOffset + offset, true);
  };

  BufferPolyfill.prototype[node.writeBE] = function(value, offset = 0) {
    return this.view[browser.write](this.uint8.byteOffset + offset, value, false);
  };

  BufferPolyfill.prototype[node.writeLE] = function(value, offset = 0) {
    return this.view[browser.write](this.uint8.byteOffset + offset, value, true);
  };
});

const buf = new BufferPolyfill(123);
buf.writeUInt32BE(123, 10);
console.log(buf.subarray(10, 20).readUInt32BE());
console.log(buf.readUInt32BE(10));

const nodeBuf = Buffer.alloc(123);
nodeBuf.writeUInt32BE(123, 10);
console.log(nodeBuf);
