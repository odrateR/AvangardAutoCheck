import './booking.js';
import { bindLeadForm } from './forms.js';

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
let motionPaused = reducedMotion.matches;
try { motionPaused ||= localStorage.getItem('avangard-motion') === 'paused'; } catch {}
const root = document.documentElement;
const motionButtons = document.querySelectorAll('.motion-toggle');
function updateMotion() {
  root.classList.toggle('motion-paused', motionPaused);
  motionButtons.forEach(button => {
    button.setAttribute('aria-pressed', String(motionPaused));
    button.innerHTML = motionPaused ? 'Pornește animațiile <span>▷</span>' : 'Oprește animațiile <span>Ⅱ</span>';
  });
}
updateMotion();
motionButtons.forEach(button => button.addEventListener('click', () => {
  motionPaused = !motionPaused;
  try { localStorage.setItem('avangard-motion', motionPaused ? 'paused' : 'on'); } catch {}
  updateMotion();
}));
reducedMotion.addEventListener('change', event => { motionPaused = event.matches; updateMotion(); });

const header = document.querySelector('.site-header');
const menuButton = document.querySelector('.menu-toggle');
const menu = document.querySelector('#main-nav');
const navigationLinks = menu?.querySelectorAll('a') || [];
function closeMenu(restoreFocus = false) {
  menuButton?.setAttribute('aria-expanded', 'false');
  menuButton?.setAttribute('aria-label', 'Deschide meniul');
  menu?.classList.remove('is-open');
  document.body.classList.remove('menu-open');
  if (restoreFocus) menuButton?.focus();
}
menuButton?.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') !== 'true';
  menuButton.setAttribute('aria-expanded', String(open));
  menuButton.setAttribute('aria-label', open ? 'Închide meniul' : 'Deschide meniul');
  menu.classList.toggle('is-open', open); document.body.classList.toggle('menu-open', open);
});
navigationLinks.forEach(link => link.addEventListener('click', () => closeMenu()));
document.addEventListener('keydown', event => {
  if (menuButton?.getAttribute('aria-expanded') !== 'true') return;
  if (event.key === 'Escape') closeMenu(true);
  if (event.key === 'Tab') {
    const first = navigationLinks[0];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); menuButton.focus(); }
    else if (!event.shiftKey && document.activeElement === menuButton) { event.preventDefault(); first.focus(); }
  }
});
matchMedia('(min-width: 641px)').addEventListener('change', event => { if (event.matches) closeMenu(); });
let ticking = false;
const heroPhoto = document.querySelector('.hero-photo img');
const hero = document.querySelector('.hero');
const progress = document.querySelector('.scroll-progress');
function renderScroll() {
  const y = window.scrollY;
  const range = document.documentElement.scrollHeight - innerHeight;
  const parallax = heroPhoto && !motionPaused && innerWidth > 640 && y < hero.offsetHeight;
  // Read layout before updating classes and transforms.
  header?.classList.toggle('scrolled', y > 100);
  if (progress) progress.style.transform = `scaleX(${range > 0 ? Math.min(1, y / range) : 0})`;
  if (parallax) heroPhoto.style.transform = `translateY(${y * .15}px) scale(1.055)`;
  ticking = false;
}
window.addEventListener('scroll', () => { if (!ticking) { requestAnimationFrame(renderScroll); ticking = true; } }, { passive: true });
renderScroll();

if ('IntersectionObserver' in window && !motionPaused) {
  root.classList.add('js-motion');
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) { entry.target.classList.remove('pending'); observer.unobserve(entry.target); }
  }), { threshold: .08, rootMargin: '0px 0px 25px 0px' });
  document.querySelectorAll('.reveal').forEach(element => { element.classList.add('pending'); observer.observe(element); });
}
if ('IntersectionObserver' in window) {
  const navigationObserver = new IntersectionObserver(entries => entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    navigationLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === '#' + entry.target.id));
  }), { rootMargin: '-15% 0px -60% 0px' });
  document.querySelectorAll('main section[id]').forEach(section => navigationObserver.observe(section));
}

