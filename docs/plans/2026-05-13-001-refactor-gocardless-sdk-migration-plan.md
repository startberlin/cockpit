---
title: "refactor: Migrate GoCardless API calls to gocardless-nodejs SDK"
type: refactor
status: completed
date: 2026-05-13
---

# refactor: Migrate GoCardless API calls to gocardless-nodejs SDK

## Summary

Replace the hand-rolled `goCardlessRequest` fetch wrapper with the official `gocardless-nodejs` SDK (v8.1.0). The SDK provides auto-generated TypeScript types for all GoCardless resources and eliminates the need to maintain manual response-shape interfaces, custom error classes, and manual 409 conflict parsing. The migration also introduces business-meaningful idempotency keys for subscription creation anchored to the membership payment row ID, preventing duplicate subscriptions across retries and re-runs. Webhook signature verification is kept as-is — the custom HMAC implementation in `verify-request.ts` is clean and correct.

---

## Problem Frame

`src/lib/gocardless/client.ts` is a hand-rolled `fetch` wrapper. It requires manually defined response types for each endpoint, custom error classes, manual idempotency conflict parsing (parsing the 409 response body to extract the conflicting resource ID), and a `requireGoCardlessConfig()` guard that partially duplicates the env module. The official SDK removes all of this boilerplate. Additionally, the current subscription idempotency key is derived from `userId` and `mandateId` — not the payment row — so a retry from a different session could create a duplicate subscription.

---

## Requirements

- R1. All GoCardless API calls use SDK methods instead of `goCardlessRequest`
- R2. Manual response-shape type interfaces in `membership-flow.ts` are removed in favor of SDK types
- R3. The 409 idempotency conflict catch block and `extractIdempotencyConflictId` helper are removed; SDK default (`raiseOnIdempotencyConflict: false`) returns the existing resource silently
- R4. Custom GoCardless error classes (`GoCardlessConfigurationError`, `GoCardlessRequestError`, `GoCardlessCapabilityError`) and the `GOCARDLESS_API_VERSION` constant are removed from `types.ts`
- R5. Domain types (`MembershipFlowInput`, `MembershipFlowResult`, `BillingRequestState`) are preserved unchanged
- R6. Webhook signature verification behavior is unchanged
- R7. All existing tests pass; tests covering only the removed `extractIdempotencyConflictId` helper are deleted
- R8. Subscription idempotency key is derived from the membership payment row ID and start date (`membership-subscription:<membershipPaymentId>:<startDate|no-date>`), guaranteeing no duplicate subscription per payment record regardless of caller session

---

## Scope Boundaries

- No changes to webhook event parsing logic (`GoCardlessWebhookSchema`, event classifier functions)
- No changes to `src/lib/verify-request.ts` — custom HMAC webhook verification is kept
- No changes to database layer or Inngest workflows
- `src/lib/gocardless/membership-reconciliation.ts` requires a one-line update: the `createMembershipSubscription` return type changes from an envelope object to a plain subscription ID string (see U2)

### Deferred to Follow-Up Work

- Env var cleanup (`GOCARDLESS_BASE_URL`, `GOCARDLESS_MEMBERSHIP_TEMPLATE_ID`): both become unused after the migration and can be removed from `src/env.ts` in a follow-up

---

## Context & Research

### Relevant Code and Patterns

- `src/lib/gocardless/client.ts` — custom fetch wrapper being replaced
- `src/lib/gocardless/membership-flow.ts` — all API calls live here
- `src/lib/gocardless/membership-flow-helpers.ts` — helpers for building request bodies; `extractIdempotencyConflictId` being removed, `subscriptionIdempotencyKey` being added
- `src/lib/gocardless/membership-reconciliation.ts` — sole caller of `createMembershipSubscription`; line 146 accesses `.subscriptions.id` (envelope shape) which must be updated; `getBillingRequestFlow` fallback block already removed
- `src/lib/gocardless/types.ts` — custom error classes and domain types; `BillingRequestFlowState` already removed
- `src/lib/gocardless/webhook.ts` — Zod webhook schema and event classifiers (untouched)
- `src/lib/verify-request.ts` — HMAC webhook signature verification (untouched)
- `src/env.ts` — `GOCARDLESS_API_KEY`, `GOCARDLESS_BASE_URL`

