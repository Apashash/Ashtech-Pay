export interface PawaPayDisplayInstruction {
  text?: string;
  template?: string;
}

/**
 * PawaPay may return the same USSD channel more than once.
 * Keep each visible instruction only once while preserving its order.
 */
export function getPawaPayPinInstructions(auth: any): PawaPayDisplayInstruction[] {
  const instructions = auth?.pinPromptInstructions?.channels?.flatMap((channel: any) =>
    channel.instructions?.fr || channel.instructions?.en || []
  ) || [];
  const seen = new Set<string>();

  return instructions.filter((instruction: PawaPayDisplayInstruction) => {
    const label = String(instruction.text || instruction.template || "")
      .normalize("NFKC")
      .replace(/[\u200B-\u200D\uFEFF]/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!label) return false;
    const key = label.toLocaleLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}