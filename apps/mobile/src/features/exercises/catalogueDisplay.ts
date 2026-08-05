export function pickInstructionText(instructions: Record<string, string>, preferredLanguage = 'en'): string | null {
  const preferred = instructions[preferredLanguage]?.trim();
  if (preferred) return preferred;
  const firstAvailable = Object.values(instructions).find((value) => value?.trim());
  return firstAvailable?.trim() ?? null;
}

export function formatCatalogueCount(loaded: number, total: number): string {
  if (total === 0) return 'No matching exercises. You can still add one manually.';
  if (loaded < total) return `${loaded} of ${total} exercises`;
  return `${total} exercise${total === 1 ? '' : 's'}`;
}
