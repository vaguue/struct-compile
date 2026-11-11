import { trimWithEllipsis, toString } from '#src/strings';
import { multiDimGet, multiDimSet } from '#src/array';
import { forSize } from '#src/number';
import { SingleStructReader, StructReader } from '#src/reader';
import { computeLayout } from './layout.js';
import { generate } from './codegen.js';
import { createArrayDescriptor, arrayGet, arraySet, arrayView } from './arrays.js';

export { alignOffset } from './layout.js';

const HELPERS = [
  '$Buffer', '$short', '$range', '$cv', '$big', '$str', '$head',
  '$array', '$arrayGet', '$arraySet', '$arrayView', '$multiDimSet',
  '$extras', '$extrasToObject', '$extrasMerge', '$extrasToString',
];

const isBytes = BufferImpl => BufferImpl === Uint8Array || BufferImpl.prototype instanceof Uint8Array;

export function create({ name, attributes, members, meta, comment }, arch, BufferImpl) {
  const layout = computeLayout({ attributes, members, meta }, arch);
  const { size, props } = layout;

  /*
   * Members registered after compilation through `config.fields[name] = { d }`
   * (virtual fields defined by subclasses). The generated toObject / merge /
   * toString only pay a length check for this.
   */
  const extras = [];
  const fields = new Proxy(props, {
    set(target, key, value) {
      if (typeof key == 'string' && !(key in target)) {
        extras.push(key);
      }
      target[key] = value;
      return true;
    },
    deleteProperty(target, key) {
      const index = extras.indexOf(key);
      if (index >= 0) {
        extras.splice(index, 1);
      }
      return delete target[key];
    },
  });

  const helpers = {
    $Buffer: BufferImpl,
    $extras: extras,
    $head: `<${name}`,
    $multiDimSet: multiDimSet,
    $arrayGet: arrayGet,
    $arraySet: arraySet,
    $arrayView: arrayView,
    $array: (spec, read, write) => createArrayDescriptor(spec, read, write, BufferImpl),
    $short(expected, got) {
      throw new Error(`Invalid buffer length: expected at least ${expected} bytes, got ${got} bytes`);
    },
    $range(buf, offset) {
      throw new RangeError(`Out of range: ${name} takes ${size} bytes at offset ${offset}, buffer length is ${buf?.length}`);
    },
    $cv: (val, bits, floating, getter) => val instanceof BufferImpl ? val[getter]() : forSize(bits, val, floating),
    $big: val => typeof val == 'bigint' ? val : BigInt(val ?? 0),
    $str: val => trimWithEllipsis(toString(val)),
    $extrasToObject(self, res) {
      for (const key of extras) {
        const { d } = props[key];
        res[key] = d?.length > 0 && d[0] != 0 ? multiDimGet(self[key], d) : self[key];
      }
    },
    $extrasMerge(self, obj) {
      for (const key of extras) {
        const val = obj[key];
        if (val === undefined) continue;
        const { d } = props[key];
        if (d.length > 0 && Array.isArray(val)) {
          multiDimSet(self[key], d, val);
        }
        else {
          self[key] = val;
        }
      }
    },
    $extrasToString(self) {
      let res = '';
      for (const key of extras) {
        if (props[key].d.length == 0) {
          res += ` | ${key}: ${trimWithEllipsis(toString(self[key]))}`;
        }
      }
      return res;
    },
  };

  const source = generate(layout, { inline: isBytes(BufferImpl) });
  const Struct = new Function(...HELPERS, `"use strict";\n${source}`)(...HELPERS.map(key => helpers[key]));

  Object.defineProperty(Struct, 'name', { value: name });
  Object.defineProperty(Struct.prototype, 'config', { value: { name, attributes, members, meta, fields, length: size } });
  Object.defineProperty(Struct.prototype, 'BufferImpl', { value: BufferImpl });
  Object.defineProperty(Struct.prototype, 'length', {
    value: size,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(Struct.prototype, 'buffer', {
    get() {
      return this._buf;
    },
    set(val) {
      if (!(val instanceof BufferImpl)) {
        throw new Error(`Invalid buffer type: expected ${BufferImpl}`);
      }
      if (val.length < this.length) {
        throw new Error(`Invalid buffer length: expected at least ${this.length} bytes, got ${val.length} bytes`);
      }
      this._buf = val;
    }
  });

  Struct.size = size;

  Struct.comments = layout.comments;
  if (comment) {
    Struct.comments.main = comment;
  }

  Struct.createSingleReader = function(options = {}) {
    return new SingleStructReader({ ...options, Struct });
  };

  Struct.createReader = function(options = {}) {
    return new StructReader({ ...options, Struct });
  };

  return Struct;
}

export function createMany(structs, arch, BufferImpl) {
  if (!structs) return {};
  return structs.reduce((res, e) => ({ ...res, [e.name]: create(e, arch, BufferImpl) }), {});
}
