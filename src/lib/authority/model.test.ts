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
    assert.deepEqual(globalAccessGrants, [
      "super_admin",
      "admin",
      "finance_admin",
      "people_admin",
      "members_group_exporter",
    ]);
    assert.deepEqual(accessGrants, [
      "super_admin",
      "admin",
      "finance_admin",
      "people_admin",
      "members_group_exporter",
    ]);
  });

  it("keeps ordinary authority active for members and supporting alumni", () => {
    assert.deepEqual(activeAuthorityStatuses, ["member", "supporting_alumni"]);
  });
});
