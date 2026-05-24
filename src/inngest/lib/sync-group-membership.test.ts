import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { syncGroupMembership } from "./sync-group-membership";

function makeDeps(currentMembers: string[] = []) {
  const calls = {
    added: [] as string[],
    removed: [] as string[],
    created: [] as string[],
  };

  const deps = {
    listGroupMemberEmails: async (_group: string) => currentMembers,
    addGroupMember: async (_group: string, email: string) => {
      calls.added.push(email);
    },
    removeGroupMember: async (_group: string, email: string) => {
      calls.removed.push(email);
    },
    createGoogleGroup: async (prefix: string, _name: string) => {
      calls.created.push(prefix);
      return `${prefix}@start-berlin.com`;
    },
    getGroupName: (prefix: string) => `Group ${prefix}`,
  };

  return { deps, calls };
}

function make404Deps() {
  const calls = {
    added: [] as string[],
    created: [] as string[],
  };

  const error = Object.assign(new Error("not found"), {
    response: { status: 404 },
  });

  const deps = {
    listGroupMemberEmails: async (_group: string): Promise<string[]> => {
      throw error;
    },
    addGroupMember: async (_group: string, email: string) => {
      calls.added.push(email);
    },
    removeGroupMember: async () => {},
    createGoogleGroup: async (prefix: string, _name: string) => {
      calls.created.push(prefix);
      return `${prefix}@start-berlin.com`;
    },
    getGroupName: (prefix: string) => `Group ${prefix}`,
  };

  return { deps, calls };
}

describe("syncGroupMembership", () => {
  it("adds user when shouldBeMember and not currently in group", async () => {
    const { deps, calls } = makeDeps([]);
    await syncGroupMembership(
      "members@start-berlin.com",
      true,
      "user@example.com",
      deps,
    );
    assert.deepEqual(calls.added, ["user@example.com"]);
    assert.deepEqual(calls.removed, []);
  });

  it("removes user when shouldNotBeMember and currently in group", async () => {
    const { deps, calls } = makeDeps(["user@example.com"]);
    await syncGroupMembership(
      "members@start-berlin.com",
      false,
      "user@example.com",
      deps,
    );
    assert.deepEqual(calls.removed, ["user@example.com"]);
    assert.deepEqual(calls.added, []);
  });

  it("no-op when should be member and already in group", async () => {
    const { deps, calls } = makeDeps(["user@example.com"]);
    await syncGroupMembership(
      "members@start-berlin.com",
      true,
      "user@example.com",
      deps,
    );
    assert.deepEqual(calls.added, []);
    assert.deepEqual(calls.removed, []);
  });

  it("no-op when should not be member and not in group", async () => {
    const { deps, calls } = makeDeps([]);
    await syncGroupMembership(
      "members@start-berlin.com",
      false,
      "user@example.com",
      deps,
    );
    assert.deepEqual(calls.added, []);
    assert.deepEqual(calls.removed, []);
  });

  it("treats member emails as already-lowercased (matching listGroupMemberEmails)", async () => {
    // listGroupMemberEmails returns lowercase emails; verify no double-add
    const { deps, calls } = makeDeps(["user@example.com"]);
    await syncGroupMembership(
      "members@start-berlin.com",
      true,
      "user@example.com",
      deps,
    );
    assert.deepEqual(calls.added, []);
  });

  it("creates group on 404 then adds member when shouldBeMember", async () => {
    const { deps, calls } = make404Deps();
    await syncGroupMembership(
      "batch-7@start-berlin.com",
      true,
      "user@example.com",
      deps,
    );
    assert.deepEqual(calls.created, ["batch-7"]);
    assert.deepEqual(calls.added, ["user@example.com"]);
  });

  it("creates group on 404 but does not add when shouldNotBeMember", async () => {
    const { deps, calls } = make404Deps();
    await syncGroupMembership(
      "batch-7@start-berlin.com",
      false,
      "user@example.com",
      deps,
    );
    assert.deepEqual(calls.created, ["batch-7"]);
    assert.deepEqual(calls.added, []);
  });

  it("rethrows non-404 errors", async () => {
    const error = Object.assign(new Error("server error"), {
      response: { status: 500 },
    });
    const deps = {
      listGroupMemberEmails: async () => {
        throw error;
      },
      addGroupMember: async () => {},
      removeGroupMember: async () => {},
      createGoogleGroup: async () => null,
      getGroupName: () => "group",
    };
    await assert.rejects(
      () =>
        syncGroupMembership(
          "members@start-berlin.com",
          true,
          "user@example.com",
          deps,
        ),
      (err: Error) => err === error,
    );
  });
});
