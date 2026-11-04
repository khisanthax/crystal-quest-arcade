# Crystal Quest Arcade

Crystal Quest Arcade is an educational web game for desktop and iPad landscape. Choose **Emberia** or **Luminara**, then choose **Temple Run**, **Original Adventure**, or **Reading Detective**. The seven runner environments share a Three.js engine and use the selected study pack. The original platform adventures retain their physics, lesson gates and saves. Reading Detective uses passage clues and evidence to help learners write their own answers on paper.

## Run and test locally

Use Node.js 24 or newer.

```sh
npm ci
npm run check
npm run lint
npm test
npm run build
npm start
```

Open http://localhost:4175. For an iPad on the same private network, use your computer’s LAN address and port 4175. Run `npx playwright install chromium webkit` followed by `npm run test:browser` for touch emulation. On Linux, add `--with-deps` when installing Playwright browsers. Browser tests use disposable SQLite databases. Physical iPad Safari is a separate release check.

## Study packs and homework

Use the in-game study tools to import a JSON pack. Start with [the example pack](dist/runner/example-pack.json) and [its schema](dist/runner/study-pack.schema.json). Set it as the current test to use it across worlds. Older tests remain available with reduced rewards.

A designated owner can import [this original sample homework](docs/sample-reading-case.json) into the Reading Detective workshop, check the passage and evidence, and assign it to an explorer. The [homework schema](dist/reading/schema.json) describes the file format. Private classroom assignments and their answer keys are stored separately from this repository.

## Architecture and saves

- `dist/runner/` contains the shared runner, worlds, study packs, economy and pet catalog.
- `dist/shared/` contains reusable platform physics, touch input and browser save helpers. The original adventures remain in their own compatibility routes.
- `dist/reading/` contains the guided evidence workflow and owner review forms.
- `worker/` serves cloud accounts, validates save revisions and reward events, and authorizes homework publishing.
- `drizzle/` contains database migrations. Local development uses SQLite. Cloud deployments use a D1 binding named `DB`.

Guest progress lives in the browser. Explorer accounts use enrolled devices, remembered sessions and recovery QR credentials. Keep local progress until migration has been confirmed and the cloud save checked. A recovery QR is a credential. Store it privately.

## Deployment

`npm run build` builds static assets, a service worker and the cloud Worker. Static HTTPS hosting supports device-local play. For accounts and cloud saves, use the Worker entry in `dist/server/index.js` with D1, apply the checked-in migrations, and configure the deployment secrets outside the repository. The [release runbook](docs/RELEASE.md) covers backup and rollback.

See [Game Master Dashboard](docs/GAME-MASTER.md) for owner setup and tested administration workflows.

See [sprint verification](docs/SPRINT-VERIFICATION.md) for exercised workflows and remaining device checks. A permissive license is pending review of code and asset rights.
