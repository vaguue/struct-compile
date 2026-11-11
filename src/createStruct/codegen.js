/*
 * Source generation for compiled structs.
 *
 * Everything hot is emitted as specialised source and instantiated once per
 * struct through `new Function`:
 *   - field offsets are literals, so reads are constant-offset loads;
 *   - integer reads are inlined as byte arithmetic on the buffer (no
 *     `Buffer.readXxx` call and no per-field bounds check);
 *   - members are accessed by name (`this.foo`, `{ foo: ... }`), which keeps
 *     inline caches monomorphic and gives decoded objects a stable shape;
 *   - every struct owns its functions, so type feedback collected for one
 *     struct never pollutes another one.
 */

const IDENT_RE = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

const isIdent = name => IDENT_RE.test(name) && name != '__proto__';

// `name` as a key of an object literal
const literalKey = name => isIdent(name) ? name : `[${JSON.stringify(name)}]`;

// `obj.name`
const member = (obj, name) => isIdent(name) ? `${obj}.${name}` : `${obj}[${JSON.stringify(name)}]`;

// Byte position `offset + n`, relative to the expression `base` when it's given.
const position = (base, offset) => (n = 0) => {
  const total = offset + n;
  if (base === null) return String(total);
  return total == 0 ? base : `${base}+${total}`;
};

function methodName(action, { bytes, signed, floating }, endianness) {
  if (floating) {
    return `${action}${bytes == 4 ? 'Float' : 'Double'}${endianness}`;
  }
  if (bytes == 8) {
    return `${action}Big${signed ? '' : 'U'}Int64${endianness}`;
  }
  return `${action}${signed ? '' : 'U'}Int${bytes * 8}${bytes > 1 ? endianness : ''}`;
}

function readExpr(f, b, pos, endianness, inline) {
  if (!inline || f.floating || f.bytes == 8) {
    return `${b}.${methodName('read', f, endianness)}(${pos(0)})`;
  }

  // byte(i) is the i-th least significant byte
  const byte = i => `${b}[${pos(endianness == 'BE' ? f.bytes - 1 - i : i)}]`;

  if (f.bytes == 1) {
    return f.signed ? `(${byte(0)}<<24>>24)` : byte(0);
  }
  if (f.bytes == 2) {
    const expr = `(${byte(1)}<<8|${byte(0)})`;
    return f.signed ? `(${expr}<<16>>16)` : expr;
  }
  const expr = `${byte(3)}<<24|${byte(2)}<<16|${byte(1)}<<8|${byte(0)}`;
  return f.signed ? `(${expr})` : `((${expr})>>>0)`;
}

// Coerces `v` (a side-effect free expression) to what the Buffer writer expects.
function convExpr(f, v, endianness) {
  const fallback = `$cv(${v},${f.bytes * 8},${f.floating},"${methodName('read', f, endianness)}")`;
  const fastType = !f.floating && f.bytes == 8 ? 'bigint' : 'number';
  return `(typeof ${v}==="${fastType}"?${v}:${fallback})`;
}

/*
 * Integers that fit the member are stored byte by byte; anything else (out of
 * range, fractional, NaN) is handed to the Buffer method, which keeps its
 * validation and error reporting.
 */
function writeStmt(f, b, pos, endianness, value, inline) {
  const method = `${b}.${methodName('write', f, endianness)}`;
  if (!inline || f.floating || f.bytes == 8) {
    return `${method}(${value},${pos(0)});`;
  }

  const fits = {
    1: f.signed ? '(w<<24>>24)' : '(w&255)',
    2: f.signed ? '(w<<16>>16)' : '(w&65535)',
    4: f.signed ? '(w|0)' : '(w>>>0)',
  }[f.bytes];

  const stores = [];
  for (let i = 0; i < f.bytes; ++i) {
    // i-th least significant byte
    const at = pos(endianness == 'BE' ? f.bytes - 1 - i : i);
    stores.push(`${b}[${at}]=${i == 0 ? 'w' : `w>>>${i * 8}`};`);
  }

  return `{const w=${value};if(${fits}===w){${stores.join('')}}else ${method}(w,${pos(0)});}`;
}

const unitSpec = unit => ({ bytes: unit.bytes, signed: false, floating: false });

const bitMask = bits => bits >= 32 ? -1 : 2 ** bits - 1;

// Extracts a bit field out of `u`, the (unsigned) value of its storage unit.
function bitsGetExpr(f, u) {
  const { bits, bitOffset: off } = f;
  if (f.unit.bytes == 8) {
    return `(${u}>>${off}n&${(1n << BigInt(bits)) - 1n}n)`;
  }
  if (bits >= 32) {
    return u;
  }
  return off > 0 ? `(${u}>>>${off}&${bitMask(bits)})` : `(${u}&${bitMask(bits)})`;
}

