/**
 * GCash transaction reference numbers are thirteen digits. They are unique
 * per real transaction, which makes them the primary defence against a
 * student reusing a friend's receipt screenshot: the database holds a unique
 * index on the normalised value.
 *
 * This does not catch a forged screenshot carrying an invented number. That
 * is what admin review is for.
 */
const REFERENCE_DIGITS = 13;

/** Removes the spaces, dashes, and labels students paste in with the number. */
export function normalizeGcashReference(input: string): string {
  return input.replace(/\D/g, "");
}

export function isValidGcashReference(input: string): boolean {
  return normalizeGcashReference(input).length === REFERENCE_DIGITS;
}

/**
 * Picks the reference number out of text read off a receipt image, or null
 * when it can't tell. Only ever a suggestion — checkout fills the field with
 * it and the student confirms it against their receipt.
 *
 * A number on a "Ref No." line wins. Without one, a lone thirteen-digit
 * number is taken; several unlabelled ones return null, since filling in the
 * wrong one is worse than leaving the field for the student to type. The
 * receipt's phone number (+63 9xx xxx xxxx) is twelve digits, so it never
 * qualifies.
 */
export function findGcashReference(text: string): string | null {
  const lines = text.split(/\r?\n/);
  const labelled: string[] = [];
  const unlabelled = new Set<string>();

  lines.forEach((line, index) => {
    // The label can wrap onto the line above the number on a narrow screen.
    const nearLabel = /ref/i.test(line) || /ref/i.test(lines[index - 1] ?? "");
    for (const run of line.match(/\d[\d ]*\d/g) ?? []) {
      const reference = thirteenDigitsIn(run.split(/ +/));
      if (!reference) continue;
      if (nearLabel) labelled.push(reference);
      else unlabelled.add(reference);
    }
  });

  if (labelled.length > 0) return labelled[0];
  return unlabelled.size === 1 ? [...unlabelled][0] : null;
}

/**
 * The first run of neighbouring digit groups that joins to exactly thirteen
 * digits — covers "5045 014 788131" as well as a clean number that OCR ran
 * into the date beside it ("5045014788131 13 2026").
 */
function thirteenDigitsIn(groups: string[]): string | null {
  for (let start = 0; start < groups.length; start++) {
    let joined = "";
    for (let end = start; end < groups.length; end++) {
      joined += groups[end];
      if (joined.length === REFERENCE_DIGITS) return joined;
      if (joined.length > REFERENCE_DIGITS) break;
    }
  }
  return null;
}
