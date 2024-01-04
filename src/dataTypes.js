import { Trie } from './trie.js';

export const cDataTypes = {
  'char': { signed: true, length: 8 },
  'signed char': { signed: true, length: 8 },
  'unsigned char': { signed: false, length: 8 },
  'short': { signed: true, length: 16 },
  'unsigned short': { signed: false, length: 16 },
  'int': { 
    signed: true, 
    length: (arch) => arch.bits == 64 ? 32 : 16,
  },
  'unsigned int': { 
    signed: false, 
    length: (arch) => arch.bits == 64 ? 32 : 16,
  },
  'long': { 
    signed: true, 
    length: (arch) => arch.bits == 64 ? 64 : 32,
  },
  'unsigned long': { 
    signed: false, 
    length: (arch) => arch.bits == 64 ? 64 : 32,
  },
  'long long': { signed: true, length: 64 },
  'unsigned long long': { signed: false, length: 64 },
  'bool': { signed: false, length: 1 },
  'float': { signed: true, length: 32, customKey: 'Float' },
  'double': { signed: true, length: 64, customKey: 'Double' },
  'long double': { 
    signed: true, 
    //length: (arch) => arch.bits == 64 ? 128 : 96,
    length: (arch) => {
      throw new Error('long double not supported');
    },
  },
  //stdint.h
  'int8_t': { signed: true, length: 8 },
  'uint8_t': { signed: false, length: 8 },
  'int16_t': { signed: true, length: 16 },
  'uint16_t': { signed: false, length: 16 },
  'int32_t': { signed: true, length: 32 },
  'uint32_t': { signed: false, length: 32 },
  'int64_t': { signed: true, length: 64 },
  'uint64_t': { signed: false, length: 64 },
  'int_least8_t': { signed: true, length: 8 },
  'uint_least8_t': { signed: false, length: 8 },
  'int_least16_t': { signed: true, length: 16 },
  'uint_least16_t': { signed: false, length: 16 },
  'int_least32_t': { signed: true, length: 32 },
  'uint_least32_t': { signed: false, length: 32 },
  'int_least64_t': { signed: true, length: 64 },
  'uint_least64_t': { signed: false, length: 64 },
  'int_fast8_t': { signed: true, length: 8 },
  'uint_fast8_t': { signed: false, length: 8 },
  'int_fast16_t': { signed: true, length: 16 },
  'uint_fast16_t': { signed: false, length: 16 },
  'int_fast32_t': { signed: true, length: 32 },
  'uint_fast32_t': { signed: false, length: 32 },
  'int_fast64_t': { signed: true, length: 64 },
  'uint_fast64_t': { signed: false, length: 64 },
  'intptr_t': { 
    signed: true, 
    length: (arch) => arch.bits == 64 ? 64 : 32,
  },
  'uintptr_t': { 
    signed: false, 
    length: (arch) => arch.bits == 64 ? 64 : 32,
  },
  'intmax_t': { signed: true, length: 64 },
  'uintmax_t': { signed: false, length: 64 },
  'void': { signed: false, length: 0 },
};

export const typeKeywords = Object.keys(cDataTypes);

export const trie = new Trie();

for (const key of typeKeywords) {
  trie.add(key);
}

export function matchType(str, startOffset) {
  return trie.search(str, startOffset);
}
