import type { UncertaintyFlag } from '../domain/types';
export function UncertaintyBadge({ flags }: { flags: UncertaintyFlag[] }) { if (!flags.length) return null; return <span className="badge">⚑ {flags.length} uncertain</span>; }
