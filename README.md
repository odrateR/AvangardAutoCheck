# Avangard Autocheck

Requires Node.js 22 or newer. Run `npm ci`, then `npm run dev` (or `npm start`)
to build and preview the site at http://127.0.0.1:4173 in Cloudflare's runtime.

- `src/`: editable homepage, error page, JavaScript and stylesheet.
- `content/articles.json`: journal content used by the page generator.
- `public/`: images, fonts and Cloudflare static-file settings.
- `lib/contact.js`: shared email handler for Pages and Workers.
- `dist/`: generated output, rebuilt by `npm run build` and excluded from Git.

Edit source files instead of `dist/`. Run `npm run build` after source changes
while previewing; Wrangler picks up the rebuilt assets. Production builds
create one minified stylesheet and one minified script with content hashes
in their filenames, preserving readable source and avoiding stale caches.

Run `npm run check`, `npm test` and `npm run test:browser` to verify changes.
Browser tests use Microsoft Edge. Push to `main` to trigger the existing Pages
production deployment. `npm run deploy` also targets Pages; the separate Worker
can be deployed explicitly with `npm run deploy:worker`.

Contact requests are sent through Resend to `avangardautocheck@gmail.com`.
See [CLOUDFLARE.md](CLOUDFLARE.md#contact-email-resend) for domain verification,
Cloudflare variables and deployment instructions. Copy `.env.example` to an
ignored `.dev.vars` file for local development with Wrangler.
