# AvangardautocheckFINAL
Site-ul oficial pentru **Avangard Autocheck** — servicii de inspecție și diagnostic auto profesional (verificare pre-cumpărare, activare funcții ascunse, import auto, etc).

🔗 Live: [avangardautocheck.com](https://avangardautocheck.com)

## Structură

- `index.html` – pagina principală (Home, Servicii, Prețuri, Reviews, Contact)
- `blog.html` – pagina de listare articole blog
- `blog-article.html` – articol principal / featured
- `article-1...5-*.html` – articole individuale de blog
- `*.jpg`, `*.png` – imagini folosite în site (poze mașini, logo)

## Tehnologii

- HTML/CSS/JS simplu, fără framework sau build step
- Fonturi: Google Fonts (Bebas Neue, Rajdhani, Outfit)
- Iconițe: Twemoji (via CDN)
- Găzduire: [Cloudflare Pages](https://pages.cloudflare.com)

## Deploy

Site-ul se publică automat pe Cloudflare Pages la fiecare push pe branch-ul `main`. Nu există pas de build — fișierele HTML sunt servite direct ("static site").

## Editare locală

Poți deschide `index.html` direct în browser pentru preview rapid, dar funcționalitatea de copiere în clipboard (email/telefon din footer) necesită context securizat (HTTPS) pentru a funcționa perfect — testează pe site-ul live sau pe un deployment de preview din Cloudflare Pages, nu doar deschizând fișierul local.

## Contact

- Email: avangardautocheck@gmail.com
- Telefon: 069 448 878
- Instagram: [@verificare_auto](https://www.instagram.com/verificare_auto)
