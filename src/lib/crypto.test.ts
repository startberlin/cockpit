import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { generateRandomPassword } from "./crypto";

const UPPER = new Set("ABCDEFGHJKLMNPQRSTUVWXYZ");
const LOWER = new Set("abcdefghjkmnpqrstuvwxyz");
const DIGITS = new Set("23456789");
const SPECIAL = new Set("@$!%*#?&");

function hasCharFromSet(password: string, set: Set<string>): boolean {
  return [...password].some((c) => set.has(c));
}

describe("generateRandomPassword", () => {
  it("returns a string of length 15 by default", () => {
    const pwd = generateRandomPassword();
    assert.equal(typeof pwd, "string");
    assert.equal(pwd.length, 15);
  });

  it("contains at least one uppercase letter by default", () => {
    const pwd = generateRandomPassword();
    assert.ok(hasCharFromSet(pwd, UPPER), `No uppercase in: ${pwd}`);
  });

  it("contains at least one lowercase letter by default", () => {
    const pwd = generateRandomPassword();
    assert.ok(hasCharFromSet(pwd, LOWER), `No lowercase in: ${pwd}`);
  });

  it("contains at least one digit by default", () => {
    const pwd = generateRandomPassword();
    assert.ok(hasCharFromSet(pwd, DIGITS), `No digit in: ${pwd}`);
  });

  it("contains at least one special character by default", () => {
    const pwd = generateRandomPassword();
    assert.ok(hasCharFromSet(pwd, SPECIAL), `No special char in: ${pwd}`);
  });

  it("returns a string of length 20 when requested", () => {
    const pwd = generateRandomPassword(20);
    assert.equal(typeof pwd, "string");
    assert.equal(pwd.length, 20);
  });

  it("contains at least one uppercase letter with length 20", () => {
    const pwd = generateRandomPassword(20);
    assert.ok(hasCharFromSet(pwd, UPPER), `No uppercase in: ${pwd}`);
  });

  it("contains at least one lowercase letter with length 20", () => {
    const pwd = generateRandomPassword(20);
    assert.ok(hasCharFromSet(pwd, LOWER), `No lowercase in: ${pwd}`);
  });

  it("contains at least one digit with length 20", () => {
    const pwd = generateRandomPassword(20);
    assert.ok(hasCharFromSet(pwd, DIGITS), `No digit in: ${pwd}`);
  });

  it("contains at least one special character with length 20", () => {
    const pwd = generateRandomPassword(20);
    assert.ok(hasCharFromSet(pwd, SPECIAL), `No special char in: ${pwd}`);
  });

  it("throws for length 0", () => {
    assert.throws(() => generateRandomPassword(0));
  });

  it("throws for length 3", () => {
    assert.throws(() => generateRandomPassword(3));
  });

  it("throws for non-integer length", () => {
    assert.throws(() => generateRandomPassword(5.5));
  });
});
