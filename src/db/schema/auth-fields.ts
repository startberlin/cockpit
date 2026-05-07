import type { user } from "./auth";

type UserFieldName = keyof typeof user.$inferSelect;
type BetterAuthFieldType = "string";

export const serverOwnedAuthUserFields = [
  ["firstName", "string"],
  ["lastName", "string"],
  ["street", "string"],
  ["city", "string"],
  ["state", "string"],
  ["zip", "string"],
  ["country", "string"],
  ["phone", "string"],
  ["personalEmail", "string"],
  ["status", "string"],
] as const satisfies readonly (readonly [UserFieldName, BetterAuthFieldType])[];

type ServerOwnedAuthUserField = (typeof serverOwnedAuthUserFields)[number][0];

export const betterAuthUserAdditionalFields = Object.fromEntries(
  serverOwnedAuthUserFields.map(([name, type]) => [
    name,
    {
      type,
      input: false,
    },
  ]),
) as {
  [K in ServerOwnedAuthUserField]: {
    type: Extract<
      (typeof serverOwnedAuthUserFields)[number],
      readonly [K, BetterAuthFieldType]
    >[1];
    input: false;
  };
};
