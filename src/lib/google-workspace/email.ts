import slugify from "slugify";

// Umlaut replacements applied before slugify so its internal NFD normalization
// doesn't decompose ö→o+combining-diaeresis before our pattern can match.
const UMLAUT_MAP: [RegExp, string][] = [
  [/ä/g, "ae"],
  [/ö/g, "oe"],
  [/ü/g, "ue"],
  [/ß/g, "ss"],
  [/æ/g, "ae"],
  [/ø/g, "oe"],
  [/å/g, "aa"],
  [/Ä/g, "Ae"],
  [/Ö/g, "Oe"],
  [/Ü/g, "Ue"],
  [/Æ/g, "Ae"],
  [/Ø/g, "Oe"],
  [/Å/g, "Aa"],
];

function replaceUmlauts(str: string): string {
  let result = str;
  for (const [regex, replacement] of UMLAUT_MAP) {
    result = result.replace(regex, replacement);
  }
  return result;
}

export function generateCompanyEmail(firstName: string, lastName: string) {
  const slugOptions = { lower: true, strict: true } as const;

  const firstSlug = slugify(
    replaceUmlauts(firstName).replace(/\s+/g, "-"),
    slugOptions,
  );
  const lastSlug = slugify(
    replaceUmlauts(lastName).replace(/\s+/g, "-"),
    slugOptions,
  );

  return `${firstSlug}.${lastSlug}@start-berlin.com`;
}
