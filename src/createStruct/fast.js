import { cDataTypes } from '#src/dataTypes';
import { alignOffset } from './index.js';
import { endiannessFromMeta } from './endianness.js';
import { accessorFromParams } from './accessors.js';

/*
 * Fast mode.
 *
 * Instead of returning a class with `Object.defineProperty` getters that
 * read from a per-instance `this._buf`, fast mode emits two inline functions
 * per endianness:
 *
 *   decodeLE(buf, offset)         → { field1: value, field2: value, … }
 *   encodeLE(buf, offset, values)
 *   decodeBE / encodeBE (same shape, big-endian)
 *
 * Generating an object literal with a fixed key set gives V8 a stable hidden
 * class for every decoded record — downstream `record.foo` accesses become
 * monomorphic IC hits. Constant offsets fold into the `readUIntXLE` calls,
 * which the JIT can inline as direct memory loads. There is no `Struct`
 * instance, no prototype chain, no `defineProperty`, no `toObject()`
 * `Object.entries` walk per record.
 *
 * Limitations vs. the class-based `create()`:
 *   - bit fields are not supported (throws at compile time);
 *   - fixed-size arrays are not supported (throws at compile time);
 *   - the result is a plain `{ size, decode, encode, … }` object — no
 *     `buffer`, `merge`, `toString`, no streaming readers.
 *
 * For binary protocols dominated by scalar fields (the typical pcap / ELF /
 * MQTT-style header) this mode is roughly an order of magnitude faster than
 * the class-based path.
 */

function getPropertyData(arch, { type, meta, vars }) {
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

  return vars.map(v => ({
    name:     v.name,
    meta,
    signed,
    length,
    floating,
    customKey,
    d:        v.d,
    bits:     v.bits,
    type,
  }));
}

function resolveAlignment(attributes, pointerSize) {
  let { packed = false, aligned } = attributes ?? {};
  let skipAlign = false;
  if (aligned === true) {
    aligned = pointerSize;
  }
  else if (aligned === undefined) {
    if (packed) skipAlign = true;
    else aligned = -1;
  }
  else {
    aligned = parseInt(aligned);
    if (Number.isNaN(aligned)) {
      throw new Error(`Invalid aligned value: ${aligned}`);
    }
  }
  return { packed, aligned, skipAlign };
}

function buildBody(fields, endiannessOverride, action) {
  const isWrite = action === 'write';
  let src = isWrite ? '' : 'return {';
  for (const f of fields) {
    const e = endiannessOverride ?? f.defaultEndianness;
    const accessor = accessorFromParams({
      endianness: e,
      signed:     f.signed,
      length:     f.length,
      customKey:  f.customKey,
      action,
    });
    const offsetExpr = f.offset === 0 ? 'o' : `o+${f.offset}`;
    if (isWrite) {
      src += `b.${accessor}(v[${JSON.stringify(f.name)}],${offsetExpr});`;
    }
    else {
      src += `${JSON.stringify(f.name)}:b.${accessor}(${offsetExpr}),`;
    }
  }
  if (!isWrite) src += '};';
  return src;
}

export function createFast(structDef, arch) {
  const { name, attributes, members, meta } = structDef;
  const defaultEndianness = endiannessFromMeta(arch.endianness, meta);
  const align = resolveAlignment(attributes, arch.pointerSize);
  const { packed, skipAlign } = align;
  let { aligned } = align;

  const fieldList = [];
  let offset = 0;

  for (const member of members) {
    const memberDefaultEndianness = endiannessFromMeta(defaultEndianness, member.meta);
    const props = getPropertyData(arch, member);

    for (const prop of props) {
      if (prop.bits) {
        throw new Error(`compileFast: bit fields are not supported (${name}.${prop.name})`);
      }
      if (prop.d && prop.d.length > 0) {
        throw new Error(`compileFast: arrays are not supported (${name}.${prop.name})`);
      }
      if (prop.length === 0) continue;

      const sizeBytes = prop.length / 8;
      if (!packed) offset = alignOffset(offset, sizeBytes);
      if (!skipAlign) aligned = Math.max(aligned, sizeBytes);

      fieldList.push({
        name:               prop.name,
        signed:             prop.signed,
        length:             prop.length,
        floating:           prop.floating,
        customKey:          prop.customKey,
        offset,
        defaultEndianness:  memberDefaultEndianness,
      });

      offset += sizeBytes;
    }
  }

  const size = skipAlign ? offset : alignOffset(offset, aligned);

  const decodeLE = new Function('b', 'o', buildBody(fieldList, 'LE', 'read'));
  const decodeBE = new Function('b', 'o', buildBody(fieldList, 'BE', 'read'));
  const encodeLE = new Function('b', 'o', 'v', buildBody(fieldList, 'LE', 'write'));
  const encodeBE = new Function('b', 'o', 'v', buildBody(fieldList, 'BE', 'write'));

  /*
   * `decode` / `encode` honour the per-field default endianness from
   * `meta.LE` / `meta.BE` annotations, so a struct that mixes BE and LE
   * fields still decodes/encodes correctly without picking a global override.
   */
  const decode = new Function('b', 'o', buildBody(fieldList, null, 'read'));
  const encode = new Function('b', 'o', 'v', buildBody(fieldList, null, 'write'));

  return {
    name,
    size,
    decode,
    encode,
    decodeLE,
    decodeBE,
    encodeLE,
    encodeBE,
  };
}

export function createManyFast(structs, arch) {
  if (!structs) return {};
  return structs.reduce((res, s) => ({ ...res, [s.name]: createFast(s, arch) }), {});
}
