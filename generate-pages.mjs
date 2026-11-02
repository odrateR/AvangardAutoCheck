import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, transform } from 'esbuild';

const projectRoot = resolve(fileURLToPath(new URL('.', import.meta.url)));
const outputRoot = resolve(projectRoot, 'dist');
// Only the generated dist directory may be cleared, including on Windows.
if (!outputRoot.startsWith(projectRoot + sep)) throw new Error('Invalid build output directory');
const readText = async path => (await readFile(resolve(projectRoot, path), 'utf8')).replaceAll('\r\n', '\n');
const hash = content => createHash('sha256').update(content).digest('hex').slice(0, 12);
const [index, notFound, articleJSON, script, baseStyles, conversionStyles, campaign, campaignStyles] = await Promise.all([
  readText('src/index.html'), readText('src/404.html'), readText('content/articles.json'), readText('src/app.js'),
  readText('src/styles.css'), readText('src/conversion.css'), readText('src/landing-999.html'), readText('src/landing-999.css')
]);
const cssSource = [baseStyles, conversionStyles, campaignStyles].join('\n');
const articles = JSON.parse(articleJSON);
const [css, js] = await Promise.all([
  transform(cssSource, { loader: 'css', minify: true, charset: 'utf8', target: ['chrome109', 'firefox115', 'safari16'], legalComments: 'none' }),
  build({ stdin: { contents: script, resolveDir: resolve(projectRoot, 'src'), sourcefile: 'app.js' }, bundle: true, write: false, metafile: true, format: 'iife', minify: true, charset: 'utf8', target: 'es2022', legalComments: 'none' })
]);
js.code = js.outputFiles[0].text;
const cssFile = `site.${hash(css.code)}.css`;
const jsFile = `app.${hash(js.code)}.js`;
const pages = new Map([['index.html', index], ['404.html', notFound], ['verificare-auto-999.html', campaign]]);
const addPage = (path, html) => pages.set(path, html);

