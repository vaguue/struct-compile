import { parseInput } from './parser.js';
import { traverseResult } from './visitor.js';
import { createMany, create } from './createStruct.js';
import { currentArch } from './currentArch.js';

export function compile(str, arch = currentArch, BufferImpl = Buffer) {
  return createMany(traverseResult(parseInput(str).cstOutput), arch, BufferImpl);
}

export function fromConfig(config, arch = currentArch, BufferImpl = Buffer) {
  return create(config, arch, BufferImpl);
}

export { alignOffset } from './createStruct.js';
