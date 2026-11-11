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

/*
 * Resolves a struct definition into a flat layout with constant offsets.
 *
 * Returns:
 *   - fields:  user-visible members in declaration order, each one of
 *       { kind: 'scalar', offset, ... }
 *       { kind: 'array',  offset, d, total, ... }
 *       { kind: 'bits',   unit, bitOffset, bits }
 *       { kind: 'empty' }  (zero-sized: `void x`, `uint8_t tail[]`)
 *   - units:   bit field storage units ({ name, offset, bytes, signed, endianness, members })
 *   - props:   raw property descriptors by name (exposed as `config.fields`)
 *   - size:    total struct size in bytes
 */
export function computeLayout({ attributes, members, meta }, arch) {
  const structEndianness = endiannessFromMeta(arch.endianness, meta);
  const { packed, skipAlign, aligned: initialAligned } = resolveAlignment(attributes, arch.pointerSize);
  let aligned = initialAligned;

  const fields = [];
  const units = [];
  const props = {};
  const comments = {};

  let offset = 0;
  let prev = null;
  let unit = null;
  let bitsOffset = 0;

  const place = (prop) => {
    const bytes = prop.length / 8;
    if (!packed) {
      offset = alignOffset(offset, bytes);
    }
    if (!skipAlign) {
      aligned = Math.max(aligned, bytes);
    }
    return offset;
  };

  for (const member of members) {
    for (const prop of getPropertyData(arch, member)) {
      const { name } = prop;
      if (props[name] !== undefined) {
        throw new Error(`Duplicate member names: ${name}`);
      }
      props[name] = prop;
      if (prop.comment) {
        comments[name] = prop.comment;
      }

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
            offset: place(prop),
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
        const field = { ...base, kind: 'array', offset: place(prop), d: prop.d, count, total: count * base.bytes };
        offset += field.total;
        fields.push(field);
      }
      else {
        const field = { ...base, kind: 'scalar', offset: place(prop) };
        offset += field.bytes;
        fields.push(field);
      }

      prev = prop;
    }
  }

  const size = skipAlign ? offset : alignOffset(offset, aligned);

  return { fields, units, props, comments, size };
}
