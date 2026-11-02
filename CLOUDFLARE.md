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

## Contact email: Resend

The contact form uses Resend's HTTPS API with native `fetch`. It has no email
SDK, SMTP dependency or TCP socket adapter. Both Pages and Worker deployments
use the same handler in `lib/contact.js`.

- Default sender: `Avangard Autocheck <website@avangardautocheck.com>`.
- Fixed recipient: `avangardautocheck@gmail.com`.
- Reply-To: the customer's validated email address.
- The customer's name, phone, service and message are included as plain text.
- The handler confirms success only when Resend accepts the email and returns
  an email ID. Inbox delivery must be checked in Resend's email logs.
- Requests time out after 10 seconds. Failures preserve the filled form and
  show an error; provider details and API keys are not exposed to visitors.
- API requests use Cloudflare's supported `manual` redirect mode, so redirects
  fail the send without forwarding the API key to another URL.

### Account and domain setup

1. Open https://resend.com/domains and add `avangardautocheck.com` for sending.
2. Add the exact DNS records shown by Resend to the domain's Cloudflare DNS
   settings, including the DKIM TXT and the sending SPF TXT/MX records. Values
   depend on your Resend domain and region. Resend also offers automatic setup
   through its "Sign in to Cloudflare" button. Keep existing website and inbox
   DNS records. Receiving email in Resend is not required for this form.
3. Wait until the domain is verified in Resend.
4. Open https://resend.com/api-keys and create a sending-access API key for this
   domain. Save the key directly in Cloudflare; never commit it or include it
   in static assets.

Official DNS guide: https://resend.com/docs/guides/dns/cloudflare

### Cloudflare Pages variables

Open **Workers & Pages > avangardautocheck > Settings > Variables and Secrets**.
Select **Production** and configure:

| Key | Value | Secret |
| --- | --- | --- |
| `RESEND_API_KEY` | Your Resend API key, starting with `re_` | Yes |
| `RESEND_FROM_EMAIL` | `website@avangardautocheck.com` | No |

`RESEND_FROM_EMAIL` is optional because the code uses that address by default.
To send from another verified domain or subdomain, set it to an address on
that exact verified domain. Supply only the email address, without a display
name. The sender cannot be a `gmail.com` address.

Remove the obsolete `SMTP_USER` and `SMTP_PASS` variables if you added them;
the code no longer reads them. Revoke any Gmail app password created solely
for the old website integration.

Deploy this code to the Pages project's production branch and redeploy after
saving the variables. Adding variables or deploying to the separate `avatest`
Worker does not update the Pages production site. To activate email on Worker
preview URLs as well, configure its Resend variables separately. Preview Pages
deployments likewise need variables in their own environment.

Until the API key is present, the endpoint returns HTTP 503. Invalid keys,
unverified senders, provider errors and timeouts return HTTP 502. After
deployment, submit a clearly labelled test from the contact form and check
the Resend delivery status and Gmail inbox/Spam. API acceptance alone does
not guarantee inbox delivery.

### Troubleshooting failed delivery

If Resend has no logs, confirm you are viewing the account/team that issued the
API key. An absent log entry does not prove that the key is valid or that a
request never reached Resend.

For a precise failure category, open the latest Pages production deployment,
select **View details > Functions**, and start the live log stream before
submitting a test. The handler logs only a delivery stage, numeric provider
status and an allowlisted reason. It never logs API keys, raw provider messages
or customer fields. `stage: request` indicates a network/runtime failure;
`stage: response` means Resend returned an HTTP response. A 401 indicates an
authentication failure; inspect the key in the correct Resend account. A 403
requires checking sender verification, permissions or account restrictions.
Do not share the API key when providing logs. Pages logs are live and do not
persist, so reproduce the failure while the stream is open.

Official log guide: https://developers.cloudflare.com/pages/functions/debugging-and-logging/

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
exercise the same shared contact handler. Development-only Resend settings
belong in ignored `.dev.vars`, never in Git.

## Verification

```powershell
npm run check
npm test
npm run test:browser
npx wrangler deploy --dry-run
npx wrangler pages functions build --outdir .wrangler/pages-check
```

Browser tests use Microsoft Edge. The canonical URL for the generated sitemap
and robots file defaults to `https://avangardautocheck.com`.

## carVertical

The VIN section preserves the original affiliate URL and AVANGARD voucher.
The code is normalized and forwarded in the original `sub3` affiliate tracking
parameter. carVertical performs the search and payment on its site and may ask
the visitor to enter the code again. This site does not purchase paid reports.
