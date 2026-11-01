# Avangard Autocheck

Romanian automotive inspection website, rebuilt from the design in
[TheFirstCookie/avangard-codex-test](https://github.com/TheFirstCookie/avangard-codex-test).
The landing page, journal, six articles and privacy page share a dark navy and
charcoal theme, with Avangard blue and green accents and locally hosted assets.

The site includes the carVertical affiliate VIN/registration handoff and
AVANGARD voucher, an interactive inspection diagram, service selection,
responsive navigation and direct contact-form delivery through Gmail SMTP.

## Run locally

Requires Node.js 22 or newer.

```powershell
npm ci
npm run build
npm run dev
```

Open http://127.0.0.1:4173. Put SMTP credentials in ignored `.dev.vars` for
local development. Never commit credentials.

## Cloudflare

The production site is deployed through the existing Git-connected Cloudflare
Pages project `avangardautocheck`. Its build settings and Node compatibility
are configured in Cloudflare. The separate `avatest` Worker is also retained.
See [CLOUDFLARE.md](CLOUDFLARE.md) for the active settings and verification commands.

**Email activation still requires a fresh Gmail app password in Cloudflare.**
The original password found in the repository history was rejected by Gmail.
The form reports failures honestly and retains the customer's entered data.

## Edit content

- `dist/index.html`: landing page and forms.
- `dist/styles.css`, `dist/topbar.css`: reference layout and typography.
- `dist/dark.css`: shared dark theme and VIN section.
- `dist/app.js`: navigation, inspection, contact form and VIN interactions.
- `dist/assets/`: original photos, logos and local fonts.
- `content/articles.json`: journal content. Run `npm run build` after edits.
- `generate-pages.mjs`: journal, article, privacy and SEO page generation.
- `lib/contact.js`: shared validation and email delivery handler.
- `lib/cloudflare-transport.js`: native Cloudflare TLS connection for Gmail SMTP.
- `worker.js`, `wrangler.jsonc`: Cloudflare Worker and static asset deployment.
- `functions/api/contact.js`: alternate Cloudflare Pages endpoint.

## Verify

```powershell
npm run check
npm test
npm run test:browser
npx wrangler deploy --dry-run
```

Backend tests mock SMTP and do not send email. Browser tests cover responsive
dark layouts, navigation, inspection, VIN handoff, contact success/error states,
and generated pages. Real delivery requires valid production SMTP secrets.

Photos and partner marks are retained from the supplied reference site and
original Avangard materials.
