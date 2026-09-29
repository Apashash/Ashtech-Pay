export function getOperatorDisplayName(name: string | null | undefined): string {
  const label = name?.trim() ?? "";
  return /t[\s_-]?money/i.test(label) ? "Mixx By Yas" : label;
}

export function operatorNamesMatch(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  return getOperatorDisplayName(left).toLowerCase() === getOperatorDisplayName(right).toLowerCase();
}