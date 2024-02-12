export function endiannessFromMeta(defaultEndianness, meta) {
  let isBE = false;
  let isLE = false;
  if (meta.BE || meta.NE) {
    isBE = true;
  }
  else if (meta.LE) {
    isLE = true;
  }
  if (isBE && isLE) {
    throw new Error('Cannot have both BE and LE');
  }

  if (isBE) {
    return 'BE';
  }
  if (isLE) {
    return 'LE';
  }

  return defaultEndianness;
};
