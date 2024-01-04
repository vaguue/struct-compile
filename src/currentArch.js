import os from 'os';

let is64;

if (os.machine) {
  is64 = os.machine().includes('64');
}
else {
  const arch = os.arch();
  if (arch.includes('64') || arch == 'mipsel') {
    is64 = true;
  }
  else {
    is64 = false;
  }
}

export const currentArch = {
  endianness: os.endianness(),
  pointerSize: is64 ? 8 : 4,
  bits: is64 ? 64 : 32,
};
