import { describe, expect, it } from 'vitest';

import { hit } from '@/theme/tokens';

import { resolveButtonVisual, type ButtonVariant } from './buttonVariant';

const ALL_VARIANTS: ButtonVariant[] = ['primary', 'secondary', 'destructive', 'danger', 'tertiary'];

describe('resolveButtonVisual', () => {
  it('never returns a tap target smaller than hit.min for any variant', () => {
    for (const variant of ALL_VARIANTS) {
      expect(resolveButtonVisual(variant).minHeight).toBeGreaterThanOrEqual(hit.min);
    }
  });

  it('gives primary the tallest (hit.primary) target, reserved for the single main CTA', () => {
    expect(resolveButtonVisual('primary').minHeight).toBe(hit.primary);
    for (const variant of ALL_VARIANTS.filter((v) => v !== 'primary')) {
      expect(resolveButtonVisual(variant).minHeight).toBe(hit.min);
    }
  });

  it('never fills destructive — hollow border+text per APP-UI.md:98, "destructive = deliberate, not loud"', () => {
    const visual = resolveButtonVisual('destructive');
    expect(visual.backgroundColor).toBe('transparent');
    expect(visual.borderWidth).toBeGreaterThan(0);
  });

  it('reserves a filled treatment for danger (irreversible actions only)', () => {
    const visual = resolveButtonVisual('danger');
    expect(visual.backgroundColor).not.toBe('transparent');
  });

  it('gives tertiary a hairline border so it reads as tappable, unlike bare text', () => {
    const visual = resolveButtonVisual('tertiary');
    expect(visual.borderWidth).toBeGreaterThan(0);
  });

  it('dims disabled buttons and gives pressed buttons feedback, with disabled taking priority', () => {
    const enabled = resolveButtonVisual('primary');
    const pressed = resolveButtonVisual('primary', { pressed: true });
    const disabled = resolveButtonVisual('primary', { disabled: true });
    const disabledAndPressed = resolveButtonVisual('primary', { disabled: true, pressed: true });

    expect(pressed.opacity).toBeLessThan(enabled.opacity);
    expect(disabled.opacity).toBeLessThan(enabled.opacity);
    expect(disabledAndPressed.opacity).toBe(disabled.opacity);
  });

  it('keeps opacity at 1 for a resting, enabled button', () => {
    expect(resolveButtonVisual('secondary').opacity).toBe(1);
  });
});
