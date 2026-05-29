/**
 * Invariant #5: only `src/m3-nl/llm-explainer.js` may import the
 * Anthropic SDK. This test reads every M3 source file (excluding
 * tests) and asserts the rule with a string search.
 */

const fs = require('fs');
const path = require('path');

const M3_DIR = path.resolve(__dirname, '..');
const SDK_NEEDLE = '@anthropic-ai/sdk';

function listM3SourceFiles(): string[] {
  return fs
    .readdirSync(M3_DIR)
    .filter((name: string) => name.endsWith('.js'))
    .map((name: string) => path.join(M3_DIR, name));
}

describe('Anthropic SDK import isolation (Invariant #5)', () => {
  const sourceFiles = listM3SourceFiles();

  test('finds at least the expected M3 source files', () => {
    const names = sourceFiles.map((f: string) => path.basename(f));
    expect(names).toEqual(
      expect.arrayContaining([
        'query-handler.js',
        'intent-classifier.js',
        'tools-registry.js',
        'reasoning-chain.js',
        'llm-explainer.js',
        'response-formatter.js',
        'sanitiser.js',
        'constants.js',
      ]),
    );
  });

  // Ask the Doctor no longer talks to Anthropic — the chat now runs against
  // the live PRS state + Loomi Conversations Server. Invariant #5 evolves
  // from "only llm-explainer may import the SDK" to "no M3 file may import
  // the SDK".
  test('no M3 file references @anthropic-ai/sdk', () => {
    const importers: string[] = [];
    for (const file of sourceFiles) {
      const text = fs.readFileSync(file, 'utf8');
      if (text.includes(SDK_NEEDLE)) {
        importers.push(path.basename(file));
      }
    }
    expect(importers).toEqual([]);
  });
});

export {};
