# Slack App Setup

This document explains how to create and configure the START Cockpit Slack app using the manifest below.

The app icon is at `slack/slack-app-icon.png` (512×512 px).

---

## 1. Create the app from manifest

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) and click **Create New App**.
2. Choose **From a manifest** and select your workspace.
3. Switch to the **JSON** tab and paste the manifest below.
4. Click **Next**, review the summary, then **Create**.

### Manifest

```json
{
    "display_information": {
        "name": "START Cockpit",
        "description": "Notifications, updates and more from START Cockpit.",
        "background_color": "#000000"
    },
    "features": {
        "bot_user": {
            "display_name": "START Cockpit",
            "always_online": true
        }
    },
    "oauth_config": {
        "scopes": {
            "bot": [
                "chat:write.customize",
                "channels:join",
                "channels:manage",
                "channels:read",
                "channels:write.invites",
                "chat:write",
                "chat:write.public",
                "groups:read",
                "groups:write",
                "groups:write.invites",
                "im:write",
                "mpim:read",
                "search:read.users",
                "users:read",
                "users:read.email"
            ]
        },
        "pkce_enabled": false
    },
    "settings": {
        "event_subscriptions": {
            "request_url": "https://<your-domain>/api/slack/events",
            "bot_events": [
                "member_joined_channel",
                "member_left_channel",
                "team_join"
            ]
        },
        "org_deploy_enabled": false,
        "socket_mode_enabled": false,
        "token_rotation_enabled": false,
        "is_mcp_enabled": false
    }
}
```

---

## 2. Set the app icon

1. In the app settings sidebar go to **Basic Information → Display Information**.
2. Under **App icon & Preview**, upload `slack/slack-app-icon.png`.
3. Save changes.

---

## 3. Add the signing secret to the target deployment

The app verifies incoming Slack requests using the signing secret. The deployment must have it set **before** the request URL can be verified.

1. In the app settings sidebar go to **Basic Information → App Credentials**.
2. Copy the **Signing Secret**.
3. Set it in `.env` (and in your deployment's environment variables):
   ```
   SLACK_SIGNING_SECRET=...
   ```
4. Deploy / restart the app so the new value takes effect.

---

## 4. Configure the request URL

The event subscription URL must point to the running app at `/api/slack/events`.

| Environment | URL |
|---|---|
| Local | `https://<your-tunnel-subdomain>/api/slack/events` |
| Production | `https://<your-production-domain>/api/slack/events` |

To update it:

1. In the app settings sidebar go to **Event Subscriptions**.
2. Replace the **Request URL** with the correct URL for your environment.
3. Wait for Slack to verify the endpoint (it sends a `url_verification` challenge — the app handles this automatically).
4. Click **Save Changes**.
5. Once the URL is verified, enable **Delayed Events** on the same page. This retries missed deliveries slowly over 24 hours, so the app recovers events it missed during downtime.

---

## 5. Copy the bot token to `.env`

1. In the app settings sidebar go to **OAuth & Permissions**.
2. Click **Install to Workspace** (or **Reinstall** if already installed) and authorise.
3. Copy the **Bot User OAuth Token** (starts with `xoxb-`).
4. Set it in `.env`:
   ```
   SLACK_BOT_TOKEN=xoxb-...
   ```
