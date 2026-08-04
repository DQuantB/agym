export const colors = {
  background: '#080808',
  surface: '#151515',
  surfaceRaised: '#1D1D1D',
  border: '#343434',
  text: '#F4EFE8',
  muted: '#AAA49B',
  orange: '#FF6A2A',
  green: '#68C789',
  gold: '#E7B84D',
  danger: '#F07972',
} as const;

export const spacing = { xs: 6, sm: 10, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, pill: 999 } as const;

export const type = {
  eyebrow: { fontSize: 12, fontWeight: '800' as const, letterSpacing: 1.5 },
  title: { fontSize: 30, fontWeight: '700' as const },
  heading: { fontSize: 20, fontWeight: '700' as const },
  body: { fontSize: 15, lineHeight: 21 },
  metric: { fontSize: 34, fontWeight: '700' as const },
  caption: { fontSize: 13, lineHeight: 18 },
} as const;

export const hit = { min: 44, primary: 56 } as const;

/** Shared four-tone semantic map (MOBILE-UI-v2.md:58): neutral/proposal/confirmed/warning. */
export const tone = { neutral: colors.muted, proposal: colors.orange, confirmed: colors.green, warning: colors.gold } as const;

/**
 * 5-step density ramp for the training grid (index 0 = no session). Every
 * cell here represents a confirmed session, so the ramp is built on
 * colors.green, the app's semantic "confirmed" color.
 */
export const trainingDensity = [colors.surface, '#1E3B2A', '#2C6A46', '#469D67', colors.green] as const;
