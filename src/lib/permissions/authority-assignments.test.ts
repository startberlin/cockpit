import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { authorityUpdateInputSchema } from "./authority-assignments";

describe("authority assignment validation", () => {
  it("accepts valid global positions, department positions, and grants", () => {
    const result = authorityUpdateInputSchema.safeParse({
      userId: "usr_test",
      positions: [
        { position: "president", scope: "global" },
        { position: "vice_president", scope: "global" },
        { position: "head_of_finance", scope: "global" },
        {
          position: "department_head",
          scope: "department",
          department: "events",
        },
      ],
      grants: [{ grant: "admin", scope: "global" }],
    });

    assert.equal(result.success, true);
    assert.deepEqual(result.data, {
      userId: "usr_test",
      positions: [
        { position: "president", scope: "global", department: null },
        { position: "vice_president", scope: "global", department: null },
        { position: "head_of_finance", scope: "global", department: null },
        {
          position: "department_head",
          scope: "department",
          department: "events",
        },
      ],
      grants: [{ grant: "admin", scope: "global", department: null }],
    });
  });

  it("rejects invalid position scopes", () => {
    assert.equal(
      authorityUpdateInputSchema.safeParse({
        userId: "usr_test",
        positions: [
          { position: "president", scope: "department", department: "events" },
        ],
        grants: [],
      }).success,
      false,
    );

    assert.equal(
      authorityUpdateInputSchema.safeParse({
        userId: "usr_test",
        positions: [{ position: "department_head", scope: "global" }],
        grants: [],
      }).success,
      false,
    );
  });

  it("rejects invalid grant scopes", () => {
    assert.equal(
      authorityUpdateInputSchema.safeParse({
        userId: "usr_test",
        positions: [],
        grants: [{ grant: "admin", scope: "department", department: "events" }],
      }).success,
      false,
    );
  });

  it("rejects department assignments without departments", () => {
    assert.equal(
      authorityUpdateInputSchema.safeParse({
        userId: "usr_test",
        positions: [{ position: "department_head", scope: "department" }],
        grants: [],
      }).success,
      false,
    );
  });

  it("rejects duplicate assignments in one payload", () => {
    assert.equal(
      authorityUpdateInputSchema.safeParse({
        userId: "usr_test",
        positions: [
          { position: "president", scope: "global" },
          { position: "president", scope: "global" },
        ],
        grants: [],
      }).success,
      false,
    );

    assert.equal(
      authorityUpdateInputSchema.safeParse({
        userId: "usr_test",
        positions: [],
        grants: [
          { grant: "admin", scope: "global" },
          { grant: "admin", scope: "global" },
        ],
      }).success,
      false,
    );
  });
});
