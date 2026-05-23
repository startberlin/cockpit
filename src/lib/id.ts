import { customAlphabet } from "nanoid";
export const nanoid = customAlphabet(
  "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz",
);

export const prefixes = {
  user: "usr",
  group: "gr",
  legalMembership: "lm",
  membershipApplication: "ma",
  membershipPaymentCycle: "mc",
  membershipTransitionRequest: "mtr",
  auditLog: "aud",
} as const;

export function isPrefixedId(value: string): boolean {
  return Object.values(prefixes).some((p) => value.startsWith(`${p}_`));
}

export function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function newId(prefix: keyof typeof prefixes): string {
  return [prefixes[prefix], nanoid(16)].join("_");
}
