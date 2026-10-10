import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { it } from "node:test";

it("resolves first-name tags with and without a fallback in test emails", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
      import assert from "node:assert/strict";
      import { createRequire } from "node:module";
      const require = createRequire(import.meta.url);
      const Module = require("node:module");
      const originalLoad = Module._load;
      Module._load = function (request, parent, ...rest) {
        if (request === "server-only") return {};
        return originalLoad.call(this, request, parent, ...rest);
      };
      const { substituteMergeTags } = require("./src/internal-apps/newsletter/lib/render.ts");
      const input = "Hallo {{{contact.first_name}}}, {{{contact.first_name|there}}}, {{{contact.first_name|friend}}}. {{{RESEND_UNSUBSCRIBE_URL}}} {{{contact.last_name}}}";
      assert.equal(
        substituteMergeTags(input, { firstName: "$& Jörg", unsubscribeUrl: "https://example.com/newsletter" }),
        "Hallo $& Jörg, $& Jörg, $& Jörg. https://example.com/newsletter {{{contact.last_name}}}",
      );
    `,
    ],
    {
      encoding: "utf8",
      env: { ...process.env, NEXT_PUBLIC_COCKPIT_URL: "http://localhost:3000" },
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

it("measures the exact rendered UTF-8 HTML, including Unicode and the 100,000-byte boundary", () => {
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "tsx",
      "--input-type=module",
      "-e",
      `
      import assert from "node:assert/strict";
      import { createRequire } from "node:module";
      const require = createRequire(import.meta.url);
      const Module = require("node:module");
      const originalLoad = Module._load;
      Module._load = function (request, parent, ...rest) {
        if (request === "server-only") return {};
        return originalLoad.call(this, request, parent, ...rest);
      };
      let requests = 0;
      globalThis.fetch = async () => { requests++; throw new Error("Unexpected network request"); };
      const api = require("./src/internal-apps/newsletter/lib/render.ts");
      const makeText = (text) => ({ id: "text", kind: "text", body: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text }] }] } });
      const input = (blocks) => ({ subject: "Size check", previewText: "Rendered HTML bytes", blocks });
      const unicode = "Größe für Zürich 😀";
      const unicodeResult = await api.renderIssue(input([makeText(unicode)]));
      assert.match(unicodeResult.html, /Größe für Zürich 😀/);
      assert.equal(unicodeResult.htmlBytes, new TextEncoder().encode(unicodeResult.html).length);
      assert.equal(unicodeResult.htmlBytes, Buffer.byteLength(unicodeResult.html, "utf8"));
      assert.notEqual(unicodeResult.htmlBytes, unicodeResult.html.length);
      const asciiResult = await api.renderIssue(input([makeText("x".repeat(unicode.length))]));
      assert.equal(unicodeResult.htmlBytes - asciiResult.htmlBytes, Buffer.byteLength(unicode, "utf8") - unicode.length);
      assert.ok(unicodeResult.htmlBytes > Buffer.byteLength(unicode, "utf8"));

      const baseline = await api.renderIssue(input([makeText("")]));
      assert.ok(baseline.htmlBytes < 100000);
      for (const target of [99999, 100000, 100001]) {
        const rendered = await api.renderIssue(input([makeText("x".repeat(target - baseline.htmlBytes))]));
        assert.equal(rendered.htmlBytes, target);
        assert.equal(rendered.htmlBytes, new TextEncoder().encode(rendered.html).length);
      }

      const shortUrl = "https://example.com/image.png";
      const longUrl = "https://example.com/" + "x".repeat(1200) + "/image.png";
      const image = (url) => ({ id: "image", kind: "image", image: { url, alt: "Image", width: 1200, height: 600 }, caption: "", href: "" });
      const shortImage = await api.renderIssue(input([image(shortUrl)]));
      const longImage = await api.renderIssue(input([image(longUrl)]));
      const occurrences = shortImage.html.split(shortUrl).length - 1;
      assert.ok(occurrences > 0);
      assert.equal(longImage.htmlBytes - shortImage.htmlBytes, occurrences * (Buffer.byteLength(longUrl, "utf8") - Buffer.byteLength(shortUrl, "utf8")));
      assert.ok(shortImage.htmlBytes < 100000);
      const escaped = await api.renderIssue(input([{ id: "link", kind: "button", label: "Read more", href: "https://example.com/?a=one&b=two" }]));
      assert.match(escaped.html, /a=one&amp;b=two/);
      assert.equal(escaped.htmlBytes, new TextEncoder().encode(escaped.html).length);
      assert.match(escaped.html, /RESEND_UNSUBSCRIBE_URL/);
      assert.equal(requests, 0);
    `,
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        NEXT_PUBLIC_COCKPIT_URL: "http://localhost:3000",
      },
    },
  );
  assert.equal(result.status, 0, result.stderr || result.stdout);
});
