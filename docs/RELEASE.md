# Release runbook

1. Run `npm ci`, `npm run check`, `npm test`, `npm run build`, and the Chromium and WebKit Playwright suites.
2. Check the build on a disposable explorer account. Verify save/resume, a purchase and a Reading Detective publication. Test touch, audio and recovery from Files on a physical iPad when available.
3. Export a private verified database backup before migrations. Retain the current deployed version and its commit ID. Apply migrations in journal order and verify the database binding before publishing.
4. Deploy the tested build to the existing site. Verify the game picker and a read-only API response on the live origin. Tag the release only after verification.
5. For an application regression, republish the previous known-good version. Keep additive migrations in place when the prior worker supports them. Restore a database only from a verified backup after assessing newer player activity.

Local options include `PORT` and `CQ_DB_PATH`. `CQ_ADMIN_KEY` protects maintenance operations. Set a strong value via the deployment secret store. Local development can generate an ignored maintenance key under `.local/`. Keep environment values, backups, session credentials, PIN data and recovery images out of Git.
