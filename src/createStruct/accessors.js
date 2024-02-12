export function accessorFromParams({ endianness, signed, length, customKey, action }) {
  let key = customKey ?? (length == 64 ? 'BigInt' : 'Int');
  if (!signed && key == 'BigInt') {
    key = 'BigUInt';
  }
  return `${action}${length == 64 ? '' : (signed ? '' : 'U')}${key}${customKey ? '' : length}${length > 8 ? endianness : ''}`;
};
