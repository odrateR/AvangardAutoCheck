# Avangard Autocheck

Site static în limba română pentru inspecții auto, pregătit pentru GitHub și Vercel. HTML-ul, imaginile, fonturile și JavaScript-ul necesar sunt incluse în repository. Trimiterea cererilor folosește un endpoint Node.js și Nodemailer pentru Gmail SMTP.

## Rulare locală

Necesită Node.js 20 sau mai nou.

```powershell
npm install
npm start
```

Deschide http://localhost:4173. Generează blogul, cele șase articole, pagina de confidențialitate și fișierele SEO cu:

```powershell
npm run build
```

## GitHub

Repository-ul local este inițializat pe ramura `main`. Creează un repository gol pe GitHub, apoi leagă-l și trimite primul commit:

```powershell
git remote add origin https://github.com/NUME-UTILIZATOR/NUME-REPOSITORY.git
git push -u origin main
```

Înlocuiește URL-ul cu cel afișat de GitHub. Alege vizibilitatea repository-ului în funcție de cine vrei să poată vedea codul.

## Vercel

Importă repository-ul GitHub în Vercel. Rădăcina proiectului este chiar rădăcina repository-ului. `vercel.json` selectează explicit preset-ul **Other** prin `"framework": null`, setează build command-ul `npm run build` și directorul de publicare `dist`. Paginile sunt servite static, iar `api/contact.js` rulează ca funcție Vercel. `server.mjs` oferă aceeași rută pentru dezvoltare locală. După primul deploy, Vercel va afișa adresa site-ului.

Dacă un deploy existent afișează `500 FUNCTION_INVOCATION_FAILED`, verifică în **Settings → Build and Deployment** că rădăcina proiectului conține acest `vercel.json`, preset-ul este **Other**, build command-ul este `npm run build`, iar output directory este `dist`. Trimite configurația actualizată pe GitHub pentru a declanșa un deploy nou. Dacă eroarea persistă, consultă **Logs** pentru excepția exactă; codul de eroare singur nu identifică motivul.

`sitemap.xml` și `robots.txt` folosesc ca adresă implicită `https://avangardautocheck.com`. Dacă publici întâi pe domeniul `.vercel.app`, setează variabila de build `PUBLIC_SITE_URL` în project settings cu adresa publică Vercel și redeployează. Când domeniul propriu este conectat, seteaz-o la domeniul canonic, de exemplu `https://www.avangardautocheck.com`.

## Conținut și contact

- `dist/` conține pagina principală, blogul și cele șase pagini de articol, precum și imaginile și fonturile servite local.
- `content/articles.json` păstrează conținutul de bază pentru articole. Modifică-l și rulează din nou `npm run build`.
- Formularul păstrează câmpurile originale (`name`, `email`, `phone`, `service`, `message`) și trimite cererea prin `POST /api/contact`. Serverul validează datele și trimite emailul către `avangardautocheck@gmail.com`. Adresa clientului este setată ca Reply-To. Confirmarea apare doar după acceptarea de către serverul SMTP.
- Domeniul `avangardautocheck.com` nu este schimbat de acest repository. După publicare, conectarea domeniului se face separat din setările Vercel și DNS.

## Licență și materiale

Fotografiile și siglele partenerilor păstrate în proiect provin din site-ul public Avangard Autocheck. Înainte să publici un repository public, verifică dacă ai dreptul să redistribui fiecare asset. `.gitignore` exclude notițele și descărcările folosite la audit.

## Activarea trimiterii emailurilor

În Vercel → Settings → Environment Variables, configurează `SMTP_USER` (adresa Gmail folosită pentru expediere) și `SMTP_PASS` (o parolă de aplicație Gmail), apoi fă un redeploy. Valorile sunt secrete de server; nu le introduce în HTML, JavaScript din `dist/`, GitHub sau `.env.example`. Fișierul `.env.example` conține doar numele variabilelor. Nu este necesară nicio parolă Gmail pentru vizitatori.

Formularul original apela `send_email_gmail.php`. Codul PHP necesită găzduire PHP și nu este executat de Vercel sau de o găzduire statică. Ruta Node.js inclusă înlocuiește această parte, păstrând aceleași date și destinația emailului. Previzualizarea statică ChatGPT Sites nu execută ruta Node.js din `api/`; trimiterea directă este disponibilă în deploy-ul Vercel după configurarea SMTP.

Fără variabilele SMTP, endpointul răspunde cu 503 și formularul nu afișează succes. În caz de eroare, datele introduse rămân în formular. Un răspuns SMTP de acceptare confirmă predarea mesajului, nu plasarea în inbox; verifică și Spam. Pentru dezvoltare locală, exportă variabilele în mediul procesului înainte de `npm start`.

Rulează `npm run check` și `npm test` pentru verificări. Testele folosesc un transport simulat și nu trimit emailuri.
