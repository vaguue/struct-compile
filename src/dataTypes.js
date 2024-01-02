import { Trie } from './trie.js';

export const cDataTypes = {
  'char': { signed: true, size: 8 },
  'signed char': { signed: true, size: 8 },
  'unsigned char': { signed: false, size: 8 },
  'short': { signed: true, size: 16 },
  'unsigned short': { signed: false, size: 16 },
  'int': { 
    signed: true, 
    size: (arch) => arch.bits == 64 ? 32 : 16,
  },
  'unsigned int': { 
    signed: false, 
    size: (arch) => arch.bits == 64 ? 32 : 16,
  },
  'long': { 
    signed: true, 
    size: (arch) => arch.bits == 64 ? 64 : 32,
  },
  'unsigned long': { 
    signed: false, 
    size: (arch) => arch.bits == 64 ? 64 : 32,
  },
  'long long': { signed: true, size: 64 },
  'unsigned long long': { signed: false, size: 64 },
  'bool': { signed: false, size: 1 },
  'float': { signed: true, size: 32 },
  'double': { signed: true, size: 64 },
  'long double': { 
    signed: true, 
    size: (arch) => arch.bits == 64 ? 128 : 96,
  },
  //stdint.h
  'int8_t': { signed: true, size: 8 },
  'uint8_t': { signed: false, size: 8 },
  'int16_t': { signed: true, size: 16 },
  'uint16_t': { signed: false, size: 16 },
  'int32_t': { signed: true, size: 32 },
  'uint32_t': { signed: false, size: 32 },
  'int64_t': { signed: true, size: 64 },
  'uint64_t': { signed: false, size: 64 },
  'int_least8_t': { signed: true, size: 8 },
  'uint_least8_t': { signed: false, size: 8 },
  'int_least16_t': { signed: true, size: 16 },
  'uint_least16_t': { signed: false, size: 16 },
  'int_least32_t': { signed: true, size: 32 },
  'uint_least32_t': { signed: false, size: 32 },
  'int_least64_t': { signed: true, size: 64 },
  'uint_least64_t': { signed: false, size: 64 },
  'int_fast8_t': { signed: true, size: 8 },
  'uint_fast8_t': { signed: false, size: 8 },
  'int_fast16_t': { signed: true, size: 16 },
  'uint_fast16_t': { signed: false, size: 16 },
  'int_fast32_t': { signed: true, size: 32 },
  'uint_fast32_t': { signed: false, size: 32 },
  'int_fast64_t': { signed: true, size: 64 },
  'uint_fast64_t': { signed: false, size: 64 },
  'intptr_t': { 
    signed: true, 
    size: (arch) => arch.bits == 64 ? 64 : 32,
  },
  'uintptr_t': { 
    signed: false, 
    size: (arch) => arch.bits == 64 ? 64 : 32,
  },
  'intmax_t': { signed: true, size: 64 },
  'uintmax_t': { signed: false, size: 64 },
  'void': { signed: false, size: 0 },
};

export const typeKeywords = Object.keys(cDataTypes);

export const trie = new Trie();

for (const key of typeKeywords) {
  trie.add(key);
}

export function matchType(str, startOffset) {
  return trie.search(str, startOffset);
}
