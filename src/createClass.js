import { cDataTypes } from './dataTypes.js';

function endiannessFromMeta(defaultEndianness, meta) {
  if (meta.BE && meta.LE) {
    throw new Error('Cannot have both BE and LE');
  }
  if (meta.BE) {
    return 'BE';
  }
  else if (meta.LE) {
    return 'LE';
  }

  return defaultEndianness;
};

function accessorFromParams({ endianness, signed, size, action }) {
  return `${action}${signed ? '' : 'U'}${size == 64 ? 'BigInt' : 'Int'}${size}${endianness}`;
};

function createField(StructProto, offset, { signed, size, name }, defaultEndianness) {
  const endianness = endiannessFromMeta(defaultEndianness, meta);
  const getter = accessorFromParams({ endianness, signed, size, 'read' });
  const setter = accessorFromParams({ endianness, signed, size, 'write' });

  Object.defineProperty(Res.prototype, name, {
    get() {
      this._buf[getter](offset);
    },
    set(val) {
      this._buf[setter](val, offset);
    },
  });
}

function getPropertyData(arch, { value, meta }) {
  const n = value.length;
  const type = [];
  let arN = 1;
  let i = n -1;
  let isEmpty = false;
  for (; i >= 0; --i) {
    if (value[i].includes('[')) {
      if (value[i] == '[]') {
        isEmpty = true;
      }
      else {
        const num = paresInt(value.slice(1, -1));
        if (Number.isNaN(num)) {
          throw new Error(`Invalid [] operator: ${value[i]}`);
        }
        arN *= num;
      }
    }
    else {
      break;
    }
  }

  if (i <= 0) {
    throw new Error(`Invalid member declaration: ${value.join(' ')}`);
  }
  const name = values[i];
}

function alignOffset(offset, size) {
  return offset + (offset % size);
}

function createStruct({ name, attributes, members, meta, BufferImpl, arch }) {
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

  const pointerSize = cDataTypes['uintptr_t'].size(arch);

  let { packed, aligned } = attributes;
  if (aligned === undefined || aligned === true) {
    aligned = pointerSize;
  }

  Object.defineProperty(Struct, 'name', { value: name });

  let offset = 0;
  const endianness = endiannessFromMeta(os.endianness(), meta);

  members.forEach((member) => {
    const propData = getPropertyData(arch, member);
    if (!packed) {
      offset = alignOffset(offset, propData.size);
    }
    offset += createField(Struct.prototype, offset, getPropertyData(member), endianness);
  });

  const size = alignOffset(offset, pointerSize);
  Object.defineProperty(Struct.prototype, 'size', { value: size });

  return Struct;
}