const serviceItems = document.querySelectorAll('.service-item');
serviceItems.forEach(item => item.addEventListener('toggle', () => {
  if (item.open) serviceItems.forEach(other => { if (other !== item) other.open = false; });
}));
const systems = [
  { label: 'CE SE AFLĂ SUB CAPOTĂ', title: 'Motor &<br> transmisie', description: 'Verificăm motorul, transmisia și semnele de uzură care pot anunța reparații costisitoare.', checks: ['Funcționare, scurgeri și sistem de răcire', 'Turbo și componente principale', 'Cutie de viteze, zgomote și uzură', 'Test de performanță, unde este disponibil'] },
  { label: 'POVESTEA DIN SPATELE VOPSELEI', title: 'Caroserie &<br> vopsea', description: 'O suprafață impecabilă poate ascunde reparații. Măsurăm, comparăm și căutăm urmele pe care o simplă privire le ratează.', checks: ['Grosimea stratului de vopsea', 'Elemente revopsite sau înlocuite', 'Deformări, reparații și urme de accident', 'Documentare fotografică a problemelor'] },
  { label: 'DATELE COMPLETEAZĂ IMAGINEA', title: 'Electronică &<br> interior', description: 'Conectăm diagnoza și punem dotările la încercare. Corelăm erorile înregistrate cu starea reală a mașinii.', checks: ['Diagnoză OBD, ECU și kilometraj memorat', 'Climatizare, multimedia și comenzi', 'Geamuri, oglinzi, lumini și sisteme electrice', 'Tapițerie, bord și starea interiorului'] },
  { label: 'BAZA UNEI MAȘINI SIGURE', title: 'Șasiu &<br> siguranță', description: 'Verificăm ceea ce ține mașina pe drum. De la articulații la frâne, fiecare detaliu contribuie la evaluarea tehnică.', checks: ['Suspensie, amortizoare, bucșe și rulmenți', 'Frâne, discuri, plăcuțe și direcție', 'Anvelope, jante, profil, DOT și presiune', 'Verificare pe elevator și test drive'] }
];
const inspectionPanel = document.querySelector('#inspection-panel');
const inspectionButtons = document.querySelectorAll('[data-inspection]');
const inspectionTabs = document.querySelectorAll('.inspection-tabs [role=tab]');
function selectSystem(index, focusTab = false) {
  if (!inspectionPanel) return;
  const system = systems[index];
  inspectionButtons.forEach(button => {
    const active = Number(button.dataset.inspection) === index;
    button.classList.toggle('active', active);
    if (button.getAttribute('role') === 'tab') { button.setAttribute('aria-selected', String(active)); button.tabIndex = active ? 0 : -1; }
    else button.setAttribute('aria-pressed', String(active));
  });
  inspectionPanel.setAttribute('aria-labelledby', 'tab-' + index);
  inspectionPanel.innerHTML = `<p class="eyebrow panel-label">${system.label}</p><h3>${system.title}</h3><p class="panel-description">${system.description}</p><ul class="check-list">${system.checks.map(check => `<li>${check}</li>`).join('')}</ul>`;
  const parent = inspectionPanel.parentElement;
  parent.classList.remove('panel-change'); requestAnimationFrame(() => parent.classList.add('panel-change'));
  if (focusTab) inspectionTabs[index].focus();
}
inspectionButtons.forEach(button => button.addEventListener('click', () => selectSystem(Number(button.dataset.inspection))));
document.querySelector('.inspection-tabs')?.addEventListener('keydown', event => {
  let index = Number(event.target.dataset.inspection);
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  if (event.key === 'Home') index = 0; else if (event.key === 'End') index = 3; else index = (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4;
  selectSystem(index, true);
});
const serviceSelect = document.querySelector('#service-select');
document.querySelectorAll('[data-service]').forEach(link => link.addEventListener('click', () => {
  if (serviceSelect) serviceSelect.value = link.dataset.service;
}));
const reviews = [
  { quote: '„Am verificat 3 mașini până să găsesc una bună. Banii sunt foarte bine investiți pentru siguranța ta!”', author: 'Andrei T.' },
  { quote: '„Am cumpărat un BMW second-hand și m-am bucurat că am apelat la Avangard. Au descoperit probleme pe care vânzătorul le ascundea.”', author: 'Alexandru M.' },
  { quote: '„Raportul a fost foarte detaliat cu fotografii și explicații clare. Am negociat prețul mașinii cu 2000 EUR mai jos datorită raportului lor.”', author: 'Maria P.' }
];
let reviewIndex = 0;
const reviewQuote = document.querySelector('#review-quote');
const reviewAuthor = document.querySelector('#review-author');
const reviewCounter = document.querySelector('#review-index');
document.querySelectorAll('[data-review]').forEach(button => button.addEventListener('click', () => {
  reviewIndex = (reviewIndex + Number(button.dataset.review) + reviews.length) % reviews.length;
  reviewQuote.textContent = reviews[reviewIndex].quote;
  reviewAuthor.innerHTML = reviews[reviewIndex].author + ' <small>— recenzie de pe site-ul Avangard</small>';
  reviewCounter.textContent = `0${reviewIndex + 1} / 03`;
}));
bindLeadForm(document.querySelector('#contact-form'));

const voucherButton = document.querySelector('.vin-voucher');
const voucherStatus = document.querySelector('.vin-copy-status');
voucherButton?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(voucherButton.dataset.copy);
    voucherStatus.textContent = 'Cod copiat: AVANGARD';
  } catch {
    voucherStatus.textContent = 'Copiază manual codul: AVANGARD';
  }
});

// Preserve the original affiliate attribution and forward the vehicle for tracking.
// carVertical performs the actual lookup on its own site.
const vinForm = document.querySelector('#vin-affiliate-form');
const vinInput = document.querySelector('#vin-affiliate-input');
const vinError = document.querySelector('#vin-error');
vinInput?.addEventListener('input', () => {
  vinInput.setCustomValidity('');
  vinInput.removeAttribute('aria-invalid');
  vinError.hidden = true;
});
vinForm?.addEventListener('submit', event => {
  const vehicle = vinInput.value.trim().toUpperCase().replace(/[\s-]+/g, '');
  if (!/^[A-Z0-9]{3,17}$/.test(vehicle) || (vehicle.length === 17 && /[IOQ]/.test(vehicle))) {
    event.preventDefault();
    vinError.textContent = 'Introdu un VIN valid de 17 caractere sau numărul de înmatriculare.';
    vinError.hidden = false;
    vinInput.setAttribute('aria-invalid', 'true');
    vinInput.setCustomValidity(vinError.textContent);
    vinInput.reportValidity();
    return;
  }
  vinInput.value = vehicle;
});

const filterButtons = document.querySelectorAll('[data-filter]');
const articleCards = document.querySelectorAll('[data-category]');
const filterStatus = document.querySelector('#filter-status');
filterButtons.forEach(button => button.addEventListener('click', () => {
  const filter = button.dataset.filter;
  filterButtons.forEach(other => other.setAttribute('aria-pressed', String(other === button)));
  let count = 0;
  articleCards.forEach(card => {
    card.hidden = filter !== 'all' && card.dataset.category !== filter;
    if (!card.hidden) count++;
  });
  if (filterStatus) filterStatus.textContent = `${count} articole afișate`;
}));
document.querySelectorAll('[data-year]').forEach(element => element.textContent = new Date().getFullYear());
