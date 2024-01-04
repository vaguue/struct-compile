import { cDataTypes } from './dataTypes.js';
import { maybeNumber, forSize } from './number.js';

function endiannessFromMeta(defaultEndianness, meta) {
  let isBE = false;
  let isLE = false;
  if (meta.BE || meta.NE) {
    isBE = true;
  }
  else if (meta.LE) {
    isLE = true;
  }
  if (isBE && isLE) {
    throw new Error('Cannot have both BE and LE');
  }

  if (isBE) {
    return 'BE';
  }
  if (isLE) {
    return 'LE';
  }

  return defaultEndianness;
};

function accessorFromParams({ endianness, signed, length, customKey, action }) {
  let key = customKey ?? (length == 64 ? 'BigInt' : 'Int');
  if (!signed && key == 'BigInt') {
    key = 'BigUInt';
  }
  return `${action}${length == 64 ? '' : (signed ? '' : 'U')}${key}${customKey ? '' : length}${length > 8 ? endianness : ''}`;
};

function proxyFromParams({ getter, setter, buffer, d: _d, length, BufferImpl }) {
  const k = _d[0];
  const d = _d.slice(1);
  const chunkSize = length / k / 8;
  return new Proxy(buffer, {
    get(target, _prop, receiver) {
      const prop = maybeNumber(_prop);
      if (typeof prop == 'number') {
        if (prop < 0 || prop >= k) {
          throw new Error(`Out of bounds value, expected index to be 0 <= index < ${k}`);
        }
        if (d.length == 0) {
          return target[getter](prop * chunkSize);
        }
        else {
          return proxyFromParams({ getter, setter, buffer: buffer.subarray(prop * chunkSize, (prop + 1) * chunkSize), d, length: chunkSize * 8, BufferImpl });
        }
      }
      else if (typeof target[prop] == 'function') {
        return target[prop].bind(target);
      }

      //Reflect throws strange errors
      //return Reflect.get(...arguments);

      return target[prop];
    },
    set(target, _prop, val) {
      const prop = maybeNumber(_prop);
      if (typeof prop == 'number') {
        if (prop < 0 || prop >= k) {
          throw new Error(`Out of bounds value, expected index to be 0 <= index < ${k}`);
        }
        if (d.length == 0) {
          target[setter](forSize(chunkSize * 8, val), prop * chunkSize);
        }
        else {
          if (val instanceof BufferImpl) {
            val.copy(target.subarray(prop * chunkSize, (prop + 1) * chunkSize), 0, 0, Math.min(val.length, chunkSize));
          }
          else {
            target.subarray(prop * chunkSize, (propd + 1) * chunkSize).write(val.toString());
          }
        }
        return true;
      }

      //Reflect throws strange errors
      //return Reflect.set(...arguments);

      target[prop] = val;

      return true;
    },
  });
}

function createField(StructProto, offset, { signed, length: baseSize, name, meta, customKey = null, d }, defaultEndianness) {
  if (baseSize == 0) return 0;

  const endianness = endiannessFromMeta(defaultEndianness, meta);

  const getter = accessorFromParams({ endianness, signed, length: baseSize, customKey, action: 'read' });
  const setter = accessorFromParams({ endianness, signed, length: baseSize, customKey, action: 'write' });

  let length = baseSize;
  d.forEach(k => {
    length *= k;
  });

  if (d.length == 0) {
    Object.defineProperty(StructProto, name, {
      get() {
        return this._buf[getter](offset);
      },
      set(val) {
        this._buf[setter](forSize(length, val), offset);
      },
    });
  }
  else {
    Object.defineProperty(StructProto, name, {
      get() {
        return proxyFromParams({ getter, setter, buffer: this._buf.subarray(offset, offset + length), d, length, BufferImpl: this.BufferImpl });
      },
      set(val) {
        if (val instanceof this.BufferImpl) {
          val.copy(this._buf.subarray(offset, length), offset, 0, Math.min(val.length, length));
        }
        else {
          this._buf.subarray(offset, length).write(val.toString());
        }
      }
    });
  }

  return length;
}