// Value of the storage unit `u` with the bit field replaced by `v`.
function bitsSetExpr(f, u, v) {
  const { bits, bitOffset: off } = f;
  if (f.unit.bytes == 8) {
    const mask = (1n << BigInt(bits)) - 1n;
    return `(${u}&${~(mask << BigInt(off))}n|($big(${v})&${mask}n)<<${off}n)`;
  }
  const mask = bitMask(bits);
  return `((${u}&${~(mask << off)}|(${v}&${mask})<<${off})>>>0)`;
}

// Value of a storage unit assembled from all of its bit fields.
function bitsPackExpr(unit, valueOf) {
  if (unit.bytes == 8) {
    return unit.members
      .map(f => `($big(${valueOf(f)})&${(1n << BigInt(f.bits)) - 1n}n)<<${f.bitOffset}n`)
      .join('|');
  }
  const packed = unit.members
    .map(f => `(${valueOf(f)}&${bitMask(f.bits)})<<${f.bitOffset}`)
    .join('|');
  return `(${packed})>>>0`;
}

// Arrays up to this many elements are read with an unrolled literal.
const UNROLL_LIMIT = 32;

function arrayLiteral(f, b, base, endianness, inline, level = 0, offset = f.offset) {
  const n = f.d[level];
  const items = [];
  if (level == f.d.length - 1) {
    for (let i = 0; i < n; ++i) {
      items.push(readExpr(f, b, position(base, offset + i * f.bytes), endianness, inline));
    }
  }
  else {
    const chunk = f.d.slice(level + 1).reduce((a, k) => a * k, f.bytes);
    for (let i = 0; i < n; ++i) {
      items.push(arrayLiteral(f, b, base, endianness, inline, level + 1, offset + i * chunk));
    }
  }
  return `[${items.join(',')}]`;
}

