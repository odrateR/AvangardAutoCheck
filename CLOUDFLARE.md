# Cloudflare deployment

## Production: Cloudflare Pages

The existing `avangardautocheck` Pages project serves:

- https://avangardautocheck.com
- https://www.avangardautocheck.com
- https://avangardautocheck.pages.dev

It remains connected to `odrateR/AvangardAutoCheck`, production branch `main`.
Pushes to `main` trigger automatic production deployment. Existing custom
domains and DNS records are retained.

These settings are configured directly on the Pages project, for production
and preview environments:

| Setting | Value |
| --- | --- |
| Root directory | Repository root |
| Build command | `npm ci && npm run build` |
| Build output directory | `dist` |
| Build variable `NODE_VERSION` | `22` |
| Functions compatibility date | `2026-10-01` |
| Functions compatibility flag | `nodejs_compat` |

The Pages project settings control this deployment. The root `wrangler.jsonc`
is the separate Worker's configuration; Pages skips it because it has no
`pages_build_output_dir`. Do not replace it with Pages configuration while
both projects share the repository.

The explicit install step ensures the Pages Functions compiler can resolve
its dependencies. Only `dist/` is published as static files; source files and
local credentials stay outside the published directory. The shared contact
handler is exposed by `functions/api/contact.js`.

## Separate Worker: avatest

The same repository also has an existing Git-connected `avatest` Worker.
Its configuration is tracked in `wrangler.jsonc` and uses:

- Build command: `npm run build`.
- Deploy command: `npx wrangler deploy`.
- Static assets: `dist/`.
- Worker routes: `/api/*`.
- Contact rate limiter: five requests per minute per source IP at a Cloudflare location.

The Worker and Pages projects deploy independently. A successful Worker build
alone does not update the custom domain attached to Pages.

## Email activation, deferred

Email secrets have not been configured as part of the hosting repair. When
ready, add encrypted `SMTP_USER` and `SMTP_PASS` secrets to the Pages production
environment and redeploy. Use a fresh Gmail app password for
`avangardautocheck@gmail.com`; the password in the original Git history was
rejected by Gmail. Never commit passwords or place them in static assets.

Until valid secrets are present, the contact endpoint reports that sending is
unavailable. The rest of the site works independently of email configuration.

Pages does not inherit the Worker's rate-limit binding; configure a Pages rate
limit for `/api/contact` when activating the contact form.

## Local development

Requires Node.js 22 or newer.

```powershell
npm ci
npm run build
npm run dev
```

Open http://127.0.0.1:4173. The dev command uses the separate Worker config to
exercise the same shared contact handler. Development-only SMTP credentials
belong in ignored `.dev.vars`, never in Git.

## Verification

```powershell
npm run check
npm test
npm run test:browser
npx wrangler deploy --dry-run
npx wrangler pages functions build --outdir .wrangler/pages-check --compatibility-flags=nodejs_compat
```

Browser tests use Microsoft Edge. The canonical URL for the generated sitemap
and robots file defaults to `https://avangardautocheck.com`.

## carVertical

The VIN section preserves the original affiliate URL and AVANGARD voucher.
The code is normalized and forwarded in the original `sub3` affiliate tracking
parameter. carVertical performs the search and payment on its site and may ask
the visitor to enter the code again. This site does not purchase paid reports.