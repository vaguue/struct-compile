import { maybeNumber } from '#src/number';

/*
 * Runtime support for fixed-size (possibly multi-dimensional) array members.
 *
 * Every array member gets one descriptor, created at compile time:
 *   { d, bytes, total, read(buf, pos), write(buf, pos, value), BufferImpl }
 * `read` / `write` are generated element accessors, `d` are the dimensions,
 * `bytes` is the element size and `total` the full size in bytes.
 */

// Eagerly reads the whole array into nested plain JS arrays.
export function arrayGet(buf, pos, desc, level = 0) {
  const { d, bytes, read } = desc;
  const n = d[level];
  const res = new Array(n);
  if (level == d.length - 1) {
    for (let i = 0; i < n; ++i) {
      res[i] = read(buf, pos + i * bytes);
    }
    return res;
  }
  const chunk = desc.chunks[level];
  for (let i = 0; i < n; ++i) {
    res[i] = arrayGet(buf, pos + i * chunk, desc, level + 1);
  }
  return res;
}

// Writes a Buffer (raw copy), an array (element-wise, may be nested or partial)
// or anything else (as a string) into the array region starting at `pos`.
export function arraySet(buf, pos, desc, val, level = 0) {
  if (val === undefined || val === null) return;
  const size = level == 0 ? desc.total : desc.chunks[level - 1];
  if (val instanceof desc.BufferImpl) {
    val.copy(buf, pos, 0, Math.min(val.length, size));
  }
  else if (Array.isArray(val)) {
    const { d, bytes, write } = desc;
    const n = Math.min(val.length, d[level]);
    if (level == d.length - 1) {
      for (let i = 0; i < n; ++i) {
        write(buf, pos + i * bytes, val[i]);
      }
    }
    else {
      const chunk = desc.chunks[level];
      for (let i = 0; i < n; ++i) {
        arraySet(buf, pos + i * chunk, desc, val[i], level + 1);
      }
    }
  }
  else {
    buf.subarray(pos, pos + size).write(val.toString());
  }
}

function createHandler(desc, level) {
  const { d, bytes, read, write } = desc;
  const k = d[level];
  const leaf = level == d.length - 1;
  const chunk = leaf ? bytes : desc.chunks[level];

  const checkIndex = (index) => {
    if (index < 0 || index >= k) {
      throw new Error(`Out of bounds value, expected index to be 0 <= index < ${k}`);
    }
  };

  return {
    get(target, _prop) {
      if (typeof _prop == 'symbol') {
        return target[_prop];
      }

      const prop = maybeNumber(_prop);
      if (typeof prop == 'number') {
        checkIndex(prop);
        if (leaf) {
          return read(target, prop * chunk);
        }
        return new Proxy(target.subarray(prop * chunk, (prop + 1) * chunk), desc.handlers[level + 1]);
      }

      const res = target[prop];
      return typeof res == 'function' ? res.bind(target) : res;
    },
    set(target, _prop, val) {
      if (typeof _prop == 'symbol') {
        target[_prop] = val;
        return true;
      }

      const prop = maybeNumber(_prop);
      if (typeof prop == 'number') {
        checkIndex(prop);
        if (leaf) {
          write(target, prop * chunk, val);
        }
        else {
          arraySet(target, prop * chunk, desc, val, level + 1);
        }
        return true;
      }

      target[prop] = val;
      return true;
    },
  };
}

export function createArrayDescriptor({ d, bytes, total }, read, write, BufferImpl) {
  const desc = { d, bytes, total, read, write, BufferImpl, chunks: [], handlers: [] };
  // chunks[level] is the size in bytes of one element at that level
  let chunk = total;
  for (let level = 0; level < d.length; ++level) {
    chunk /= d[level];
    desc.chunks.push(chunk);
  }
  for (let level = 0; level < d.length; ++level) {
    desc.handlers.push(createHandler(desc, level));
  }
  return desc;
}

// Lazy element-wise view over the array region, `view[i][j]` reads/writes in place.
export function arrayView(buf, desc) {
  return new Proxy(buf, desc.handlers[0]);
}