function getPropertyData(arch, { type, meta, vars, comment }) {
  let length, signed, customKey;
  if (type.includes('*')) {
    length = arch.pointerSize * 8;
    signed = false;
  }
  else {
    ({ signed, length, customKey } = cDataTypes[type]);
    if (typeof length == 'function') {
      length = length(arch);
    }
  }

  return vars.map(v => {
    const { name, d } = v;
    const res = { name, meta, signed, length, customKey, d, comment };
    d.forEach(k => {
      if (k == 0) {
        res.length = 0;
      }
    });

    return res;
  });
}

function alignOffset(offset, length) {
  if (offset == 0) return offset;
  const extra = (length - 1) - (offset - 1) % (length);
  return offset + extra;
}

export function create({ name, attributes, members, meta, comment }, arch, BufferImpl) {
  function Struct(arg) {
    if (arg === undefined) {
      this._buf = BufferImpl.alloc(this.length);
    }
    else if (arg instanceof BufferImpl) {
      if (arg.length < this.length) {
        throw new Error(`Invalid buffer length: expected at least ${this.length} bytes, got ${this._buf.length} bytes`);
      }
      this._buf = arg;
    }
    else if (typeof arg == 'object') {
      const { zeroed } = arg;
      if (zeroed) {
        this._buf = BufferImpl.alloc(this.length);
      }
      else {
        this._buf = BufferImpl.allocUnsafe(this.length);
      }
    }
  }

  const { pointerSize } = arch;

  let { packed = false, aligned } = attributes ?? {};
  let skipAlign = false;
  if (aligned === true) {
    aligned = pointerSize;
  }
  else if (aligned === undefined) {
    if (packed) {
      skipAlign = true;
    }
    else {
      aligned = -1;
    }
  }
  else {
    aligned = parseInt(aligned);
    if (Number.isNaN(aligned)) {
      throw new Error(`Invalid aligned valued: ${aligned}`);
    }
  }

  Object.defineProperty(Struct, 'name', { value: name });
  Object.defineProperty(Struct, 'config', { value: { name, attributes, members, meta, fields: [] } });
  Object.defineProperty(Struct.prototype, 'BufferImpl', { value: BufferImpl });
  Object.defineProperty(Struct.prototype, 'buffer', { 
    get() {
      return this._buf;
    },
    set(val) {
      if (!(val instanceof BufferImpl)) {
        throw new Error(`Invalid buffer type: expected ${BufferImpl}`);
      }
      if (val.length < this.length) {
        throw new Error(`Invalid buffer length: expected at least ${this.length} bytes, got ${this._buf.length} bytes`);
      }
      this._buf = val;
    }
  });

  Struct.prototype.toObject = function() {
    return Struct.config.fields.reduce((res, e) => ({ ...res, [e]: this[e] }), {});
  };

  Struct.prototype.toString = function() {
    let res = `<${name}`;
    Struct.config.fields.forEach(f => {
      res = res + ` | ${f}: ${this[f]}`;
    })
    res += '>';
    return res;
  };

  let offset = 0;
  const endianness = endiannessFromMeta(arch.endianness, meta);

  Struct.comments = {};

  if (comment) {
    Struct.comments.main = comment;
  }

  members.forEach((member) => {
    const propData = getPropertyData(arch, member);
    for (const prop of propData) {
      const { name, comment } = prop;
      if (comment) {
        Struct.comments[name] = comment;
      }

      if (!packed) {
        offset = alignOffset(offset, prop.length / 8);
      }
      if (!skipAlign) {
        aligned = Math.max(aligned, prop.length / 8);
      }
      offset += createField(Struct.prototype, offset, prop, endianness) / 8;
      Struct.config.fields.push(prop.name);
    }
  });

  const length = skipAlign ? offset : alignOffset(offset, aligned);
  Object.defineProperty(Struct.prototype, 'length', { value: length });
  Struct.config.length = length;

  return Struct;
}

export function createMany(structs, BufferImpl, arch) {
  if (!structs) return {};
  return structs.reduce((res, e) => ({ ...res, [e.name]: create(e, BufferImpl, arch) }), {});
}