### External References

- [gocardless-nodejs on GitHub](https://github.com/gocardless/gocardless-nodejs) — auto-generated SDK; v8.1.0 is latest (March 2026)
- [npm: gocardless-nodejs](https://www.npmjs.com/package/gocardless-nodejs)
- MIGRATION_V8.md (in the package): only breaking change is metadata values must be strings — already true in this codebase

---

## Key Technical Decisions

- **SDK environment selection**: Use an explicit `GOCARDLESS_ENVIRONMENT` env var (`"sandbox"` | `"live"`, default `"live"`) instead of substring-matching `GOCARDLESS_BASE_URL`. Substring matching on a URL is fragile for a financial API — if the URL ever changes shape, the wrong environment is silently selected. An explicit flag makes intent unambiguous. Add `GOCARDLESS_ENVIRONMENT` to `src/env.ts`; map `"sandbox"` → `Environments.Sandbox`, anything else → `Environments.Live`.

- **Idempotency conflict handling**: Set `raiseOnIdempotencyConflict: false` (the SDK default). On a 409 conflict the SDK returns the original resource, eliminating the manual conflict ID extraction on subscription creation.

- **Idempotency key on `collectCustomerDetails`**: The SDK's action methods do not accept idempotency keys. The current idempotency key (`:customer-details` suffix) is dropped. `collect_customer_details` is naturally idempotent for this flow.

- **Custom subscription idempotency key**: Replace the current `membership-subscription:${userId}:${mandateId}` key with `membership-subscription:${membershipPaymentId}:${startDate ?? "no-date"}`. This key is anchored to the payment row rather than the session, preventing duplicate subscriptions across retries and re-runs. Add a `subscriptionIdempotencyKey(membershipPaymentId, startDate)` helper to `membership-flow-helpers.ts`. The `createMembershipSubscription` function signature changes: replace `localSessionId` parameter with `membershipPaymentId`. The reconciliation caller already passes `localSessionId: payment.id` where `payment.id` is the membership payment ID — renaming the parameter is the only change at the call site.

- **`createMembershipSubscription` return type**: The SDK's `subscriptions.create()` returns a flat `Subscription` object, not the hand-rolled `{ subscriptions: { id, links } }` envelope. Change `createMembershipSubscription` to return the subscription ID string directly. Update `membership-reconciliation.ts` line 146: `(await createMembershipSubscription({...})).subscriptions.id` → `await createMembershipSubscription({...})`.

- **SDK type coercions**: `SubscriptionCreateRequest.amount` and `interval` are typed as `string` in the SDK. Coerce the local constants to strings: `String(MEMBERSHIP_SUBSCRIPTION_AMOUNT)` and `String(1)` (or use string literals directly).

- **`BillingRequestLinks.mandate`**: The SDK's `BillingRequestLinks` type does not include a `mandate` field. The mandate extraction in `getBillingRequest` must use `mandate_request_mandate` (or `mandate_request?.links?.mandate` from the billing request body) — not `links?.mandate`.

- **`collectCustomerDetails` body structure**: The GoCardless API spec separates personal fields (`customer`) from address fields (`customer_billing_detail`). The current code incorrectly bundles them both under `customer`. The migration corrects this. `prefilledCustomerFromMembershipInput` is kept intact for use in `prefilled_customer` on billing request flows (which accepts all fields). A new `billingDetailFromMembershipInput` helper returns address fields for `customer_billing_detail`: `address_line1`, `city`, `region`, `postal_code`, `country_code` — including `region` (mapped from `input.address?.state`).

- **`getBillingRequestFlow` removed**: The reconciliation fallback that called `getBillingRequestFlow` to recover a billing request ID from a flow is dead code — both IDs are always written together by `markMembershipCheckoutStarted`. The function and its `BillingRequestFlowState` return type have been deleted pre-migration. The SDK's `billingRequestFlows` service has no `find` method anyway, so this simplification also eliminates the need for a raw fetch fallback.

- **Webhook verification**: Not migrating to `gocardless-nodejs/webhooks`. The SDK webhook module has a known TypeScript sub-path type issue; the current HMAC implementation in `verify-request.ts` is clean and already well-tested.

- **`requireGoCardlessConfig()`**: This function returns `membershipTemplateId` from env, but `membershipTemplateId` is never used by any callers. It will be removed as dead code.

---

## Open Questions

### Resolved During Planning

- **Does the SDK support idempotency on `create` methods?** Yes — second positional argument on all `create()` methods.
- **Does SDK v8 require metadata value changes?** No — current metadata values are already strings throughout.
- **Can we use `moduleResolution: bundler` with the SDK?** Yes — this is already set in `tsconfig.json`.
- **`billingRequestFlows.find()` availability**: Confirmed absent from the SDK. Moot — `getBillingRequestFlow` has been removed entirely (dead code, pre-migration).

---

## Implementation Units

### U1. Install SDK and replace client factory

**Goal:** Install `gocardless-nodejs`, add the `GOCARDLESS_ENVIRONMENT` env var, and replace `client.ts` with a factory function that returns an initialized SDK client.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `package.json` (add `gocardless-nodejs`)
- Modify: `src/env.ts` (add `GOCARDLESS_ENVIRONMENT`)
- Modify: `src/lib/gocardless/client.ts`

**Approach:**
- Install `gocardless-nodejs` as a production dependency
- Add `GOCARDLESS_ENVIRONMENT` to `src/env.ts` as an optional string field defaulting to `"live"`
- Export a `getGoCardlessClient()` function that constructs and returns a `GoCardlessClient` instance
- Map `GOCARDLESS_ENVIRONMENT === "sandbox"` → `Environments.Sandbox`; otherwise `Environments.Live`
- Use `raiseOnIdempotencyConflict: false` (explicit, documents the intent)
- Remove `goCardlessRequest()` and `requireGoCardlessConfig()` from this file

**Patterns to follow:**
- Other lib singletons (e.g., `src/lib/resend.ts`) for the factory pattern shape

**Test scenarios:**
- Test expectation: none — factory initialization is configuration wiring with no branching logic worth unit testing

**Verification:**
- `client.ts` exports `getGoCardlessClient()` returning a typed `GoCardlessClient`; `goCardlessRequest` and `requireGoCardlessConfig` are gone
- `src/env.ts` exports `GOCARDLESS_ENVIRONMENT`

---

### U2. Migrate billing request and subscription operations

**Goal:** Replace every `goCardlessRequest` call in `membership-flow.ts` with the equivalent SDK method, fix the `collectCustomerDetails` body structure, introduce business-meaningful subscription idempotency keys, and update the reconciliation caller for the new return type.

**Requirements:** R1, R2, R3, R8

**Dependencies:** U1

**Files:**
- Modify: `src/lib/gocardless/membership-flow.ts`
- Modify: `src/lib/gocardless/membership-flow-helpers.ts`
- Modify: `src/lib/gocardless/membership-reconciliation.ts`
- Modify: `src/lib/gocardless/membership-flow.test.ts`

**Approach:**

*Helpers (`membership-flow-helpers.ts`):*
- Add `billingDetailFromMembershipInput(input)` → returns `{ address_line1, city, region, postal_code, country_code }` (all via `stripEmptyValues`). Include `region: input.address?.state` — do not omit it.
- Keep `prefilledCustomerFromMembershipInput` intact — it is still used for `prefilled_customer` on billing request flows (which accepts all customer fields in one object).
- Add `subscriptionIdempotencyKey(membershipPaymentId, startDate)` → returns `membership-subscription:${membershipPaymentId}:${startDate ?? "no-date"}` (max ~60 chars, well under the 128-char limit).
- Remove `extractIdempotencyConflictId` (done in U3, but this unit may leave it present until U3).

*Billing request creation (`createMembershipBillingRequest`):*
- Replace with `client.billingRequests.create(body, idempotencyKey)`

*Customer details collection (`collectMembershipCustomerDetails`):*
- Replace with `client.billingRequests.collectCustomerDetails(id, body)` (no idempotency key — SDK action methods don't accept one)
- Body structure: `{ data: { customer: { given_name, family_name, email, metadata }, customer_billing_detail: billingDetailFromMembershipInput(input) } }`
- Personal fields are picked from `prefilledCustomerFromMembershipInput` result (not a new helper — just pick the three fields)

*Billing request flow creation (`createMembershipBillingRequestFlow`):*
- Replace with `client.billingRequestFlows.create(body, idempotencyKey)`
- Keep using `prefilledCustomerFromMembershipInput(input)` for `prefilled_customer` (all fields, unchanged)

*Billing request fetch (`getBillingRequest`):*
- Replace with `client.billingRequests.find(id)`
- Mandate extraction: use `billingRequest.links?.mandate_request_mandate` — `BillingRequestLinks.mandate` does not exist in SDK types

*Subscription creation (`createMembershipSubscription`):*
- Replace `localSessionId` parameter with `membershipPaymentId`
- Replace `client.subscriptions.create(body, subscriptionIdempotencyKey(membershipPaymentId, startDate))` — remove the 409 catch block entirely
- Coerce `amount` to `String(MEMBERSHIP_SUBSCRIPTION_AMOUNT)` and `interval` to `"1"` (SDK types these as `string`)
- Return the subscription ID string directly: `subscription.id` — not the envelope object
- Remove all inline response-shape interfaces (`BillingRequestResponse`, `CustomerDetailsActionResponse`, `BillingRequestFlowResponse`, `SubscriptionResponse`)

*SDK types:* Import from `gocardless-nodejs/types` where needed.

*Reconciliation caller (`membership-reconciliation.ts`):*
- Line 146: change `(await createMembershipSubscription({...})).subscriptions.id` → `await createMembershipSubscription({...})`
- Rename call parameter: `localSessionId: payment.id` → `membershipPaymentId: payment.id`

*Tests (`membership-flow.test.ts`):*
- Add a test for `billingDetailFromMembershipInput`: verifies address fields are present including `region`
- Update the existing `prefilledCustomerFromMembershipInput` test (currently asserts address fields) to reflect that the helper still returns all fields unchanged
- Add a test for `subscriptionIdempotencyKey`: verifies format with and without `startDate`

**Patterns to follow:**
- `membership-flow-helpers.ts` pattern for extracted helper functions

**Test scenarios:**
- Happy path: `createMembershipFlow` with a full `MembershipFlowInput` resolves to a `MembershipFlowResult` with `hostedUrl` and `billingRequestId`
- Happy path: `createMembershipFlow` skips `collectCustomerDetails` when `existingCustomerId` is set
- Happy path: `createMembershipFlow` uses `existingBillingRequestId` when provided, skipping billing request creation
- Happy path: `getBillingRequest` returns `BillingRequestState` with correct mandate/customer ID extraction (using `mandate_request_mandate`)
- Happy path: `getBillingRequest` returns `mandateId: null` when mandate not yet present
- Happy path: `createMembershipSubscription` returns a subscription ID string (not an envelope object)
- Helper: `billingDetailFromMembershipInput` returns `address_line1`, `city`, `region`, `postal_code`, `country_code`; omits keys with empty values
- Helper: `subscriptionIdempotencyKey("mp_123", "2026-01-01")` → `"membership-subscription:mp_123:2026-01-01"`
- Helper: `subscriptionIdempotencyKey("mp_123", null)` → `"membership-subscription:mp_123:no-date"`
- Integration: `createMembershipSubscription` called with same `membershipPaymentId` and `startDate` twice returns the original subscription ID without error (SDK transparent conflict resolution)

**Verification:**
- All `goCardlessRequest` calls removed from `membership-flow.ts`
- No inline API response interfaces remain except the local `BillingRequestFlowResponse` for the raw-fetch fallback
- TypeScript compiles without errors
- `membership-reconciliation.ts` line 146 no longer accesses `.subscriptions.id`
- Existing reconciliation tests pass

---

### U3. Remove custom error classes, dead helper, and dead constant

**Goal:** Delete code that is only needed by the custom client and is no longer relevant after the SDK migration.

**Requirements:** R4, R7

**Dependencies:** U1, U2

**Files:**
- Modify: `src/lib/gocardless/types.ts`
- Modify: `src/lib/gocardless/membership-flow-helpers.ts`
- Modify: `src/lib/gocardless/membership-flow.test.ts`

**Approach:**
- Remove `GoCardlessConfigurationError`, `GoCardlessRequestError`, `GoCardlessCapabilityError` from `types.ts`
- Remove `GOCARDLESS_API_VERSION` constant from `types.ts`
- Remove `extractIdempotencyConflictId` from `membership-flow-helpers.ts`
- Remove the two `describe` blocks testing `extractIdempotencyConflictId` from `membership-flow.test.ts` (four test cases total)
- Verify no other files import the removed symbols; if any do, update them

**Test scenarios:**
- Test expectation: none — this unit removes code; the test suite itself is the verification

**Verification:**
- `types.ts` contains only domain types (`MembershipFlowInput`, `MembershipFlowResult`, `BillingRequestState`, `BillingRequestFlowState`)
- `extractIdempotencyConflictId` is gone from helpers and tests
- `npm run lint` and `npm run tsc` pass with no unused import warnings

---

## System-Wide Impact

- **Interaction graph:** `membership-flow.ts` is called by `start-payment-action.ts`, `finalize-payment-action.ts`, and `membership-reconciliation.ts`. None of these touch the GoCardless client directly — they call the domain functions whose signatures are preserved, except `createMembershipSubscription` (see below). `getBillingRequestFlow` has been removed pre-migration; the reconciliation fallback that called it is gone.
- **`createMembershipSubscription` signature and return type change:** The parameter `localSessionId` is renamed to `membershipPaymentId` (same value at the call site — `payment.id` — only the name changes). The return type changes from `{ subscriptions: { id, links } }` to `string` (subscription ID). Only `membership-reconciliation.ts` calls this function — one-line update at line 146.
- **Error propagation:** SDK errors (`ApiError` hierarchy) will now surface instead of `GoCardlessRequestError`. The call sites in server actions catch all errors generically (`catch (error)`) so this change is transparent.
- **`collectCustomerDetails` body structure change:** Corrects address fields being sent in the wrong object. If the GoCardless API was silently ignoring address fields in the `customer` object, this fix will start populating customer billing details correctly. This is a behavioral improvement, not a regression.
- **Unchanged invariants:** Webhook route, all database access patterns, and Inngest workflow steps are unaffected.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| SDK response shape differs from manually typed interfaces | Use SDK-provided types; TypeScript compiler will catch mismatches |
| `collectCustomerDetails` structure change sends address in new location | This is spec-correct; if GoCardless sandbox tests pass, the change is safe |
| SDK type definitions for sub-path imports | `"moduleResolution": "bundler"` is already set in `tsconfig.json`, resolving known compatibility issues |
| `amount`/`interval` numeric-to-string coercion | Explicit `String()` coercion; TypeScript will flag if SDK type ever changes back |
| `region` field silently dropped when splitting customer helpers | `billingDetailFromMembershipInput` explicitly includes `region: input.address?.state` |

---

## Sources & References

- Custom client: `src/lib/gocardless/client.ts`
- All API operations: `src/lib/gocardless/membership-flow.ts`
- Reconciliation caller: `src/lib/gocardless/membership-reconciliation.ts`
- SDK: `gocardless-nodejs` v8.1.0 — `npm install gocardless-nodejs`