export function generate(layout, { inline }) {
  const { fields, units, size } = layout;
  const out = [];
  const emit = line => out.push(line);

  /*
   * Array descriptors, one per (array member, endianness) pair in use.
   */
  const descriptors = new Map();
  const descriptor = (f, endianness) => {
    const e = f.bytes == 1 && !f.floating ? 'LE' : endianness;
    const id = `$d${fields.indexOf(f)}${e}`;
    if (!descriptors.has(id)) {
      const pos = position('p', 0);
      descriptors.set(id, 
        `const ${id}=$array(${JSON.stringify({ d: f.d, bytes: f.bytes, total: f.total })},` +
        `function(b,p){return ${readExpr(f, 'b', pos, e, inline)};},` +
        `function(b,p,v){${writeStmt(f, 'b', pos, e, convExpr(f, 'v', e), inline)}});`
      );
    }
    return id;
  };

  const arrayRead = (f, b, base, endianness) => {
    if (f.count <= UNROLL_LIMIT) {
      return arrayLiteral(f, b, base, endianness, inline);
    }
    return `$arrayGet(${b},${position(base, f.offset)()},${descriptor(f, endianness)})`;
  };

  /*
   * Constructor
   */
  emit(`function Struct(arg,opts){`);
  emit(`if(arg===undefined){this._buf=$Buffer.alloc(this.length);}`);
  emit(`else if(arg instanceof $Buffer){`);
  emit(`if(arg.length<this.length)$short(this.length,arg.length);`);
  emit(`this._buf=arg;}`);
  emit(`else if(typeof arg==="object"){`);
  emit(`const n=opts!==undefined&&opts.toAlloc!==undefined&&opts.toAlloc!==null?opts.toAlloc:this.length;`);
  emit(`const internal=arg._structCompileInternal;`);
  emit(`this._buf=internal!==undefined&&internal.zeroed===false?$Buffer.allocUnsafe(n):$Buffer.alloc(n);`);
  emit(`merge.call(this,arg);}`);
  emit(`}`);
  emit(`const P=Struct.prototype;`);

  /*
   * Lazy accessors
   */
  const accessors = [];

  const scalarAccessor = (f) => {
    const pos = position(null, f.offset);
    accessors.push(
      `${literalKey(f.name)}:{` +
      `get(){const b=this._buf;return ${readExpr(f, 'b', pos, f.endianness, inline)};},` +
      `set(v){const b=this._buf;${writeStmt(f, 'b', pos, f.endianness, convExpr(f, 'v', f.endianness), inline)}}}`
    );
  };

  for (const unit of units) {
    scalarAccessor(unit);
  }

  for (const f of fields) {
    if (f.kind == 'scalar') {
      scalarAccessor(f);
    }
    else if (f.kind == 'array') {
      const id = descriptor(f, f.endianness);
      accessors.push(
        `${literalKey(f.name)}:{` +
        `get(){return $arrayView(this._buf.subarray(${f.offset},${f.offset + f.total}),${id});},` +
        `set(v){$arraySet(this._buf,${f.offset},${id},v);}}`
      );
    }
    else if (f.kind == 'bits') {
      const { unit } = f;
      const pos = position(null, unit.offset);
      const u = readExpr(unitSpec(unit), 'b', pos, unit.endianness, inline);
      accessors.push(
        `${literalKey(f.name)}:{` +
        `get(){const b=this._buf;return ${bitsGetExpr(f, u)};},` +
        `set(v){const b=this._buf;${writeStmt(unitSpec(unit), 'b', pos, unit.endianness, bitsSetExpr(f, u, 'v'), inline)}}}`
      );
    }
  }

  const accessorsAt = out.length;
  emit('');

  /*
   * toObject / merge / toString go through the accessors by name, so
   * subclasses overriding a member are respected.
   */
  const objectItems = fields.map(f => {
    const value = f.kind == 'array' ? arrayRead(f, 'b', null, f.endianness) : member('this', f.name);
    return `${literalKey(f.name)}:${value}`;
  });
  emit(`P.toObject=function toObject(){`);
  if (fields.some(f => f.kind == 'array')) {
    emit(`const b=this._buf;`);
  }
  emit(`const r={${objectItems.join(',')}};`);
  emit(`if($extras.length!==0)$extrasToObject(this,r);`);
  emit(`return r;};`);

  emit(`function merge(o){let v;`);
  for (const f of fields) {
    const target = member('this', f.name);
    const dims = layout.props[f.name].d;
    if (dims.length > 0) {
      emit(`if((v=${member('o', f.name)})!==undefined){if(Array.isArray(v))$multiDimSet(${target},${JSON.stringify(dims)},v);else ${target}=v;}`);
    }
    else {
      emit(`if((v=${member('o', f.name)})!==undefined)${target}=v;`);
    }
  }
  emit(`if($extras.length!==0)$extrasMerge(this,o);`);
  emit(`}`);
  emit(`P.merge=merge;`);

  const stringItems = fields
    .filter(f => layout.props[f.name].d.length == 0)
    .map(f => `+${JSON.stringify(` | ${f.name}: `)}+$str(${member('this', f.name)})`);
  emit(`P.toString=function toString(){`);
  emit(`return $head${stringItems.join('')}+($extras.length!==0?$extrasToString(this):"")+">";};`);

  /*
   * Eager codecs: decode(buf, offset) -> plain object, encode(buf, offset, values)
   */
  const codec = (suffix, override) => {
    const e = f => override ?? f.endianness;

    const prelude = [];
    const items = [];
    for (const f of fields) {
      if (f.kind == 'scalar') {
        items.push(`${literalKey(f.name)}:${readExpr(f, 'b', position('o', f.offset), e(f), inline)}`);
      }
      else if (f.kind == 'array') {
        items.push(`${literalKey(f.name)}:${arrayRead(f, 'b', 'o', e(f))}`);
      }
      else if (f.kind == 'bits') {
        const { unit } = f;
        const local = `u${units.indexOf(unit)}`;
        if (unit.members[0] === f) {
          prelude.push(`const ${local}=${readExpr(unitSpec(unit), 'b', position('o', unit.offset), e(unit), inline)};`);
        }
        items.push(`${literalKey(f.name)}:${bitsGetExpr(f, local)}`);
      }
    }

    emit(`Struct.decode${suffix}=function decode${suffix}(b,o){`);
    emit(`if(o===undefined)o=0;`);
    if (inline) {
      emit(`if(!(o>=0&&o+${size}<=b.length))$range(b,o);`);
    }
    emit(prelude.join(''));
    emit(`return{${items.join(',')}};};`);

    emit(`Struct.encode${suffix}=function encode${suffix}(b,o,v){let t;`);
    if (inline) {
      emit(`if(!(o>=0&&o+${size}<=b.length))$range(b,o);`);
    }
    for (const f of fields) {
      const value = member('v', f.name);
      if (f.kind == 'scalar') {
        emit(`t=${value};${writeStmt(f, 'b', position('o', f.offset), e(f), convExpr(f, 't', e(f)), inline)}`);
      }
      else if (f.kind == 'array') {
        emit(`$arraySet(b,${position('o', f.offset)()},${descriptor(f, e(f))},${value});`);
      }
      else if (f.kind == 'bits' && f.unit.members[0] === f) {
        const { unit } = f;
        const packed = bitsPackExpr(unit, m => member('v', m.name));
        emit(writeStmt(unitSpec(unit), 'b', position('o', unit.offset), e(unit), packed, inline));
      }
    }
    emit(`};`);
  };

  codec('', null);
  codec('LE', 'LE');
  codec('BE', 'BE');

  emit(`return Struct;`);

  out[accessorsAt] = 
    [...descriptors.values()].join('\n') + 
    `\nObject.defineProperties(P,{${accessors.join(',\n')}});`;

  return out.join('\n');
}
