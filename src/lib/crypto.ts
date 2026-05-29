import { randomInt } from "node:crypto";

export function generateRandomPassword(length = 15) {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "@$!%*#?&";
  const all = upper + lower + digits + special;

  // Guarantee at least one character from each class.
  const required = [
    upper[randomInt(upper.length)],
    lower[randomInt(lower.length)],
    digits[randomInt(digits.length)],
    special[randomInt(special.length)],
  ];

  const rest = Array.from(
    { length: length - required.length },
    () => all[randomInt(all.length)],
  );

  // Fisher-Yates shuffle so the required chars aren't always first.
  const chars = [...required, ...rest];
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  return chars.join("");
}
