// Data only, from the WHATWG HTML standard; see THIRD_PARTY_NOTICES.md.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const input = readFileSync(new URL('../entities.reference.json', import.meta.url));
const source = JSON.parse(input);
const entries = Object.entries(source).map(([k, v]) => [k.slice(1), v.characters]);
writeFileSync(new URL('../src/entities.ts', import.meta.url),
  '// Generated WHATWG named character reference data. See THIRD_PARTY_NOTICES.md.\n' +
  `// Input SHA-256: ${createHash('sha256').update(input).digest('hex')}\n` +
  `export const HTML_ENTITIES: Readonly<Record<string, string>> = Object.freeze(${JSON.stringify(Object.fromEntries(entries), null, 2)});\n`);
console.log(`Generated ${entries.length} named entities (including legacy semicolon-free names).`);
