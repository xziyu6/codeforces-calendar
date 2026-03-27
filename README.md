# Codeforces Calendar

Chrome extension that syncs upcoming Codeforces contests into Google Calendar.

It injects `Sync` buttons into the Codeforces upcoming contests table. Clicking `Sync` creates or updates a Google Calendar event for that contest.

## How to use

1. Click the extension icon and follow the instructions in the popup.
2. Open the Codeforces contests page and click `Sync` on an upcoming contest row.
3. You can click `Sync` again later to update the same event.

## If things break

If you see a red status next to a contest row (for example `error` or `created (fallback)` / `updated (fallback)`), or encounter any bugs, please report to me in [Github Issues](https://github.com/xziyu6/codeforces-calendar/issues/new).

## Permissions
- Uses Google sign-in and Calendar access to create/update events.
- Reads Codeforces upcoming contest pages and Codeforces API to get contest data.

---

## How it works

- **Content script**: finds the upcoming table and injects `Sync` controls.
- **Service worker**: handles OAuth, sign-out/revoke flow, and Google Calendar API calls.
- **Google Calendar helper**: lists writable calendars and performs create-or-update event upserts.

## Local development

### Prerequisites

- Node.js (18+ recommended)
- npm
- Chrome/Chromium

### Install

```bash
npm install
```

### Build

```bash
npm run typecheck
npm run build
```

Build output is written to `dist/`.

### Load unpacked extension

1. Open `chrome://extensions`.
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the repository `dist/` folder.

## Google OAuth setup (for your own build)

1. Create an OAuth client in Google Cloud for a Chrome extension.
2. Ensure the OAuth client is bound to your extension ID.
3. Configure consent screen and test users as needed.
4. Required scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.calendarlist.readonly`

## Build artifact workflow

GitHub Actions builds and uploads `dist/**` as a versioned artifact name (`codeforces-calendar-v<version>`), so the downloaded artifact contains extension files directly.

## License

This project is licensed under the [MIT License](LICENSE)