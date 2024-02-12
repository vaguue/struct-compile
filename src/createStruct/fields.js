import { forSize, createMask } from '#src/number';
import { endiannessFromMeta } from './endianness.js';
import { accessorFromParams } from './accessors.js';
import { proxyFromParams } from './proxy.js';

export function createField(StructProto, offset, prop, defaultEndianness) {
  const {
    signed,
    length: baseLength,
    name,
    meta,
    customKey = null,
    floating,
    d,
  } = prop;

  if (baseLength == 0) return 0;

  const endianness = endiannessFromMeta(defaultEndianness, meta);

  const getter = accessorFromParams({
    endianness, 
    signed, 
    length: baseLength, 
    customKey, 
    action: 'read' 
  });

  const setter = accessorFromParams({
    endianness, 
    signed, 
    length: baseLength, 
    customKey, 
    action: 'write' 
  });

  let length = baseLength;
  d.forEach(k => {
    length *= k;
  });

  if (d.length == 0) {
    Object.defineProperty(StructProto, name, {
      get() {
        return this._buf[getter](offset);
      },
      set(val) {
        this._buf[setter](val instanceof this.BufferImpl ? val[getter]() : forSize(length, val, floating), offset);
      },
    });
  }
  else {
    Object.defineProperty(StructProto, name, {
      get() {
        return proxyFromParams({ 
          getter, 
          setter, 
          buffer: this._buf.subarray(offset, offset + length / 8), 
          d, 
          length, 
          floating, 
          BufferImpl: this.BufferImpl 
        });
      },
      set(val) {
        if (val instanceof this.BufferImpl) {
          val.copy(this._buf, offset, 0, Math.min(val.length, length));
        }
        else {
          this._buf.subarray(offset, length).write(val.toString());
        }
      }
    });
  }

  return length;
}

export function createBitField(StructProto, offset, storageName, prop) {
  const { name, bits, floating, length } = prop;
  const [mask, checkedOffset] = createMask(bits, offset, floating, length);
  Object.defineProperty(StructProto, name, {
    get() {
      return (this[storageName] & (mask << checkedOffset)) >> checkedOffset;
    },
    set(val) {
      this[storageName] = (this[storageName] & (~(mask << checkedOffset))) | ((val & mask) << checkedOffset);
    }
  });
}
