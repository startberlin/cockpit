import slugify from "slugify";

// Join multi-part names with hyphens, normalize special chars, lowercase, keep only [a-z0-9.-]
const customReplacements = [
  ["ä", "ae"],
  ["ö", "oe"],
  ["ü", "ue"],
  ["ß", "ss"],
  ["æ", "ae"],
  ["ø", "oe"],
  ["å", "aa"],
  ["Ä", "ae"],
  ["Ö", "oe"],
  ["Ü", "ue"],
  ["Æ", "ae"],
  ["Ø", "oe"],
  ["Å", "aa"],
];

export function generateCompanyEmail(firstName: string, lastName: string) {
  const slugOptions = {
    lower: true,
    strict: true,
    customReplacements,
  } as const;

  const firstSlug = slugify(firstName.replace(/\s+/g, "-"), slugOptions);
  const lastSlug = slugify(lastName.replace(/\s+/g, "-"), slugOptions);

  return `${firstSlug}.${lastSlug}@start-berlin.com`;
}
