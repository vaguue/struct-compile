import { cDataTypes } from './dataTypes.js';

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

function accessorFromParams({ endianness, signed, size, customKey, action }) {
  let key = customKey ?? (size == 64 ? 'BigInt' : 'Int');
  if (!signed && key == 'BigInt') {
    key = 'BigUInt';
  }
  return `${action}${size == 64 ? '' : (signed ? '' : 'U')}${key}${customKey ? '' : size}${size > 8 ? endianness : ''}`;
};

function createField(StructProto, offset, { signed, size, baseSize, name, meta, customKey = null }, defaultEndianness) {
  const endianness = endiannessFromMeta(defaultEndianness, meta);
  const getter = accessorFromParams({ endianness, signed, size, customKey, action: 'read' });
  const setter = accessorFromParams({ endianness, signed, size, customKey, action: 'write' });

  Object.defineProperty(StructProto, name, {
    get() {
      console.log(getter);
      return this._buf[getter](offset);
    },
    set(val) {
      console.log(setter);
      this._buf[setter](val, offset);
    },
  });
}

function getPropertyData(arch, { type, meta, vars }) {
  let size, signed, customKey;
  if (type.includes('*')) {
    size = arch.pointerSize * 8;
    signed = false;
  }
  else {
    ({ signed, size, customKey } = cDataTypes[type]);
    if (typeof size == 'function') {
      size = size(arch);
    }
  }

  return vars.map(v => {
    const { name, d } = v;
    const res = { name, meta, signed, size, baseSize: size, customKey };
    d.forEach(k => {
      if (k == 0) {
        res.baseSize = 0;
      }
      res.size *= k;
    });

    return res;
  });
}

function alignOffset(offset, size) {
  if (offset == 0) return offset;
  const extra = (size - 1) - (offset - 1) % (size);
  return offset + extra;
}

export function create({ name, attributes, members, meta, }, BufferImpl, arch) {
  function Struct(arg) {
    if (arg === undefined) {
      this._buf = BufferImpl.alloc(this.size);
    }
    else if (arg instanceof BufferImpl) {
      if (arg.length < this.size) {
        throw new Error(`Invalid buffer size: expected at least ${this.size} bytes, got ${this._buf.length} bytes`);
      }
      this._buf = arg;
    }
    else if (typeof arg == 'object') {
      const { zeroed } = arg;
      if (zeroed) {
        this._buf = BufferImpl.alloc(this.size);
      }
      else {
        this._buf = BufferImpl.allocUnsafe(this.size);
      }
    }
  }

  const { pointerSize } = arch;

  let { packed = false, aligned } = attributes ?? {};
  if (aligned === true) {
    aligned = pointerSize;
  }
  else if (aligned === undefined) {
    aligned = -1;
  }
  else {
    aligned = parseInt(aligned);
    if (Number.isNaN(aligned)) {
      throw new Error(`Invalid aligned valued: ${aligned}`);
    }
  }

  Object.defineProperty(Struct, 'name', { value: name });
  Object.defineProperty(Struct, 'config', { value: { name, attributes, members, meta, fields: [] } });
  Object.defineProperty(Struct.prototype, 'buffer', { 
    get() {
      return this._buf;
    },
    set(val) {
      if (!(val instanceof BufferImpl)) {
        throw new Error(`Invalid buffer type: expected ${BufferImpl}`);
      }
      if (val.length < this.size) {
        throw new Error(`Invalid buffer size: expected at least ${this.size} bytes, got ${this._buf.length} bytes`);
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
  let maxSize = 0;
  const endianness = endiannessFromMeta(arch.endianness, meta);

  members.forEach((member) => {
    const propData = getPropertyData(arch, member);
    for (const prop of propData) {
      if (!packed) {
        offset = alignOffset(offset, prop.baseSize / 8);
      }
      maxSize = Math.max(maxSize, prop.baseSize / 8);
      createField(Struct.prototype, offset, prop, endianness);
      offset += prop.size / 8;
      Struct.config.fields.push(prop.name);
    }
  });

  if (aligned == -1) {
    aligned = maxSize;
  }

  const size = alignOffset(offset, aligned);
  Object.defineProperty(Struct.prototype, 'size', { value: size });
  Struct.size = Struct.config.size = size;

  return Struct;
}

export function createMany(structs, BufferImpl, arch) {
  return structs.reduce((res, e) => ({ ...res, [e.name]: create(e, BufferImpl, arch) }), {});
}
