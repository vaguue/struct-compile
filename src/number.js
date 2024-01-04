export const maybeNumber = val => {
  const tmp = parseInt(val);
  return Number.isNaN(tmp) ? val : tmp;
};

export const forSize = (size, val) => {
  if (typeof val == 'number' || typeof val == 'bigint') {
    return val;
  }
  if (size > 32) {
    return BigInt(val);
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
