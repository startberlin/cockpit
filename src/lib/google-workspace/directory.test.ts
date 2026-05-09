import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collectAllPages, type PageFetcher } from "./directory-helpers";

type StubCandidate = { id: string; email: string };

const makeUser = (id: string, email: string) => ({
  id,
  primaryEmail: email,
  name: { givenName: "Ada", familyName: "Lovelace", fullName: "Ada Lovelace" },
  suspended: false,
});

const toStubCandidate = (user: {
  id?: string | null;
  primaryEmail?: string | null;
}): StubCandidate | null => {
  if (!user.id || !user.primaryEmail) return null;
  return { id: user.id, email: user.primaryEmail };
};

describe("collectAllPages", () => {
  it("returns items from a single-page response with no nextPageToken", async () => {
    const fetcher: PageFetcher = async () => ({
      users: [makeUser("gws-1", "ada@example.com")],
      nextPageToken: null,
    });

    const result = await collectAllPages(fetcher, toStubCandidate);

    assert.equal(result.length, 1);
    assert.equal(result[0].id, "gws-1");
    assert.equal(result[0].email, "ada@example.com");
  });

  it("accumulates items across two pages via nextPageToken", async () => {
    let callCount = 0;
    const fetcher: PageFetcher = async (pageToken) => {
      callCount++;
      if (!pageToken) {
        return {
          users: [makeUser("gws-1", "ada@example.com")],
          nextPageToken: "token-page2",
        };
      }
      return {
        users: [makeUser("gws-2", "grace@example.com")],
        nextPageToken: null,
      };
    };

    const result = await collectAllPages(fetcher, toStubCandidate);

    assert.equal(callCount, 2);
    assert.equal(result.length, 2);
    assert.equal(result[0].id, "gws-1");
    assert.equal(result[1].id, "gws-2");
  });

  it("returns an empty array when the domain has no users", async () => {
    const fetcher: PageFetcher = async () => ({
      users: undefined,
      nextPageToken: null,
    });

    const result = await collectAllPages(fetcher, toStubCandidate);

    assert.deepEqual(result, []);
  });

  it("propagates transient errors without swallowing them", async () => {
    const fetcher: PageFetcher = async () => {
      throw new Error("quota exceeded");
    };

    await assert.rejects(() => collectAllPages(fetcher, toStubCandidate), /quota exceeded/);
  });

  it("skips users that the candidate mapper returns null for", async () => {
    const fetcher: PageFetcher = async () => ({
      users: [
        { name: { givenName: "No", familyName: "Id" }, suspended: false },
        makeUser("gws-1", "ada@example.com"),
      ],
      nextPageToken: null,
    });

    const result = await collectAllPages(fetcher, toStubCandidate);

    assert.equal(result.length, 1);
    assert.equal(result[0].id, "gws-1");
  });
});
