import { cDataTypes } from '#src/dataTypes';
import { trimWithEllipsis, toString } from '#src/strings';
import { multiDimGet, multiDimSet } from '#src/array';
import { SingleStructReader, StructReader } from '#src/reader';
import { createField, createBitField } from './fields.js';
import { endiannessFromMeta } from './endianness.js';


function bitFieldStorageName(count) {
  return `_bitfield${count}`;
}

function getPropertyData(arch, { type, meta, vars, comment }) {
  let length, signed, customKey, floating = false;
  if (type.includes('*')) {
    length = arch.pointerSize * 8;
    signed = false;
  }
  else {
    ({ signed, length, customKey, floating } = cDataTypes[type]);
    if (typeof length == 'function') {
      length = length(arch);
    }
  }

  return vars.map(v => {
    const { name, d, bits } = v;
    const res = { name, meta, signed, length, floating, customKey, d, comment, bits, type };
    d.forEach(k => {
      if (k == 0) {
        res.length = 0;
      }
    });

    return res;
  });
}

export function alignOffset(offset, length) {
  if (offset == 0 || length == 0) return offset;
  const extra = (length - 1) - (offset - 1) % (length);
  return offset + extra;
}

export function create({ name, attributes, members, meta, comment }, arch, BufferImpl) {
  function Struct(arg, opts = {}) {
    if (arg === undefined) {
      this._buf = BufferImpl.alloc(this.length);
    }
    else if (arg instanceof BufferImpl) {
      if (arg.length < this.length) {
        throw new Error(`Invalid buffer length: expected at least ${this.length} bytes, got ${arg.length} bytes`);
      }
      this._buf = arg;
    }
    else if (typeof arg == 'object') {
      const { _structCompileInternal = {} } = arg;
      const zeroed = _structCompileInternal.zeroed ?? true;
      if (zeroed) {
        this._buf = BufferImpl.alloc(opts.toAlloc ?? this.length);
      }
      else {
        this._buf = BufferImpl.allocUnsafe(opts.toAlloc ?? this.length);
      }

      Object.entries(this.config.fields).forEach(([key, val]) => {
        if (arg[key] !== undefined) {
          const argValue = arg[key];
          if (val.d?.length > 0 && Array.isArray(argValue)) {
            multiDimSet(this[key], val.d, argValue);
          }
          else {
            this[key] = argValue;
          }
        }
      });
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
  Object.defineProperty(Struct.prototype, 'config', { value: { name, attributes, members, meta, fields: {} } });
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
    const res = {};
    for (const [key, val] of Object.entries(this.config.fields)) {
      if (val.d?.length > 0 && val.d?.[0] != 0) {
        res[key] = multiDimGet(this[key], val.d);
      }
      else {
        res[key] = this[key];
      }
    }
    return res;
  };

  Struct.prototype.merge = function(obj) {
    Object.entries(this.config.fields).forEach(([key, val]) => {
      if (obj[key] !== undefined) {
        const argValue = obj[key];
        if (val.d.length > 0 && Array.isArray(argValue)) {
          multiDimSet(this[key], val.d, argValue);
        }
        else {
          this[key] = argValue;
        }
      }
    });
  };

  Struct.prototype.toString = function() {
    let res = `<${name}`;
    Object.entries(this.config.fields).forEach(([key, val]) => {
      if (val.d.length == 0) {
        res = res + ` | ${key}: ${trimWithEllipsis(toString(this[key]))}`;
      }
    });
    res += '>';
    return res;
  };

  Struct.createSingleReader = function(options = {}) {
    return new SingleStructReader({ ...options, Struct });
  };

  Struct.createReader = function(options = {}) {
    return new StructReader({ ...options, Struct });
  };

  let offset = 0;
  const endianness = endiannessFromMeta(arch.endianness, meta);

  Struct.comments = {};

  if (comment) {
    Struct.comments.main = comment;
  }

  const props = [];
  let prev = null;
  let bfCount = 0;
  let bitsOffset = 0;

  members.forEach((member) => {
    const propData = getPropertyData(arch, member);
    for (const prop of propData) {
      const { name, comment } = prop;
      if (comment) {
        Struct.comments[name] = comment;
      }

      if (prop.bits > 0) {
        if (!(
          prev?.bits > 0 &&
          prev?.type == prop.type &&
          (prop.length - bitsOffset) >= prop.bits
        )) {
          bfCount++;
          bitsOffset = 0;
          props.push({
            ...prop,
            name: bitFieldStorageName(bfCount),
          });
        }

        createBitField(Struct.prototype, bitsOffset, bitFieldStorageName(bfCount), prop);
        bitsOffset += prop.bits;
      }
      else {
        props.push(prop);
      }

      if (Struct.prototype.config.fields[prop.name] !== undefined) {
        throw new Error(`Duplicate member names: ${prop.name}`);
      }
      Struct.prototype.config.fields[prop.name] = prop;
      prev = prop;
    }
  });

  for (const prop of props) {
    if (!packed) {
      offset = alignOffset(offset, prop.length / 8);
    }
    if (!skipAlign) {
      aligned = Math.max(aligned, prop.length / 8);
    }

    offset += createField(Struct.prototype, offset, prop, endianness) / 8;
  }

  const length = skipAlign ? offset : alignOffset(offset, aligned);

  Object.defineProperty(Struct.prototype, 'length', {
    value: length,
    writable: true,
    configurable: true,
  });

  Struct.prototype.config.length = length;

  return Struct;
}

export function createMany(structs, BufferImpl, arch) {
  if (!structs) return {};
  return structs.reduce((res, e) => ({ ...res, [e.name]: create(e, BufferImpl, arch) }), {});
}
