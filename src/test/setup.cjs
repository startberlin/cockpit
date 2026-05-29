/**
 * Test preload: stub Next.js-specific modules that throw outside the Next.js
 * runtime so that unit tests can import server-side modules freely.
 */
const Module = require("node:module");
const originalLoad = Module._load;

Module._load = function (request, ...args) {
  if (request === "server-only") return {};
  return originalLoad.call(this, request, ...args);
};
