import path, { dirname } from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import { createSyntaxDiagramsCode } from 'chevrotain';
import { StructParser } from './parser.js'; 

const __dirname = dirname(fileURLToPath(import.meta.url));

const parserInstance = new StructParser();
const serializedGrammar = parserInstance.getSerializedGastProductions();

const htmlText = createSyntaxDiagramsCode(serializedGrammar);

const outPath = path.resolve(__dirname, '..','assets');
try {
  await fs.access(outPath);
} catch(err) {
  await fs.mkdir(outPath);
}

await fs.writeFile(path.join(outPath, 'generated_diagrams.html'), htmlText);