await mkdir(outputRoot, { recursive: true });
// Keep the directory itself so Windows previews can watch it during rebuilds.
for (const entry of await readdir(outputRoot)) {
  const target = resolve(outputRoot, entry);
  if (!target.startsWith(outputRoot + sep)) throw new Error('Invalid generated file path');
  await rm(target, { recursive: true, force: true });
}
await cp(resolve(projectRoot, 'public'), outputRoot, { recursive: true });
const header = index.match(/<header class="site-header">[\s\S]*?<\/header>/)[0].replaceAll('href="#', 'href="index.html#');
const footer = index.match(/<footer class="site-footer">[\s\S]*?<\/footer>/)[0].replaceAll('href="#', 'href="index.html#');
const booking = index.match(/<!-- BOOKING START -->([\s\S]*?)<!-- BOOKING END -->/)[1];
const esc = text => text.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const plain = html => html.replace(/<[^>]+>/g, '').trim();
function page(title, description, main, extra = '') {
  return `<!doctype html>\n<html lang="ro"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)} | Avangard Autocheck</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#080e14"><meta name="color-scheme" content="dark"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="${extra ? 'article' : 'website'}"><link rel="icon" href="assets/logo-original.png" type="image/png"><link rel="stylesheet" href="site.css"><script src="app.js" defer></script>${extra}</head><body class="interior-page"><a class="skip-link" href="#main">Sari la conținut</a><div class="scroll-progress" aria-hidden="true"></div>${header}<main id="main">${main}</main>${footer}</body></html>`;
}
function card(article) {
  return `<a class="journal-card" href="${article.slug}" data-category="${esc(article.category)}"><div class="journal-image"><img src="${article.image}" alt="${esc(article.category)} — ghid Avangard" width="900" height="600" loading="lazy"></div><p class="eyebrow">${esc(article.category.toLocaleUpperCase('ro'))}</p><h3>${esc(article.title)}</h3><span class="inline-link">Citește articolul <span>↗</span></span></a>`;
}
const cta = `<div class="blog-cta"><h2>Un anunț promițător?<br>Hai să vedem și mașina.</h2><a class="button button-primary" href="index.html#contact">Programează o inspecție <span>↗</span></a></div>`;
const featured = articles[0];
const categories = [...new Set(articles.map(article => article.category))];
const blog = `<section class="page-intro wrap"><p class="eyebrow"><span class="square"></span> JURNAL AUTO / AVANGARD</p><h1>Cunoștințe în plus.<br><span class="muted">Surprize în minus.</span></h1><p>Ce merită să știi înainte de următoarea ta mașină. Ghiduri despre inspecție, kilometraj, caroserie și motor.</p></section><div class="wrap"><a class="blog-feature" href="${featured.slug}"><img src="${featured.image}" alt="La volanul unei mașini" width="1200" height="800"><div><p class="eyebrow"><span class="square"></span> ÎNCEPE DE AICI</p><h2>${esc(featured.title)}</h2><p>${esc(featured.description)}</p><span class="inline-link">Citește ghidul <span>↗</span></span></div></a><div class="blog-filters" role="group" aria-label="Filtrează articolele"><button data-filter="all" aria-pressed="true">Toate articolele</button>${categories.map(category => `<button data-filter="${esc(category)}" aria-pressed="false">${esc(category)}</button>`).join('')}</div><p id="filter-status" role="status" class="visually-hidden">${articles.length} articole afișate</p><div class="journal-grid blog-page-grid">${articles.map(card).join('')}</div>${cta}</div>`;
addPage('blog.html', page('Jurnal auto — ghiduri pentru cumpărători', 'Ghiduri Avangard Autocheck despre inspecția auto, kilometraj, accidente ascunse și motor. Înțelege mașina înainte de cumpărare.', blog));
for (const article of articles) {
  const headings = [];
  let body = article.bodyHtml.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, (_, title) => {
    const id = 'sectiune-' + (headings.length + 1); headings.push({ id, title: plain(title) }); return `<h2 id="${id}">${title}</h2>`;
  });
  const minutes = Math.max(3, Math.ceil(plain(body).split(/\s+/).length / 200));
  const main = `<section class="page-intro article-intro wrap"><div class="breadcrumbs"><a href="index.html">Acasă</a><span>/</span><a href="blog.html">Jurnal auto</a><span>/</span><span>${esc(article.category)}</span></div><p class="eyebrow"><span class="square"></span> ${esc(article.category.toLocaleUpperCase('ro'))}</p><h1>${esc(article.title)}</h1><div class="article-meta"><span>ECHIPA AVANGARD AUTOCHECK</span><span>${minutes} MIN DE LECTURĂ</span></div></section><div class="article-cover wrap"><img src="${article.image}" alt="${esc(article.category)} — Avangard Autocheck" width="1200" height="800" fetchpriority="high"></div><div class="article-layout wrap"><aside class="article-sidebar"><div><p class="eyebrow">ÎN ACEST ARTICOL</p><nav aria-label="Cuprins">${headings.map(heading => `<a href="#${heading.id}">${esc(heading.title)}</a>`).join('')}</nav></div></aside><article class="article-body">${body}<div class="current-offer">Pentru serviciile și tarifele Avangard Autocheck, consultă <a href="index.html#preturi">oferta actuală</a> sau <a href="index.html#contact">discută cu echipa</a>.</div></article></div><div class="wrap">${cta}</div>`;
  const schema = JSON.stringify({ '@context': 'https://schema.org', '@type': 'Article', headline: article.title, description: article.description, inLanguage: 'ro', author: { '@type': 'Organization', name: 'Avangard Autocheck' } }).replaceAll('<', '\\u003c');
  addPage(article.slug, page(article.title, article.description, main, `<script type="application/ld+json">${schema}</script>`));
}
const privacy = `<section class="page-intro wrap"><p class="eyebrow"><span class="square"></span> AVANGARD AUTOCHECK</p><h1>Datele tale.<br><span class="muted">Explicate simplu.</span></h1></section><div class="wrap legal-content"><h2>Contactul prin acest site</h2><p>La trimiterea formularului de contact sau a cererii de apel, datele completate sunt transmise serverului site-ului pentru a trimite un email către avangardautocheck@gmail.com. Programarea este confirmată separat de echipa Avangard. Dacă trimiterea nu este confirmată, formularul afișează un mesaj și păstrează datele introduse.</p><h2>Ce informații incluzi</h2><p>Solicitarea poate conține numele, numărul de telefon, adresa de email, serviciul ales și detaliile despre mașină. Formularul de programare rapidă solicită doar numele și numărul de telefon. Aceste informații sunt folosite de echipa Avangard pentru a răspunde solicitării și pentru a discuta o eventuală programare. Evită trimiterea documentelor de identitate sau a datelor bancare prin acest formular.</p><h2>Preferințe și servicii externe</h2><p>Când folosești verificarea istoricului, codul introdus este transmis către carVertical prin linkul de afiliere; carVertical gestionează căutarea, raportul și plata conform propriilor condiții. Site-ul memorează local preferința privind animațiile și, când măsurarea este activată, alegerea privind cookie-urile. Poți șterge această preferință din setările browserului. Imaginile și fonturile sunt servite local. Linkurile către Instagram, TikTok sau parteneri deschid servicii externe, care aplică propriile politici. Furnizorul de găzduire poate procesa date tehnice de acces pentru funcționarea site-ului.</p><h2>Statistici și reclame</h2><p>Dacă sunt configurate, instrumentele Google și Meta se încarcă doar după ce accepți măsurarea. Le folosim pentru a înțelege interacțiunile cu site-ul și cererile primite prin formulare. Nu transmitem valorile completate în formulare către aceste instrumente. Poți refuza măsurarea sau îți poți schimba alegerea din „Preferințe cookie”, în subsolul paginii, când această opțiune este disponibilă.</p><h2>Întrebări despre datele trimise</h2><p>Pentru întrebări sau solicitări privind informațiile transmise echipei, scrie la <a href="mailto:avangardautocheck@gmail.com">avangardautocheck@gmail.com</a> sau sună la <a href="tel:+37369448878">069 448 878</a>.</p><a class="inline-link" href="index.html#contact">Înapoi la contact <span>↗</span></a></div>`;
addPage('confidentialitate.html', page('Confidențialitate', 'Cum funcționează formularul de contact și preferințele locale pe site-ul Avangard Autocheck.', privacy));
const origin = (process.env.PUBLIC_SITE_URL || 'https://avangardautocheck.com').replace(/\/+$/, '');
const routes = ['index.html', 'verificare-auto-999', 'blog.html', ...articles.map(a => a.slug), 'confidentialitate.html'];
const output = new Map([
  [cssFile, css.code], [jsFile, js.code],
  ['sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${routes.map(route => `<url><loc>${origin}/${route === 'index.html' ? '' : route}</loc></url>`).join('')}</urlset>\n`],
  ['robots.txt', `User-agent: *\nAllow: /\nSitemap: ${origin}/sitemap.xml\n`]
]);
for (const [file, html] of pages) {
  const withBooking = !html.includes('id="booking-dialog"') && /src="\/?app\.js"/.test(html) ? html.replace('</body>', booking.replaceAll('href="confidentialitate.html"', 'href="/confidentialitate.html"') + '</body>') : html;
  output.set(file, withBooking.replace(/((?:href|src)=")(\/?)(site\.css|app\.js)(")/g,
    (_, prefix, slash, asset, suffix) => `${prefix}${slash}${asset === 'site.css' ? cssFile : jsFile}${suffix}`));
}
await Promise.all([...output].map(([file, content]) => writeFile(resolve(outputRoot, file), content)));
console.log(`Built ${pages.size} pages. CSS: ${Buffer.byteLength(cssSource)} → ${Buffer.byteLength(css.code)} bytes; JS: ${Object.values(js.metafile.inputs).reduce((total, input) => total + input.bytes, 0)} → ${Buffer.byteLength(js.code)} bytes.`);
