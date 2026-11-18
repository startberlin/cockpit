import assert from "node:assert/strict";
import test from "node:test";
import {
  isServiceScopeConfigured,
  serviceKeyStatus,
  verifyServiceAuthorization,
} from "./service-auth";

const keys = {
  read: "r".repeat(40),
  submit: "s".repeat(40),
  metrics: "m".repeat(40),
};

test("reports the optional intake key independently from website collection", () => {
  assert.equal(serviceKeyStatus("metrics", {}), "missing");
  assert.equal(serviceKeyStatus("metrics", { metrics: "" }), "missing");
  assert.equal(serviceKeyStatus("metrics", keys), "configured");
  for (const metrics of ["short", " ".repeat(40), keys.read, keys.submit]) {
    const config = { ...keys, metrics };
    assert.equal(serviceKeyStatus("metrics", config), "invalid");
    assert.equal(
      verifyServiceAuthorization(`Bearer ${metrics}`, "metrics", config),
      false,
    );
  }
});

test("configuration readiness uses the same scope boundaries as authentication", () => {
  assert.equal(isServiceScopeConfigured("read", keys), true);
  assert.equal(isServiceScopeConfigured("read", {}), false);
  assert.equal(
    isServiceScopeConfigured("read", { read: "r".repeat(513) }),
    false,
  );
  assert.equal(
    isServiceScopeConfigured("read", { ...keys, read: ` ${keys.read}` }),
    false,
  );
  const shared = { ...keys, metrics: keys.read };
  assert.equal(isServiceScopeConfigured("read", shared), false);
  assert.equal(isServiceScopeConfigured("metrics", shared), false);
  assert.equal(isServiceScopeConfigured("submit", shared), true);
});

test("service credentials grant only their own scope", () => {
  for (const scope of ["read", "submit", "metrics"] as const) {
    assert.equal(
      verifyServiceAuthorization(`Bearer ${keys[scope]}`, scope, keys),
      true,
    );
    for (const other of ["read", "submit", "metrics"] as const) {
      if (other !== scope)
        assert.equal(
          verifyServiceAuthorization(`Bearer ${keys[other]}`, scope, keys),
          false,
        );
    }
  }
});

test("service authentication fails closed for missing, weak, duplicated or malformed keys", () => {
  assert.equal(verifyServiceAuthorization(null, "read", keys), false);
  assert.equal(
    verifyServiceAuthorization(`Bearer ${keys.read}`, "read", {}),
    false,
  );
  assert.equal(
    verifyServiceAuthorization("Bearer short", "read", { read: "short" }),
    false,
  );
  assert.equal(
    verifyServiceAuthorization(`Bearer ${keys.read}`, "read", {
      read: keys.read,
      metrics: keys.read,
    }),
    false,
  );
  assert.equal(
    verifyServiceAuthorization(`Basic ${keys.read}`, "read", keys),
    false,
  );
  assert.equal(
    verifyServiceAuthorization(`Bearer ${keys.read} extra`, "read", keys),
    false,
  );
  assert.equal(
    verifyServiceAuthorization(`Bearer ${"r".repeat(513)}`, "read", keys),
    false,
  );
  assert.equal(
    verifyServiceAuthorization(`Bearer ${keys.read.slice(1)}`, "read", keys),
    false,
  );
  assert.equal(
    verifyServiceAuthorization(`Bearer ${keys.read}`, "read", {
      ...keys,
      read: "n".repeat(40),
    }),
    false,
  );
});
