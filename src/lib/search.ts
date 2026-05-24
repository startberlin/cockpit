import { or, type SQL, type SQLWrapper, sql } from "drizzle-orm";

// Replaces German umlaut digraphs (oe→ö, ae→ä, ue→ü) to generate an
// alternative search term so "Soeren" matches "Sören" via unaccent.
function expandDigraphsToUmlauts(s: string): string {
  return s.replace(/ae|oe|ue/gi, (match) => {
    const umlaut = { ae: "ä", oe: "ö", ue: "ü" }[
      match.toLowerCase() as "ae" | "oe" | "ue"
    ]!;
    return match[0] === match[0].toUpperCase() ? umlaut.toUpperCase() : umlaut;
  });
}

function buildSearchTerms(query: string): string[] {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const expanded = expandDigraphsToUmlauts(trimmed);
  return trimmed === expanded ? [trimmed] : [trimmed, expanded];
}

/**
 * Builds a search condition using PostgreSQL's unaccent extension so that
 * diacritics and German umlaut digraphs are handled transparently:
 *
 *   "Alvaro"  matches "Álvaro"  (unaccent strips accents on both sides)
 *   "Soren"   matches "Sören"   (unaccent strips the umlaut)
 *   "Soeren"  matches "Sören"   (digraph expansion + unaccent)
 */
export function unaccentSearch(
  query: string,
  ...columns: SQLWrapper[]
): SQL | undefined {
  const terms = buildSearchTerms(query);
  if (terms.length === 0 || columns.length === 0) return undefined;

  const termClauses = terms.map((term) => {
    const pattern = `%${term}%`;
    const colClauses = columns.map(
      (col) => sql`unaccent(${col}) ilike unaccent(${pattern})`,
    );
    return colClauses.length === 1 ? colClauses[0] : or(...colClauses);
  });

  return termClauses.length === 1
    ? termClauses[0]
    : or(...(termClauses as SQL[]));
}
