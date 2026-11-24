# Public trial deployment

Live demo: **https://yourhr-beta.netlify.app/** · Source: **https://github.com/Jameslovecs/yourHR**

The public trial is a **static React build on Netlify Free**. No paid AI calls, serverless compute, or database are required for demo visitors. The original Next.js + SQLite developer application remains available with `npm run dev`.

## What is live

Each browser has its own fictional candidate, recruiter, jobs, profile, and screening history in localStorage. Both roles operate on the same sandbox so a visitor can try the entire approval handoff. Separate browsers do not see each other's edits. Reset demo clears that browser's sample data. No email, password, or real candidate information is required; visitors should use fictional information.

The public demo is not a live recruiting marketplace. No messages reach actual employers, there is no external agent connection, and no real-account credentials are collected while the hosted backend is unconfigured. The UI labels this explicitly.

## Build and deploy

```sh
npm ci
npm test
npm run build:trial
npm run preview:trial
```

The deployable directory is `dist-demo/`. Its index, assets, icon, `_headers`, and `_redirects` are the entire deployment. Netlify Git-based builds can use the committed `netlify.toml`. Manual uploads also work; upload a ZIP with `index.html` at its root. For a static upload Netlify reads `_headers` and `_redirects` from the build directory.

The first release was uploaded manually. **Pushing GitHub alone does not redeploy it.** Connecting the repository in Netlify enables automatic builds, or upload a new build through “Drop new files” on the existing app. Preserve the existing site and public URL.

No payment method or plan upgrade is required by this application. Keep Netlify on Free and avoid optional agent-run features or paid add-ons. Netlify meters free-plan credits and can pause a site when its allowance is consumed; this is not an unlimited-hosting promise.

## Optional shared-account backend (not activated in the demo-only release)

The integration is implemented and tested against real PostgreSQL semantics using PGlite, but must be provisioned and tested in the actual Supabase project before public signup is enabled.

1. Create a **Free** Supabase project. The account owner should generate/store the database password privately.
2. Run `supabase/migrations/001_public_beta.sql` once in its SQL editor. Application tables have RLS enabled, with all direct anon/authenticated grants revoked. The single `yourhr_action` RPC enforces identity, role, ownership, consent, mutation budgets, and validation. All public-facing data goes through that function. No service-role key belongs in the browser.
3. Keep email confirmation **enabled**. Configure a custom SMTP provider before inviting external users. Supabase's default email server only sends to organization-team addresses and has a very small hourly quota; a new project alone does not make public email signup work. Do not bypass verification to work around this.
4. Set the Supabase Site URL to the deployed origin and add the same origin to allowed redirect URLs. Verify signup, confirmation, and login with two independent test identities. The browser SDK handles confirmation redirects and sessions.
5. Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in Netlify build environment (or a gitignored `.env.local` when building manually). Use the public anonymous/publishable API key, **never** `service_role` or a secret key.
6. Rebuild and deploy. Real login/signup replaces the “Try yourHR” explanation. Browser demos remain separate from the real shared board. Real accounts start with private, empty profiles and no demo listings.
7. Test candidate and recruiter ownership from separate browser sessions, direct-table access denial, privacy flags, missing answers, reusable answers, deletion, report submission, and account verification against hosted Supabase before announcing real signup.

Auth token/session storage uses the Supabase browser SDK. The client sends no OpenAI requests. Shared screening comparisons run in PostgreSQL rather than trusting client-submitted results.

### Beta limits and moderation

The RPC permits 120 authenticated mutations per account/hour, 20 active jobs per recruiter, and 100 screenings per candidate. Public jobs and discovery lists are capped at 200 per response. Supabase also supplies its own authentication limits. These bounds protect a small trial; they are not a complete abuse-control system.

Users can report a job, remove their own job, or delete their account and associated data. Reports appear in `yourhr_reports` for the owner to review in the Supabase dashboard; there is no automated moderation or email notification yet. Posting identities and job claims are not verified. Account deletion cascades through owned profiles, jobs, reports, and screening records; information another person has already copied cannot be recalled.

### Validation

- Live Netlify deployment verified without authentication (HTTP 200), including candidate screening, custom-answer approval, recruiter handoff, and persistence after reload.
- Core screening unit tests.
- Local Next.js API workflow tests in isolated SQLite.
- Browser-sandbox isolation, role switching, approval and reset tests.
- PostgreSQL migration/RPC integration tests: consent, ownership, direct table denial, validation, exact custom-answer reuse, action budget, reporting and deletion.
- TypeScript and both static/Next.js production builds.

The Postgres integration test stubs Supabase's `auth.users` and `auth.uid()` locally. It validates application SQL, not Supabase's deployed auth service, email delivery, or project configuration. Those hosted checks remain necessary.
