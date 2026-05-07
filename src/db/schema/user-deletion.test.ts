import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const migration = readFileSync("drizzle/0012_curvy_blue_marvel.sql", "utf8");

describe("user deletion hardening migration", () => {
  it("blocks direct user deletion at the database boundary", () => {
    assert.match(migration, /CREATE TRIGGER "prevent_user_delete"/);
    assert.match(
      migration,
      /Users cannot be deleted; deactivate or change status instead\./,
    );
  });

  it("keeps workflow and audit user references instead of nulling history", () => {
    for (const constraintName of [
      "audit_log_actor_user_id_user_id_fk",
      "audit_log_target_user_id_user_id_fk",
      "legal_membership_user_id_user_id_fk",
      "legal_membership_classified_by_user_id_user_id_fk",
      "workflow_subject_user_id_user_id_fk",
      "workflow_created_by_user_id_user_id_fk",
    ]) {
      const line = migration
        .split("\n")
        .find((candidate) => candidate.includes(constraintName));

      assert.ok(line, `Missing ${constraintName}.`);
      assert.match(line, /ON DELETE no action/);
    }
  });

  it("does not create generic workflow side tables or indexes", () => {
    for (const removedName of [
      "workflow_task",
      "workflow_approval",
      "workflow_artifact",
      "workflow_event",
      "one_active_membership_admission_workflow_per_user",
    ]) {
      assert.equal(migration.includes(removedName), false);
    }
  });
});
