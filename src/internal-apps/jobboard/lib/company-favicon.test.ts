import assert from "node:assert/strict";
import test from "node:test";
import {
  companyFaviconResponse,
  companyIconHost,
  fetchCompanyIcon,
} from "./company-favicon";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/47cAAAAASUVORK5CYII=",
  "base64",
);
const imageResponse = (body = png, type = "image/png") =>
  new Response(body, { headers: { "Content-Type": type } });

test("only forwards a registrable public domain, including hosted sites", () => {
  assert.equal(
    companyIconHost("https://jobs.www.example.edu/careers?utm_source=private"),
    "example.edu",
  );
  assert.equal(
    companyIconHost("https://team.github.io/jobs"),
    "team.github.io",
  );
  for (const website of [
    "",
    "https://user:pass@example.edu",
    "https://127.0.0.1",
    "https://intranet.local",
    "https://acme.test",
    "https://corp.onion",
    "https://com",
    "https://example.org",
    "https://example.edu:8888",
    "https://10.in-addr.arpa",
  ])
    assert.equal(companyIconHost(website), null, website);
});

test("a typed and bounded PNG is served by the same origin with a content ETag", async () => {
  const icon = await fetchCompanyIcon("example.edu", async (url, init) => {
    assert.equal(url, "https://icon.horse/icon/example.edu/64?fallback=404");
    assert.equal(init?.redirect, "error");
    assert.equal(init?.credentials, "omit");
    assert.deepEqual(init?.headers, { Accept: "image/png" });
    return imageResponse();
  });
  assert.ok(icon);
  const req = new Request("https://cockpit.example/icon");
  const response = await companyFaviconResponse(
    req,
    "https://example.edu",
    async () => icon,
  );
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "image/png");
  assert.deepEqual(Buffer.from(await response.arrayBuffer()), png);
  assert.equal(
    (
      await companyFaviconResponse(
        new Request(req, { headers: { "if-none-match": `W/${icon.etag}` } }),
        "https://example.edu",
        async () => icon,
      )
    ).status,
    304,
  );
});

test("missing, mislabeled, oversized and provider fallback images stay local misses", async () => {
  const oversizedDimensions = Buffer.from(png);
  oversizedDimensions.writeUInt32BE(5000, 16);
  for (const response of [
    new Response(null, { status: 404 }),
    imageResponse(png, "text/html"),
    imageResponse(Buffer.from("<svg/>")),
    imageResponse(Buffer.alloc(65537)),
    imageResponse(oversizedDimensions),
    new Response(png, {
      headers: { "content-type": "image/png", "x-icon-fallback": "true" },
    }),
  ])
    assert.equal(
      await fetchCompanyIcon("example.edu", async () => response),
      null,
    );
  const badHost = await companyFaviconResponse(
    new Request("https://cockpit.example/icon"),
    "https://acme.internal",
    async () => assert.fail("no provider call"),
  );
  assert.equal(badHost.status, 404);
  const outage = await companyFaviconResponse(
    new Request("https://cockpit.example/icon"),
    "https://example.edu",
    async () => {
      throw Error("provider unavailable");
    },
  );
  assert.equal(outage.status, 404);
});
