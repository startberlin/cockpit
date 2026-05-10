import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getWorkspaceNameUpdate } from "./sync-google-workspace-user-name-helper";

describe("getWorkspaceNameUpdate", () => {
  it("returns null when local and Workspace names already match", () => {
    assert.equal(
      getWorkspaceNameUpdate(
        { firstName: "Peter", lastName: "Partnerships" },
        { givenName: "Peter", familyName: "Partnerships" },
      ),
      null,
    );
  });

  it("returns local names when the Workspace first name differs", () => {
    assert.deepEqual(
      getWorkspaceNameUpdate(
        { firstName: "Peter", lastName: "Partnerships" },
        { givenName: "Pater", familyName: "Partnerships" },
      ),
      { givenName: "Peter", familyName: "Partnerships" },
    );
  });

  it("returns local names when the Workspace last name differs", () => {
    assert.deepEqual(
      getWorkspaceNameUpdate(
        { firstName: "Ada", lastName: "Lovelace" },
        { givenName: "Ada", familyName: "Byron" },
      ),
      { givenName: "Ada", familyName: "Lovelace" },
    );
  });
});
