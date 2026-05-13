import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accessGrants,
  activeAuthorityStatuses,
  departmentHeadPosition,
  globalAccessGrants,
  globalOrganizationPositions,
  organizationPositions,
} from "./model";

describe("authority domain model", () => {
  it("defines the supported organization positions from scoped groups", () => {
    assert.deepEqual(globalOrganizationPositions, [
      "president",
      "vice_president",
      "head_of_finance",
    ]);
    assert.equal(departmentHeadPosition, "department_head");
    assert.deepEqual(organizationPositions, [
      "president",
      "vice_president",
      "head_of_finance",
      "department_head",
    ]);
  });

  it("defines admin as a global access grant", () => {
    assert.deepEqual(globalAccessGrants, ["admin", "finance_admin"]);
    assert.deepEqual(accessGrants, ["admin", "finance_admin"]);
  });

  it("keeps ordinary authority active only for members by default", () => {
    assert.deepEqual(activeAuthorityStatuses, ["member"]);
  });
});
