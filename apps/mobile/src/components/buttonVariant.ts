import { colors, hit, radius } from '@/theme/tokens';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive' | 'danger' | 'tertiary';

export type ButtonVisual = {
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
  textColor: string;
  minHeight: number;
  fontSize: number;
  fontWeight: '700' | '800';
  letterSpacing: number;
  opacity: number;
};

type ButtonState = { pressed?: boolean; disabled?: boolean };

const BASE: Record<ButtonVariant, Omit<ButtonVisual, 'opacity'>> = {
  primary: {
    backgroundColor: colors.orange, borderColor: colors.orange, borderWidth: 0, borderRadius: radius.md,
    textColor: colors.background, minHeight: hit.primary, fontSize: 16, fontWeight: '800', letterSpacing: 0.5,
  },
  secondary: {
    backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    textColor: colors.text, minHeight: hit.min, fontSize: 14, fontWeight: '700', letterSpacing: 0,
  },
  destructive: {
    backgroundColor: 'transparent', borderColor: colors.danger, borderWidth: 1, borderRadius: radius.md,
    textColor: colors.danger, minHeight: hit.min, fontSize: 13, fontWeight: '700', letterSpacing: 0,
  },
  danger: {
    backgroundColor: colors.danger, borderColor: colors.danger, borderWidth: 0, borderRadius: radius.md,
    textColor: colors.background, minHeight: hit.min, fontSize: 14, fontWeight: '800', letterSpacing: 0.5,
  },
  tertiary: {
    backgroundColor: 'transparent', borderColor: colors.border, borderWidth: 1, borderRadius: radius.md,
    textColor: colors.muted, minHeight: hit.min, fontSize: 13, fontWeight: '700', letterSpacing: 0,
  },
};

export function resolveButtonVisual(variant: ButtonVariant, state: ButtonState = {}): ButtonVisual {
  const base = BASE[variant];
  const opacity = state.disabled ? 0.5 : state.pressed ? 0.8 : 1;
  return { ...base, opacity };
}
