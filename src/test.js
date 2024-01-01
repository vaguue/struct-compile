import path, { dirname } from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { parseInput } from './parser.js';
import { interpreter } from './visitor.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function basic() {
  const result = parseInput(
    await fs.readFile(path.resolve(__dirname, '..', 'examples', 'more-features.h')).then(buf => buf.toString()),
    'structs',
    false
  );

  await fs.writeFile('result-more-features.json', JSON.stringify(result.cstOutput));

  const value = interpreter.visit(result.cstOutput);
  console.log(value);
  console.log(value.map(e => e.members.map(e => e.value)));
}

await basic();
