# WCS Spaces

A unified room, resource, and request hub for Westminster Christian School — built to replace Planning Center Calendar, with the same front door for maintenance, IT, and visitor requests.

This is the **demo prototype**: no login, seeded with real harvested WCS data, deployable to GitHub Pages. A "view as" switcher fakes sign-in so you can see the app as any staff member. Microsoft Entra ID SSO comes later (one IT approval).

## What's in it

- **Home hub** — Apple-style dashboard: today's schedule, four request doors, live counts.
- **Calendar** — day agenda with a week strip and automatic conflict detection.
- **Spaces** — directory of all 49 rooms and 37 resources by folder, with booking counts.
- **Requests** — the four front doors (Book / Maintenance / IT / Visitor), each with its real captured form, all on one approval engine.
- **View as** — switch between all 62 staff members with their real permission levels.

Seed data (821 events, 62 people, full inventory) lives in `src/data/` and was harvested read-only from the live Planning Center backend.

## Run locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # production build into dist/
```

## Deploy to GitHub Pages

Push to a GitHub repo with Pages enabled (Settings → Pages → Source: GitHub Actions). The included workflow at `.github/workflows/deploy.yml` builds and publishes on every push to `main`. Uses `HashRouter` + a relative base path, so it works at any URL with no server config.

## Stack

React + TypeScript + Vite. No backend — fully static.
