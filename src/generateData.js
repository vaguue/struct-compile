import path, { dirname } from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { parseInput } from './parser.js';
import { traverseResult } from './visitor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function parseExample(name, outName) {
  const result = parseInput(
    await fs.readFile(path.resolve(__dirname, '..', 'examples', name)).then(buf => buf.toString()),
    'structs',
    false
  );

  const traversed = traverseResult(result.cstOutput);

  await Promise.all([
    [`parsed-${outName}`, result.cstOutput], 
    [`traversed-${outName}`, traversed],
  ].map(e => fs.writeFile(path.resolve(__dirname, '..', 'test', 'data', e[0]), JSON.stringify(e[1]))));
}

async function basic() {
  return parseExample('basic.h', 'basic.json');
}

async function moreFeatures() {
  return parseExample('more-features.h', 'more-features.json');
}

await Promise.all([basic(), moreFeatures()]);
