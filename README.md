# Basement List

Basement List is a community-run Geometry Dash demon list with separate main and community rankings, verified record submissions, player profiles, leaderboards, and admin review tools.

The interface was designed for this project and is maintained with contributions from **ntyu2** and **Ksois**.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local` and add the Firebase web-app configuration.
3. In Firebase Authentication, enable Email/Password and Google sign-in.
4. Add each production hostname to Firebase Authentication's Authorized domains.
5. Run `npm run dev`.

The app shows a setup screen when required Firebase values are missing instead of failing with a blank page.

## Languages

The public interface supports English, Russian, and Simplified Chinese. The language selector is available in the header and saves the visitor's choice on their device. Player names, level names, and other community-created content are kept exactly as submitted.

## Preserving existing data

Deploy the app with the existing Basement List `VITE_FIREBASE_*` project values. The frontend does not seed, migrate, replace, or clear Firestore or Storage on startup, so existing levels, completions, submissions, profiles, victors, and leaderboard history remain in place. Pointing production at a new Firebase project will make the site appear empty even though the original data still exists.

Deploying the included security rules changes access permissions only; it does not delete documents. Take a Firebase export before any separate Admin SDK migration or bulk admin operation. Level deletion and account deletion remain explicit, confirmed actions rather than deployment steps.

## Builds

- `npm run build` creates a root-path build for Netlify or another SPA host.
- `npm run build:github` creates a `/GDList/` build for GitHub Pages.
- `npm run deploy` publishes the GitHub Pages build through `gh-pages`.

Netlify uses the included SPA rewrite. GitHub Pages uses `public/404.html` plus an early redirect-restoration script so direct links and refreshes keep their route.

## Firebase security

`firestore.rules` and `storage.rules` are source-controlled and deny unknown collections by default. Review the rules against a staging Firebase project before deploying them:

```sh
firebase deploy --only firestore:rules,storage
```

The public `users` documents are intentionally readable for profiles and leaderboards, so they must contain public profile data only. New accounts no longer write email addresses into these documents. Remove any legacy `email` fields with a trusted Admin SDK migration before making the site public.

Role changes, real account suspension, and guaranteed account deletion should ultimately be moved to callable backend functions using the Firebase Admin SDK. Client-side route guards improve the experience but are not a replacement for deployed rules.

## Credits

Copyright &copy; 2026 [ntyu2](https://github.com/ntyu2) and [Ksois](https://github.com/KsoisDev). All rights reserved. See [NOTICE.md](NOTICE.md) for attribution details.

Basement List is not affiliated with RobTop Games. Created for the tnaillzxgd Discord community by ntyu2 and Ksois.
