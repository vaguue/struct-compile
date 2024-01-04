import os from 'os';

const is64 = os.machine().includes('64');

export const currentArch = {
  endianness: os.endianness(),
  pointerSize: is64 ? 8 : 4,
  bits: is64 ? 64 : 32,
};
