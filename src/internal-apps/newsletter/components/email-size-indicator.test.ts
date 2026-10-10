import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TooltipProvider } from "@/components/ui/tooltip";
import { EmailSizeIndicator, EmailSizeWarning } from "./email-size-indicator";

function renderSize(htmlBytes: number | null, isRendering = false): string {
  return renderToStaticMarkup(
    createElement(TooltipProvider, {
      // biome-ignore lint/correctness/noChildrenProp: TooltipProvider requires children in its createElement props type.
      children: createElement(EmailSizeIndicator, { htmlBytes, isRendering }),
    }),
  );
}

function renderWarning(htmlBytes: number | null, isRendering = false): string {
  return renderToStaticMarkup(
    createElement(EmailSizeWarning, { htmlBytes, isRendering }),
  );
}

describe("exact HTML size display", () => {
  it("shows decimal KB with the exact UTF-8 byte count and measurement limits", () => {
    const html = renderSize(34_201);
    assert.match(html, /HTML · 34\.201 KB/);
    assert.match(html, /34,201 bytes of UTF-8 HTML/);
    assert.match(html, /1 KB = 1,000 bytes/);
    assert.match(html, /External image file bytes are excluded/);
    assert.match(html, /image URLs and markup are included/);
    assert.match(
      html,
      /Provider tracking links and recipient merge tags can change/,
    );
  });

  it("does not present an older measurement while a new preview renders", () => {
    const html = renderSize(120_000, true);
    assert.match(html, /Measuring HTML/);
    assert.doesNotMatch(html, /120\.0 KB/);
    assert.equal(renderWarning(120_000, true), "");
  });

  it("shows unavailable status for a failed or missing measurement", () => {
    assert.match(renderSize(null), /HTML size unavailable/);
    assert.match(renderSize(Number.NaN), /HTML size unavailable/);
    assert.match(renderSize(-1), /HTML size unavailable/);
    assert.equal(renderWarning(null), "");
  });

  it("warns at 100,000 measured bytes without claiming a delivery cutoff", () => {
    assert.equal(renderWarning(99_999), "");
    const html = renderWarning(100_000);
    assert.match(html, /Large email HTML/);
    assert.match(html, /role="status"/);
    assert.match(html, /aria-live="polite"/);
    assert.match(html, /delivered size can differ/);
    assert.doesNotMatch(html, /Gmail (?:clips at 100 KB|will clip)/);
    assert.match(renderSize(99_999), /HTML · 99\.999 KB/);
  });
});
