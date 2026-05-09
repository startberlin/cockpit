import assert from "node:assert/strict";
import { describe, it, mock } from "node:test";

describe("listAllWorkspaceUsers", () => {
  it("returns candidates from a single-page response", async () => {
    const mockUser = {
      id: "gws-1",
      primaryEmail: "ada@example.com",
      name: { givenName: "Ada", familyName: "Lovelace", fullName: "Ada Lovelace" },
      suspended: false,
    };

    mock.module("googleapis", {
      namedExports: {
        google: {
          admin: () => ({
            users: {
              list: async () => ({
                data: { users: [mockUser], nextPageToken: undefined },
              }),
            },
          }),
        },
      },
    });

    const { listAllWorkspaceUsers } = await import("./directory");
    const result = await listAllWorkspaceUsers();

    assert.equal(result.length, 1);
    assert.equal(result[0].id, "gws-1");
    assert.equal(result[0].primaryEmail, "ada@example.com");
    assert.equal(result[0].givenName, "Ada");
    assert.equal(result[0].familyName, "Lovelace");
    assert.equal(result[0].suspended, false);
  });

  it("collects candidates across multiple pages via nextPageToken", async () => {
    const page1User = {
      id: "gws-1",
      primaryEmail: "ada@example.com",
      name: { givenName: "Ada", familyName: "Lovelace", fullName: "Ada Lovelace" },
      suspended: false,
    };
    const page2User = {
      id: "gws-2",
      primaryEmail: "grace@example.com",
      name: { givenName: "Grace", familyName: "Hopper", fullName: "Grace Hopper" },
      suspended: false,
    };

    let callCount = 0;
    mock.module("googleapis", {
      namedExports: {
        google: {
          admin: () => ({
            users: {
              list: async ({ pageToken }: { pageToken?: string }) => {
                callCount++;
                if (!pageToken) {
                  return { data: { users: [page1User], nextPageToken: "token-page2" } };
                }
                return { data: { users: [page2User], nextPageToken: undefined } };
              },
            },
          }),
        },
      },
    });

    const { listAllWorkspaceUsers } = await import("./directory");
    const result = await listAllWorkspaceUsers();

    assert.equal(result.length, 2);
    assert.equal(callCount, 2);
    assert.equal(result[0].id, "gws-1");
    assert.equal(result[1].id, "gws-2");
  });

  it("returns an empty array when the domain has no users", async () => {
    mock.module("googleapis", {
      namedExports: {
        google: {
          admin: () => ({
            users: {
              list: async () => ({ data: { users: undefined, nextPageToken: undefined } }),
            },
          }),
        },
      },
    });

    const { listAllWorkspaceUsers } = await import("./directory");
    const result = await listAllWorkspaceUsers();

    assert.deepEqual(result, []);
  });

  it("propagates transient Google API errors without swallowing them", async () => {
    mock.module("googleapis", {
      namedExports: {
        google: {
          admin: () => ({
            users: {
              list: async () => { throw new Error("quota exceeded"); },
            },
          }),
        },
      },
    });

    const { listAllWorkspaceUsers } = await import("./directory");
    await assert.rejects(listAllWorkspaceUsers, /quota exceeded/);
  });
});
