import path, { dirname } from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { parseInput } from './parser.js';
import { interpreter } from './visitor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function parseExample(name, outName) {
  const result = parseInput(
    await fs.readFile(path.resolve(__dirname, '..', 'examples', name)).then(buf => buf.toString()),
    'structs',
    false
  );

  await fs.writeFile(path.resolve(__dirname, '..', 'test', 'data', outName), JSON.stringify(result.cstOutput));
}

async function basic() {
  return parseExample('basic.h', 'parsed-basic.json');
}

async function moreFeatures() {
  return parseExample('more-features.h', 'parsed-more-features.json');
}

await Promise.all([basic(), moreFeatures()]);
