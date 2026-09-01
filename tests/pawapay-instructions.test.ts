import test from "node:test";
import assert from "node:assert/strict";
import { getPawaPayPinInstructions } from "../client/src/lib/pawapay-instructions";

test("deduplicates visually identical PawaPay PIN instructions", () => {
  const instructions = getPawaPayPinInstructions({
    pinPromptInstructions: {
      channels: [
        {
          instructions: {
            fr: [
              { text: "Composez *126#" },
              { text: "Entrez le code PIN" },
            ],
          },
        },
        {
          instructions: {
            fr: [
              { text: " Composez\u00a0*126#\u200b" },
              { text: "Entrez  le   code PIN" },
            ],
          },
        },
      ],
    },
  });

  assert.deepEqual(
    instructions.map((instruction) => instruction.text),
    ["Composez *126#", "Entrez le code PIN"],
  );
});