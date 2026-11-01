# Cloudflare deployment

## Connected projects discovered after pushing

GitHub currently triggers two independent Cloudflare builds for this repository:

- **Workers Builds: avatest** deployed commit `025f0cd` successfully.
- **Cloudflare Pages: avangardautocheck** reported a failed build for that commit.
  Its [build logs](https://dash.cloudflare.com/?to=/d1d44b48c0e5d4676e64334034e1132d/pages/view/avangardautocheck/29489f69-16f2-4380-81cd-b7843bb1ac69)
  require Cloudflare account access, which is unavailable on this workstation.

The public domain was still serving the previous design after that build. If
the domain uses Pages, apply the Pages settings below and redeploy that project.
The Pages Functions bundle was also compiled successfully locally with
`nodejs_compat`. The remote Pages failure's exact cause could not be determined
without its private build logs; check the build command, output directory,
Node version and compatibility settings below.

The site uses Cloudflare Workers with Static Assets. The existing Cloudflare
autoconfiguration branch named the Worker `avatest`; that name is preserved in
`wrangler.jsonc`. Static assets are limited to `dist/` so server files and local
secrets cannot be published as website files.

## Existing Git-connected Worker

In **Workers & Pages → your Worker → Settings → Build**, confirm:

| Setting | Value |
| --- | --- |
| Git repository | `odrateR/AvangardAutoCheck` |
| Production branch | `main` |
| Root directory | Repository root (`/`) |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Install command, if overridden | `npm ci` |
| Node version, if overridden | `22` or newer |

Keep the existing custom domains and DNS records. No DNS change is required.
The checked-in Wrangler configuration serves `dist/` and runs `/api/contact`
on the Worker. Email uses Cloudflare's native encrypted TCP socket on port 465
with Nodemailer handling SMTP and MIME. The rate-limit binding is declared in the configuration, with
five submissions per minute per source IP at a Cloudflare location.

If the dashboard Worker has a different name, change `name` in `wrangler.jsonc`
to that existing name before deployment. Do not create a second Worker.

## Enable real email delivery

Under **Settings → Variables and Secrets**, add these as encrypted **Secrets**
on the production Worker:

| Secret | Value |
| --- | --- |
| `SMTP_USER` | `avangardautocheck@gmail.com` |
| `SMTP_PASS` | A fresh Gmail app password for that account |

Generate the password at [Google App passwords](https://myaccount.google.com/apppasswords)
after enabling two-step verification for the sender account. This must be an app
password, not the regular Google account password. The original repository's
password was tested during this rebuild: Gmail rejected authentication with
`535` / `EAUTH`. Replace it; do not reuse the password from Git history.

The original password was committed in the old PHP source. Revoke it if it is
still listed in the Google account. Do not add any password to source code,
`wrangler.jsonc`, HTML, `.env.example`, GitHub or build output.

Deploy a new version after adding the secrets, then submit one test request
through the contact form. Success means Gmail accepted the message for
`avangardautocheck@gmail.com`; inbox placement is controlled by Gmail. The
customer's email becomes Reply-To. Errors leave the customer's form intact.

This workstation is not logged into Cloudflare, so the production secrets and
dashboard build settings could not be set or inspected from here. The existing
Git connection deploys after a push once these settings are correct.

## Cloudflare Pages: avangardautocheck

Keep the same repository and production branch. Set the framework preset to
**None**, build command to `npm run build`, output directory to `dist`, root to
the repository root, Node version to **22** or newer, and enable the `nodejs_compat` compatibility flag with a
compatibility date of `2026-10-01` or later. Put the same SMTP secrets in the
Pages production environment and redeploy. `functions/api/contact.js` exposes
the shared contact handler for Pages.

Pages does not use the Worker configuration's rate-limit binding automatically;
configure a rate limit for `/api/contact` in Cloudflare if using that alternative.

## Local development

```powershell
npm ci
npm run build
npm run dev
```

Open `http://127.0.0.1:4173`. Put development credentials in ignored `.dev.vars`:

```dotenv
SMTP_USER="avangardautocheck@gmail.com"
SMTP_PASS="YOUR_NEW_APP_PASSWORD"
```

The old recovered password remains only in the ignored local `.dev.vars` for
the failed authentication verification. Replace it before testing delivery.
Without valid credentials the site works, but the form correctly reports a
delivery error instead of claiming the message was sent.

`npm start` is a simpler Node preview; it reads SMTP settings from process
environment variables. `npm run dev` exercises the actual Cloudflare runtime.

## Verification

```powershell
npm run check
npm test
npm run test:browser
npx wrangler deploy --dry-run
```

Browser checks use Microsoft Edge. Change `channel` in `playwright.config.js`
to `chrome` or install Playwright Chromium if Edge is unavailable.

The canonical site defaults to `https://avangardautocheck.com`. If needed,
set the build variable `PUBLIC_SITE_URL` to the existing production origin.

## carVertical

The VIN section preserves the original affiliate URL and AVANGARD voucher.
The entered code is normalized and forwarded in the existing `sub3` affiliate
tracking parameter. carVertical performs the history search and payment on
its own site; its affiliate landing page may ask the visitor to enter the code
again. No paid report is generated or purchased by this site.
