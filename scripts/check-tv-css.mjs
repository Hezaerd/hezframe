import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { transform } from 'lightningcss';
import { TV_CHROME_MAJOR } from '../plugins/tizen-widget-assets.mts';

const root = fileURLToPath(new URL('../dist/web/', import.meta.url));
const files = readdirSync(root, { recursive: true })
  .filter((name) => name.endsWith('.css'))
  .toSorted();
if (files.length === 0) throw new Error('No packaged CSS found. Run npm run build first.');

function serializeDeclarationsSeparately(code, targets) {
  let id = 0;
  let hasInset = false;
  const result = transform({
    filename: 'packaged.css',
    code,
    targets,
    visitor: {
      Declaration(declaration) {
        const property =
          declaration.property === 'unparsed'
            ? declaration.value.propertyId.property
            : declaration.property;
        if (property === 'inset') hasInset = true;
      },
      Rule: {
        style(rule) {
          const { declarations, importantDeclarations } = rule.value.declarations;
          const groupByProperty = (declarations) =>
            Map.groupBy(declarations, (declaration) =>
              declaration.property === 'unparsed'
                ? declaration.value.propertyId.property
                : declaration.property,
            );
          const isolate = (declarations, important) => ({
            ...rule,
            value: {
              ...rule.value,
              selectors: rule.value.selectors.map((selector) => [
                ...selector,
                { type: 'class', name: `tv-css-declaration-${id++}` },
              ]),
              declarations: {
                declarations: important ? [] : declarations,
                importantDeclarations: important ? declarations : [],
              },
              rules: [],
            },
          });
          const rules = [
            ...[...groupByProperty(declarations).values()].map((group) => isolate(group, false)),
            ...[...groupByProperty(importantDeclarations).values()].map((group) =>
              isolate(group, true),
            ),
            {
              ...rule,
              value: {
                ...rule.value,
                declarations: { declarations: [], importantDeclarations: [] },
              },
            },
          ];
          return JSON.parse(JSON.stringify(rules), (_key, value) =>
            value === null ? undefined : value,
          );
        },
      },
    },
  });
  return { code: result.code, hasInset };
}

let failures = 0;
for (const file of files) {
  const code = readFileSync(root + file);
  const normalized = serializeDeclarationsSeparately(code);
  const lowered = serializeDeclarationsSeparately(code, { chrome: TV_CHROME_MAJOR << 16 });
  if (normalized.hasInset || !normalized.code.equals(lowered.code)) {
    console.error(
      `FAIL ${file.replaceAll('\\', '/')}: CSS requires lowering for Chrome ${TV_CHROME_MAJOR}.`,
    );
    failures++;
  }
}
console.log(
  `TV CSS compatibility: ${files.length - failures}/${files.length} packaged stylesheets pass Chrome ${TV_CHROME_MAJOR}.`,
);
if (failures) process.exitCode = 1;
