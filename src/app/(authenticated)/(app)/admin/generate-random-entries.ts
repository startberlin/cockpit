import type { BulkCreateEntry } from "./bulk-create-user-schema";

const FIRST_NAMES = [
  "Maja",
  "Jonas",
  "Lina",
  "Felix",
  "Sara",
  "Lukas",
  "Mila",
  "Noah",
  "Hannah",
  "Leon",
  "Emma",
  "Paul",
  "Marie",
  "Elias",
  "Sophie",
  "Finn",
  "Clara",
  "Ben",
  "Lea",
  "Tom",
  "Anouk",
  "Mats",
  "Pia",
  "Hugo",
  "Frida",
  "Oskar",
  "Greta",
  "Theo",
  "Nora",
  "Karl",
  "Yara",
  "Aaron",
  "Romy",
  "Levi",
  "Selma",
];

const LAST_NAMES = [
  "Schmidt",
  "Müller",
  "Weber",
  "Becker",
  "Wagner",
  "Schulz",
  "Hoffmann",
  "Schäfer",
  "Koch",
  "Bauer",
  "Richter",
  "Klein",
  "Wolf",
  "Schröder",
  "Neumann",
  "Lindqvist",
  "van der Berg",
  "Kowalski",
  "Rossi",
  "Andersen",
  "Novak",
  "Dubois",
  "Fischer",
  "Vogel",
  "Krause",
];

const EMAIL_DOMAIN = "test.local";

function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function randomSuffix() {
  return Math.random().toString(36).slice(2, 7);
}

export function generateRandomEntries(count: number): BulkCreateEntry[] {
  const entries: BulkCreateEntry[] = [];
  for (let i = 0; i < count; i++) {
    const firstName = pick(FIRST_NAMES);
    const lastName = pick(LAST_NAMES);
    const personalEmail = `${slug(firstName)}.${slug(lastName)}.${randomSuffix()}@${EMAIL_DOMAIN}`;
    entries.push({ firstName, lastName, personalEmail });
  }
  return entries;
}
