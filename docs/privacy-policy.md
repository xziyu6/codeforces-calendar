# Privacy Policy

**Codeforces Calendar** is a Chrome extension that syncs upcoming Codeforces contests to Google Calendar.

## Data collection

This extension does not collect, store, or transmit any personal data to the developer or any third party.

## How data is used

- The extension requests access to your Google Calendar solely to create and update contest events on your behalf.
- Your Google account credentials are never seen or stored by the extension. Authentication is handled entirely by Chrome and Google's OAuth 2.0 service.
- Your selected calendar preference is stored locally in `chrome.storage.sync`, which is managed by Chrome and synced to your own Google account.

## Third-party services

The extension communicates directly with the following services on your behalf:

- **Google Calendar API** — to create or update calendar events.
- **Codeforces API** — to fetch contest details (public, unauthenticated endpoint).

No data is sent to the developer's servers. There are no analytics, tracking, or advertising integrations.

## Contact

If you have any questions, open an issue on the [GitHub repository](https://github.com/xziyu6/codeforces-calendar).
