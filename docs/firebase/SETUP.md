# Google sign-in, cloud saves and analytics (Firebase)

Players can sign in with Google on the start screen or from the in-game ☰ menu. Signed in, their game is
saved to their account and loads on any device. Gameplay events go to Google
Analytics for Firebase for everyone (signed in or not). Signing in is optional.

Code: `js/firebase/` (config, account, save merge rules), `js/ui/AccountChip.js`,
hooks in `js/main.js`. Security rules: `firebase/firestore.rules`.
Set `FIREBASE_CONFIG` in `js/firebase/config.js` to `null` to turn all of this off. Browser tests run with it off (see `tests/e2e/fixtures.mjs`) except `account.spec.mjs`, which uses a fake SDK.

## One-time setup (Firebase console, about 10 minutes)

1. **Create the project.** https://console.firebase.google.com → *Add project* →
   name it (e.g. `scale-architect`) → keep **Google Analytics on** → pick or
   create an Analytics account.
2. **Turn on Google sign-in.** *Build → Authentication → Get started →
   Sign-in method → Google → Enable*, choose the support email, *Save*.
3. **Allow the site's domains.** *Authentication → Settings → Authorized domains →
   Add domain*: `scale-architect.vercel.app` and `scale-architect-dev.vercel.app`
   (`localhost` is there already). Sign-in only works on these exact domains, so
   random Vercel preview URLs can't sign in.
4. **Register the web app.** *Project settings (⚙️) → General → Your apps → Web (</>)* →
   nickname `web` → *Register app* (no Hosting). Copy the `firebaseConfig` object
   (apiKey, authDomain, projectId, storageBucket, messagingSenderId, appId,
   measurementId) into `js/firebase/config.js` as `FIREBASE_CONFIG`.
   These values are public by design; the security rules protect the data.
5. **Create the database.** *Build → Firestore Database → Create database* →
   location near your players (e.g. `nam5` or `eur3`; can't be changed later) →
   *Start in production mode*.
6. **Paste the security rules.** *Firestore → Rules* → replace everything with
   `firebase/firestore.rules` → *Publish*.
7. *(Optional)* **SQL on events.** *Project settings → Integrations → BigQuery → Link*
   and tick Google Analytics. Events then land daily in BigQuery.

No Vercel environment variables are needed: the browser talks to Firebase directly.

## What gets stored

Firestore `users/{uid}` (only that player can read or write it; you see all in the console):

| field | meaning |
|---|---|
| `save`, `savedAt` | the full game save (JSON text) and when it was made |
| `productId`, `level`, `levelCompleted` | where they are now |
| `progress` | levels completed per product, e.g. `{ guestbook: 3, news_feed: 1 }` |
| `name`, `email`, `photoURL` | from their Google account |
| `createdAt`, `lastSeen` | first sign-in, last visit |

Analytics events (all carry `product_id`, most carry `level`):
`game_start` (`continued`), `level_start`, `level_complete` (`coins`, `users`),
`level_crash` (`users`), `incident` (`kind`, `handled`), `login`.
New events show in *Analytics → Realtime* / *DebugView* within minutes and in
reports after about a day. To filter reports by these parameters, register them
under *Analytics → Custom definitions*.

## How saves sync

- Each save in the browser is uploaded at most every 20 s, and right away when a
  level is completed or the player goes Home.
- On sign-in, and on each visit while signed in, the newer of the local and cloud
  save wins (`js/firebase/cloudSave.js`). A local game last synced with a
  different account never overwrites the signed-in player's cloud save.
- Signing out keeps the game in the browser; it just stops uploading.
- Firebase is never allowed to block the game: startup waits at most 5 s, and any
  failure (offline, ad blocker) falls back to browser-only saves.

## Testing

- `tests/e2e/account.spec.mjs` runs the whole flow against a fake Firebase SDK
  (`tests/e2e/fake-firebase/`), part of `bash tools/test-all.sh`.
- Against the real SDK, locally: `npx firebase-tools emulators:start --only auth,firestore
  --project demo-scale` in `firebase/`, then set `window.__SA_FIREBASE__ = { config: { apiKey: 'demo', projectId: 'demo-scale', authDomain: '127.0.0.1' },
  emulator: { auth: 'http://127.0.0.1:9099', firestoreHost: '127.0.0.1', firestorePort: 8080 } }`
  before the page loads.
- After the config is in: on the dev site, sign in, play a level, open the site in a
  private window or on a phone, sign in, and Continue should show the same game.
  Check *Firestore → Data → users* and *Analytics → Realtime*.
