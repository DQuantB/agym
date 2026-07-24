export function pickInstructionText(instructions: Record<string, string>, preferredLanguage = 'en'): string | null {
  const preferred = instructions[preferredLanguage]?.trim();
  if (preferred) return preferred;
  const firstAvailable = Object.values(instructions).find((value) => value?.trim());
  return firstAvailable?.trim() ?? null;
}
