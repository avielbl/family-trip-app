# family-trip-app

A bilingual (English / Hebrew) family trip planner. React + Vite + Firebase,
deployed to Firebase Hosting. No backend of its own — Firestore, Anonymous
Auth and Hosting only.

## Bump the version on every deploy

`package.json`'s `version` must be raised in the same change that ships to
`main`. This is not bookkeeping: the version renders in the app footer, on
Settings, on Setup and in the chat diagnostics, and it is the only way anyone
can tell which build their device actually has.

That matters here specifically. The app is an installed PWA with
`registerType: 'autoUpdate'`, so a device can keep serving a cached bundle
after a deploy. When the version on screen still reads the old number, the
refresh did not land — and if the version never changes, that signal is gone
and a stale install is indistinguishable from a working one.

- patch (`1.6.0` → `1.6.1`) for a fix
- minor (`1.6.0` → `1.7.0`) for anything a user would notice as new

The deploy workflow enforces this: it fails before building if `src/`,
`public/` or `package.json` changed without the version changing too.

## Deploying

Pushing to `main` deploys to the live site; pushing to `stage` deploys to a
preview channel. Both run from `.github/workflows/deploy.yml`. Firestore rules
are **not** deployed by CI — publish rule changes by hand in the Firebase
console.

## Conventions worth knowing

- **Bilingual content** pairs a base field with a `He` counterpart (`name` /
  `nameHe`). Read them through `localized()` in `src/utils/localize.ts` rather
  than checking the pair by hand at each call site.
- **Theming** uses the semantic tokens (`--text-primary`, `--bg-card`, …),
  which have light and dark values. The raw palette (`--blue-50`, `--gray-600`,
  literal hex and `rgba()`) does **not** change with the theme — using it for a
  background or for text on a themed surface is how several dark-mode
  readability bugs got in.
- **Plans are scheduled by part of day** (`dayPart`: morning / noon /
  afternoon / evening) with a duration, never clock times.
