export const maybeNumber = val => {
  const tmp = parseInt(val);
  return Number.isNaN(tmp) ? val : tmp;
};

export const forSize = (size, val, floating = false) => {
  if (size > 32 && !floating) {
    return BigInt(val);
  }
  if (typeof val == 'number' || typeof val == 'bigint') {
    return val;
  }
  const mbNum = maybeNumber(val);
  if (typeof mbNum == 'number') {
    return mbNum;
  }
  if (size == 8 && typeof val == 'string' && val.length == 1) {
    return val.charCodeAt(0);
  }
  throw new Error(`Invalid value for setting: ${val}`);
};

export const createMask = (size, offset, floating, length) => {
  if (length == 64 && !floating) {
    return [((1n << BigInt(size)) - 1n), BigInt(offset)];
  }
  return [((1 << size) - 1), offset];
};
