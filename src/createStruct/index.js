import { trimWithEllipsis, toString } from '#src/strings';
import { multiDimGet, multiDimSet } from '#src/array';
import { forSize } from '#src/number';
import { SingleStructReader, StructReader } from '#src/reader';
import { computeLayout } from './layout.js';
import { endiannessFromMeta } from './endianness.js';
import { generate } from './codegen.js';
import { createArrayDescriptor, arrayGet, arraySet, arrayView } from './arrays.js';

export { alignOffset } from './layout.js';

const HELPERS = [
  '$Buffer', '$short', '$range', '$cv', '$big', '$str', '$head',
  '$array', '$arrayGet', '$arraySet', '$arrayView', '$structSet', '$multiDimSet',
  '$extras', '$extrasToObject', '$extrasMerge', '$extrasToString',
];

const isBytes = BufferImpl => BufferImpl === Uint8Array || BufferImpl.prototype instanceof Uint8Array;

/*
 * Replaces references to named structs (`struct Inner x;`) with their
 * definitions, so that a resolved definition is self-contained. `registry`
 * maps the names declared so far to their resolved definitions.
 */
function resolve(def, registry) {
  const members = def.members.map((member) => {
    const nested = member.struct;
    if (nested === undefined) {
      return member;
    }
    if (nested.members === undefined) {
      const found = registry.get(nested.name);
      if (found === undefined) {
        throw new Error(`Unknown type: ${member.type}`);
      }
      if (!!found.union != !!nested.union) {
        throw new Error(`${nested.name} is declared as a ${found.union ? 'union' : 'struct'}, but used as ${member.type}`);
      }
      return { ...member, struct: found };
    }
    return { ...member, struct: resolve(nested, registry) };
  });

  const res = { ...def, members, meta: def.meta ?? {} };
  if (def.name) {
    registry.set(def.name, res);
  }
  return res;
}

/*
 * One compilation: a set of definitions sharing the arch and the buffer
 * implementation. A nested struct is compiled once per byte order it's
 * used with, so `outer.inner instanceof Inner` holds whenever the
 * enclosing struct doesn't change the default endianness.
 */
function createContext(arch, BufferImpl) {
  const registry = new Map();
  const cache = new Map();

  const compileResolved = (def, inherited) => {
    const endianness = endiannessFromMeta(inherited, def.meta);
    let variants = cache.get(def);
    if (variants === undefined) {
      cache.set(def, variants = {});
    }
    return variants[endianness] ??= build(def, { ...arch, endianness }, BufferImpl, compileResolved);
  };

  return {
    compile: def => compileResolved(resolve(def, registry), arch.endianness),
  };
}

export function create(def, arch, BufferImpl) {
  return createContext(arch, BufferImpl).compile(def);
}

function build(def, arch, BufferImpl, compileNested) {
  const { attributes, members, meta, comment } = def;
  const name = def.name ?? (def.union ? 'union' : 'struct');
  const layout = computeLayout(def, arch, compileNested);
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
    $structSet(buf, pos, Inner, val) {
      if (val === undefined || val === null) return;
      if (val instanceof Inner) {
        val = val._buf;
      }
      if (val instanceof BufferImpl) {
        val.copy(buf, pos, 0, Math.min(val.length, Inner.size));
      }
      else {
        new Inner(buf.subarray(pos, pos + Inner.size)).merge(val);
      }
    },
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

  const { source, refs } = generate(layout, { inline: isBytes(BufferImpl) });
  Object.assign(helpers, refs);
  const params = [...HELPERS, ...Object.keys(refs)];
  const Struct = new Function(...params, `"use strict";\n${source}`)(...params.map(key => helpers[key]));

  Object.defineProperty(Struct, 'name', { value: name });
  Object.defineProperty(Struct.prototype, 'config', { value: { ...def, name, fields, length: size } });
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
  Struct.align = layout.align;

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
  const context = createContext(arch, BufferImpl);
  const res = {};
  for (const def of structs) {
    res[def.name] = context.compile(def);
  }
  return res;
}
