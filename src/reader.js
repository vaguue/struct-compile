import { Writable, Transform } from 'node:stream';

export class SingleStructReader extends Writable {
  constructor(options) {
    const { Struct, useSlice = false, toObject = false, selfEnd = true, ...other } = options;
    super(other);

    this.Struct = Struct;
    this.useSlice = useSlice;
    this.toObject = toObject;
    this.selfEnd = selfEnd;
    this.size = Struct.config.length;
    this.reset();
  }

  _write(chunk, encoding, callback) {
    this.bufs.push(chunk);
    this.currentSize += chunk.length;
    
    if (this.currentSize >= this.size) {
      this.buf = Buffer.concat(this.bufs);
      this.result = new this.Struct(this.useSlice ? this.buf.slice(0, this.size) : this.buf.subarray(0, this.size));
      if (this.toObject) {
        this.result = this.result.toObject();
      }
      this.finished = true;

      if (this.currentSize > this.size) {
        this.remaining = this.useSlice ? this.buf.slice(this.size) : this.buf.subarray(this.size);
      } 

      if (this.selfEnd) {
        this.end();
      }
    }

    callback();
  }

  reset() {
    this.currentSize = 0;
    this.bufs = [];
    this.finished = false;
  }
}

export class StructReader extends Transform {
  constructor(options) {
    const { Struct, useSlice = false, toObject = true, ...other } = options;
    super({ ...other, objectMode: true });

    this.Struct = Struct;
    this.useSlice = useSlice;
    this.reader = new SingleStructReader({
      Struct, 
      useSlice, 
      toObject,
      selfEnd: false,
    });
  }

  _transform(chunk, encoding, callback) {
    this.reader.write(chunk);

    while (this.reader.finished) {
      const { result, remaining } = this.reader;
      this.push(result);
      this.reader.reset();
      this.reader.write(remaining);
    }

    callback();
  }
}
