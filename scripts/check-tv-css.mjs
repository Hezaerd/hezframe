import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transform } from 'lightningcss';
import { TV_CHROME_MAJOR } from '../plugins/tizen-widget-assets.mts';

const root = fileURLToPath(new URL('../dist/web/', import.meta.url));
const files = readdirSync(root, { recursive: true }).filter(name => name.endsWith('.css')).sort();
if (!files.length) throw Error('No packaged CSS found. Run npm run build first.');

function serializeDeclarationsSeparately(code, targets) {
  let id = 0;
  return transform({
    filename: 'packaged.css', code, targets,
    visitor: {
      Rule: {
        style(rule) {
          const { declarations, importantDeclarations } = rule.value.declarations;
          const isolate = (declaration, important) => ({
            ...rule,
            value: {
              ...rule.value,
              selectors: rule.value.selectors.map(selector => [
                ...selector, { type: 'class', name: `tv-css-declaration-${id++}` }
              ]),
              declarations: {
                declarations: important ? [] : [declaration],
                importantDeclarations: important ? [declaration] : []
              },
              rules: []
            }
          });
          const rules = [
            ...declarations.map(declaration => isolate(declaration, false)),
            ...importantDeclarations.map(declaration => isolate(declaration, true)),
            { ...rule, value: { ...rule.value, declarations: { declarations: [], importantDeclarations: [] } } }
          ];
          return JSON.parse(JSON.stringify(rules), (_key, value) => value === null ? undefined : value);
        }
      }
    }
  }).code;
}

let failures = 0;
for (const file of files) {
  const code = readFileSync(root + file);
  const normalized = serializeDeclarationsSeparately(code);
  const lowered = serializeDeclarationsSeparately(code, { chrome: TV_CHROME_MAJOR << 16 });
  if (!normalized.equals(lowered)) {
    console.error(`FAIL ${file.replaceAll('\\', '/')}: CSS requires lowering for Chrome ${TV_CHROME_MAJOR}.`);
    failures++;
  }
}
console.log(`TV CSS compatibility: ${files.length - failures}/${files.length} packaged stylesheets pass Chrome ${TV_CHROME_MAJOR}.`);
if (failures) process.exitCode = 1;
