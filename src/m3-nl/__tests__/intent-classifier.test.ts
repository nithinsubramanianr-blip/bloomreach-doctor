/**
 * Unit tests — intent classifier.
 * No SDK / network involvement.
 *
 * Written as a CommonJS file routed through ts-jest so it matches the
 * existing jest "react" project test pattern (`.test.ts`).
 */

const { classifyIntent } = require('../intent-classifier');

describe('classifyIntent', () => {
  test('classifies diagnosis intent', () => {
    expect(classifyIntent('Why is my personalisation not working?')).toBe(
      'diagnosis',
    );
    expect(classifyIntent('What is wrong with my store?')).toBe('diagnosis');
  });

  test('classifies fix-request intent', () => {
    expect(classifyIntent('What should I fix first?')).toBe('fix-request');
    expect(classifyIntent('How do I improve search?')).toBe('fix-request');
    expect(classifyIntent('Recommend the next change')).toBe('fix-request');
  });

  test('classifies dimension-drill intent', () => {
    expect(classifyIntent('Why is my BRUID score so low?')).toBe(
      'dimension-drill',
    );
    expect(classifyIntent('Tell me about signal freshness')).toBe(
      'dimension-drill',
    );
    expect(classifyIntent('Are there any rule conflicts?')).toBe(
      'dimension-drill',
    );
    expect(classifyIntent('How is A/B test coverage?')).toBe(
      'dimension-drill',
    );
  });

  test('classifies archetype-compare intent', () => {
    expect(
      classifyIntent(
        'Show me what good personalisation looks like for my top 3 customer types',
      ),
    ).toBe('archetype-compare');
    expect(classifyIntent('Compare segments across personas')).toBe(
      'archetype-compare',
    );
    expect(classifyIntent('How are different shoppers treated?')).toBe(
      'archetype-compare',
    );
  });

  test('defaults to diagnosis when nothing matches', () => {
    expect(classifyIntent('asdfqwerty')).toBe('diagnosis');
    expect(classifyIntent('')).toBe('diagnosis');
    expect(classifyIntent(null as unknown as string)).toBe('diagnosis');
  });
});

export {};
