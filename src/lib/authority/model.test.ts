import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  accessGrants,
  activeAuthorityStatuses,
  departmentCoLeadPosition,
  departmentHeadPosition,
  departmentLeadPositions,
  globalAccessGrants,
  globalOrganizationPositions,
  isDepartmentLeadPosition,
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
    assert.equal(departmentCoLeadPosition, "department_co_lead");
    assert.deepEqual(departmentLeadPositions, [
      "department_head",
      "department_co_lead",
    ]);
    assert.deepEqual(organizationPositions, [
      "president",
      "vice_president",
      "head_of_finance",
      "department_head",
      "department_co_lead",
    ]);
  });

  it("treats both head and co-lead as department-lead positions", () => {
    assert.equal(isDepartmentLeadPosition("department_head"), true);
    assert.equal(isDepartmentLeadPosition("department_co_lead"), true);
    assert.equal(isDepartmentLeadPosition("president"), false);
    assert.equal(isDepartmentLeadPosition("not_a_position"), false);
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
