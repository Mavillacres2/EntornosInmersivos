import { describe, expect, it } from 'vitest';
import { visualRuleDemo } from '../VisualRuleDemo';

describe('instruction examples', () => {
  it('keeps both action and inhibition rules visible without relying on colour', () => {
    expect(visualRuleDemo('classroom')).toContain('Verde: pulsa');
    expect(visualRuleDemo('classroom')).toContain('Rojo: espera');
    expect(visualRuleDemo('space')).toContain('Letra X: pulsa');
    expect(visualRuleDemo('space')).toContain('Otra letra: espera');
  });
  it('marks museum examples as unscored and shows exactly one different face', () => {
    const demo = visualRuleDemo('museum');
    expect(demo).toContain('NO CUENTA PUNTOS');
    expect(demo.match(/☺/g)).toHaveLength(2);
    expect(demo.match(/☹/g)).toHaveLength(1);
    expect(demo).not.toContain('<button');
  });
});
