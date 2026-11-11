import { cDataTypes } from '#src/dataTypes';
import { endiannessFromMeta } from './endianness.js';

export function alignOffset(offset, length) {
  if (offset == 0 || length == 0) return offset;
  const extra = (length - 1) - (offset - 1) % (length);
  return offset + extra;
}

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
    ({ signed, length, customKey, floating = false } = cDataTypes[type]);
    if (typeof length == 'function') {
      length = length(arch);
    }
  }

  return vars.map(v => {
    const { name, d = [], bits } = v;
    const res = { name, meta, signed, length, floating, customKey, d, comment, bits, type };
    if (d.some(k => k == 0)) {
      res.length = 0;
    }

    return res;
  });
}

function resolveAlignment(attributes, pointerSize) {
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
      throw new Error(`Invalid aligned value: ${aligned}`);
    }
  }
  return { packed, aligned, skipAlign };
}

const isNested = member => member.struct !== undefined && !member.type.includes('*');

/*
 * Resolves a struct / union definition into a flat layout with constant offsets.
 *
 * `compileNested(def, endianness)` returns the class of a nested struct.
 *
 * Returns:
 *   - fields:  user-visible members in declaration order, each one of
 *       { kind: 'scalar', offset, ... }
 *       { kind: 'array',  offset, d, total, ... }
 *       { kind: 'bits',   unit, bitOffset, bits }
 *       { kind: 'struct', offset, Inner, d, total, ... }  (nested struct / union, or an array of them)
 *       { kind: 'empty' }  (zero-sized: `void x`, `uint8_t tail[]`)
 *     Members of a union are `optional`: they share storage, so only the
 *     ones that are provided get encoded.
 *   - units:   bit field storage units ({ name, offset, bytes, signed, endianness, members })
 *   - props:   raw property descriptors by name (exposed as `config.fields`)
 *   - size:    total size in bytes
 *   - align:   alignment requirement in bytes
 */
export function computeLayout(def, arch, compileNested) {
  const { attributes, members, meta, union = false } = def;
  const structEndianness = endiannessFromMeta(arch.endianness, meta);
  const { packed, skipAlign, aligned: initialAligned } = resolveAlignment(attributes, arch.pointerSize);
  let aligned = initialAligned;

  const fields = [];
  const units = [];
  const props = {};
  const comments = {};

  let offset = 0;
  let end = 0;
  let prev = null;
  let unit = null;
  let bitsOffset = 0;

  const place = (alignment) => {
    if (!packed) {
      offset = alignOffset(offset, alignment);
    }
    if (!skipAlign) {
      aligned = Math.max(aligned, alignment);
    }
    return offset;
  };

  const register = (name, prop, comment) => {
    if (props[name] !== undefined) {
      throw new Error(`Duplicate member names: ${name}`);
    }
    props[name] = prop;
    if (comment) {
      comments[name] = comment;
    }
  };

  // every member of a union starts at offset 0
  const begin = () => {
    if (union) {
      offset = 0;
      prev = null;
    }
  };

  const finish = () => {
    end = Math.max(end, offset);
  };

  const addNested = (member) => {
    const endianness = endiannessFromMeta(structEndianness, member.meta);

    if (member.vars.length == 0) {
      // anonymous struct / union: its members belong to the enclosing one
      const inner = computeLayout(member.struct, { ...arch, endianness }, compileNested);
      begin();
      const base = place(inner.align);
      for (const u of inner.units) {
        u.offset += base;
        u.name = bitFieldStorageName(units.length + 1);
        units.push(u);
      }
      for (const f of inner.fields) {
        register(f.name, inner.props[f.name], inner.comments[f.name]);
        if (f.offset !== undefined) {
          f.offset += base;
        }
        fields.push(f);
      }
      offset += inner.size;
      prev = null;
      finish();
      return;
    }

    const Inner = compileNested(member.struct, endianness);
    for (const { name, d = [] } of member.vars) {
      const empty = d.some(k => k == 0);
      register(name, {
        name,
        meta: member.meta,
        d,
        comment: member.comment,
        type: member.type,
        struct: Inner,
        length: empty ? 0 : Inner.size * 8,
      }, member.comment);

      begin();
      if (empty) {
        fields.push({ kind: 'empty', name });
      }
      else {
        const count = d.reduce((a, b) => a * b, 1);
        const field = {
          kind: 'struct',
          name,
          Inner,
          bytes: Inner.size,
          offset: place(Inner.align),
          d,
          count,
          total: count * Inner.size,
        };
        offset += field.total;
        fields.push(field);
      }
      prev = null;
      finish();
    }
  };

  for (const member of members) {
    if (isNested(member)) {
      addNested(member);
      continue;
    }

    for (const prop of getPropertyData(arch, member)) {
      const { name } = prop;
      register(name, prop, prop.comment);
      begin();

      const endianness = endiannessFromMeta(structEndianness, prop.meta);
      const base = {
        name,
        bytes: prop.length / 8,
        signed: !!prop.signed,
        floating: !!prop.floating,
        endianness,
      };

      if (prop.bits > 0) {
        const fits = prev?.bits > 0 && prev.type == prop.type && (prop.length - bitsOffset) >= prop.bits;
        if (!fits) {
          unit = {
            ...base,
            name: bitFieldStorageName(units.length + 1),
            offset: place(base.bytes),
            members: [],
          };
          offset += unit.bytes;
          bitsOffset = 0;
          units.push(unit);
        }
        const field = { kind: 'bits', name, unit, bitOffset: bitsOffset, bits: prop.bits };
        unit.members.push(field);
        fields.push(field);
        bitsOffset += prop.bits;
      }
      else if (prop.length == 0) {
        fields.push({ kind: 'empty', name });
      }
      else if (prop.d.length > 0) {
        const count = prop.d.reduce((a, b) => a * b, 1);
        const field = { ...base, kind: 'array', offset: place(base.bytes), d: prop.d, count, total: count * base.bytes };
        offset += field.total;
        fields.push(field);
      }
      else {
        const field = { ...base, kind: 'scalar', offset: place(base.bytes) };
        offset += field.bytes;
        fields.push(field);
      }

      prev = prop;
      finish();
    }
  }

  if (union) {
    for (const f of fields) {
      f.optional = true;
    }
  }

  return {
    fields,
    units,
    props,
    comments,
    size: skipAlign ? end : alignOffset(end, aligned),
    align: skipAlign ? 1 : Math.max(aligned, 1),
  };
}
