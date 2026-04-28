# GoCardless Membership Setup

START Cockpit uses GoCardless to activate membership after profile onboarding is complete.

## Environment

Set these values in `.env`:

```bash
GOCARDLESS_API_KEY=
GOCARDLESS_BASE_URL=https://api-sandbox.gocardless.com
GOCARDLESS_WEBHOOK_SECRET=
GOCARDLESS_MEMBERSHIP_TEMPLATE_ID=PL01KF12SSWH7XMHG49RY0RF8KYZ
```

Use `https://api.gocardless.com` for live.

The app creates a mandate-only Billing Request, creates a Billing Request Flow, and redirects the user to the returned `authorisation_url`. The GoCardless customer is tagged with `start_cockpit_user_id` and `start_cockpit_user_email` metadata so we can reconnect an existing GoCardless customer before creating another flow. When GoCardless redirects back to `/membership/payment-return`, the app verifies the Billing Request server-side, creates the yearly 40 EUR subscription against the confirmed mandate, updates the local payment row, and marks the user as a member.

## Dashboard Setup

- Create a webhook endpoint pointing at `/api/gocardless/webhooks`.
- Copy the webhook endpoint secret into `GOCARDLESS_WEBHOOK_SECRET`.
- Webhooks are a backup reconciliation path. The redirect return page is the primary activation path.

## Rollout Checks

- Start payment from a profile-complete onboarding user.
- Confirm the user is redirected to the GoCardless hosted flow.
- Complete mandate setup in sandbox.
- Confirm the redirect return page creates the subscription and sends the user back to `/membership` as a full member.
- Confirm a signed fulfilled Billing Request webhook is idempotent after the user has already been activated.
- Confirm admins see `Payment pending` before activation and full member state after activation.

## Notes

GoCardless customer metadata includes `start_cockpit_user_id` and `start_cockpit_user_email`. Billing Request and subscription metadata also include those values, plus `start_cockpit_session`, for external traceability. Local control flow depends on explicit GoCardless IDs in `membership_payment`, not on stored webhook payloads or generic JSON metadata.
