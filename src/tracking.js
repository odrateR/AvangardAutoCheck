import settings from '../content/tracking.json';
import { localizedPath, text } from './i18n.js';

// Public IDs only. Empty IDs keep all advertising and analytics scripts disabled.
const metaId = /^\d+$/.test(settings.metaPixelId) ? settings.metaPixelId : '';
const tagManagerId = /^GTM-[A-Z0-9]+$/.test(settings.googleTagManagerId) ? settings.googleTagManagerId : '';
const adsId = /^AW-\d+$/.test(settings.googleAdsId) ? settings.googleAdsId : '';
const analyticsId = /^G-[A-Z0-9]+$/.test(settings.ga4MeasurementId) ? settings.ga4MeasurementId : '';
const googleEnabled = Boolean(tagManagerId || adsId || analyticsId);
const enabled = Boolean(metaId || googleEnabled);
const consentKey = 'avangard-tracking-consent-v2';
const previousConsentKey = 'avangard-tracking-consent-v1';
let consent = null;
let initialized = false;

function readConsent() {
  // Preserve opt-outs, but ask again before loading the newly added Google container.
  return localStorage.getItem(consentKey) ?? (localStorage.getItem(previousConsentKey) === 'denied' ? 'denied' : null);
}
try { consent = readConsent(); } catch {}

const googleConsent = granted => ({
  ad_storage: granted ? 'granted' : 'denied',
  ad_user_data: granted ? 'granted' : 'denied',
  ad_personalization: granted ? 'granted' : 'denied',
  analytics_storage: granted ? 'granted' : 'denied'
});
function loadScript(src) {
  const script = document.createElement('script');
  script.async = true;
  script.src = src;
  document.head.append(script);
}
function initialize() {
  if (!enabled || initialized || consent !== 'granted') return;
  initialized = true;
  if (googleEnabled) {
    window.dataLayer ||= [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', googleConsent(false));
    window.gtag('consent', 'update', googleConsent(true));
    window.gtag('js', new Date());
    // Send only the canonical path; query strings may contain personal information.
    window.gtag('set', { page_location: location.origin + location.pathname, page_referrer: '', allow_enhanced_conversions: false });
    if (tagManagerId) {
      // The published container configures its Google destinations.
      loadScript('https://www.googletagmanager.com/gtm.js?id=' + tagManagerId);
    } else {
      if (adsId) window.gtag('config', adsId, { allow_enhanced_conversions: false });
      if (analyticsId) window.gtag('config', analyticsId, { allow_google_signals: false, allow_ad_personalization_signals: false });
      loadScript('https://www.googletagmanager.com/gtag/js?id=' + (adsId || analyticsId));
    }
  }
  if (metaId) {
    const fbq = window.fbq = function () { fbq.callMethod ? fbq.callMethod.apply(fbq, arguments) : fbq.queue.push(arguments); };
    window._fbq = fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.queue = [];
    fbq('consent', 'grant');
    fbq('set', 'autoConfig', false, metaId);
    fbq('init', metaId);
    fbq('track', 'PageView');
    loadScript('https://connect.facebook.net/en_US/fbevents.js');
  }
}

export function trackEvent(event, details = {}) {
  if (!enabled || consent !== 'granted') return;
  // An explicit allowlist prevents names, phone numbers and messages entering pixels.
  const payload = { source: details.source || 'website' };
  if (typeof details.service === 'string') payload.service = details.service;
  try {
    if (analyticsId) window.gtag?.('event', event, { ...payload, send_to: analyticsId });
    if (event === 'generate_lead') {
      if (tagManagerId) window.dataLayer.push({ event: 'lead_form_submit' });
      if (adsId && settings.googleAdsLeadLabel) window.gtag?.('event', 'conversion', { send_to: `${adsId}/${settings.googleAdsLeadLabel}` });
      window.fbq?.('track', 'Lead', { content_name: payload.service || 'Solicitare de apel', content_category: payload.source });
    } else if (event === 'phone_click') window.fbq?.('trackCustom', 'PhoneClick', payload);
    else if (event === 'booking_open') window.fbq?.('trackCustom', 'BookingOpen', payload);
  } catch { /* Tracking must never interrupt booking or contact submission. */ }
}

function applyConsent(value) {
  if (value === consent) return;
  consent = value;
  if (!initialized) {
    initialize();
    return;
  }
  const granted = value === 'granted';
  window.gtag?.('consent', 'update', googleConsent(granted));
  window.fbq?.('consent', granted ? 'grant' : 'revoke');
}

if (enabled) {
  const providers = [googleEnabled ? 'Google' : '', metaId ? 'Meta' : ''].filter(Boolean).join(text(' și '));
  const withProviders = value => text(value).replace('{providers}', providers);
  const dialog = document.createElement('dialog');
  let opener;
  dialog.id = 'tracking-consent';
  dialog.setAttribute('aria-labelledby', 'tracking-consent-title');
  dialog.innerHTML = `<div class="consent-heading"><h2 id="tracking-consent-title" tabindex="-1">${text('Folosim cookie-uri')}</h2></div>
    <div data-consent-choices>
      <p>${withProviders('Cookie-urile necesare ajută site-ul să funcționeze. Cu acordul tău, {providers} măsoară vizitele și rezultatele reclamelor. Poți schimba alegerea din „Preferințe cookie”, în subsol.')}</p>
      <a class="consent-privacy" href="${localizedPath('/confidentialitate')}">${text('Politica de confidențialitate')}</a>
      <div class="consent-actions">
        <button type="button" data-consent-settings>${text('Setări cookie-uri')}</button>
        <div class="consent-choices">
          <button type="button" data-tracking-choice="denied">${text('Acceptă doar necesare')}</button>
          <button type="button" class="consent-primary" data-tracking-choice="granted">${text('Acceptă toate')}</button>
        </div>
      </div>
    </div>
    <div data-consent-preferences hidden>
      <div class="consent-category">
        <strong>${text('Necesare')}</strong>
        <span>${text('Mereu active')}</span>
        <p>${text('Permit funcționarea site-ului și memorarea alegerii tale.')}</p>
      </div>
      <label class="consent-category">
        <strong id="consent-optional-title">${text('Statistici și publicitate')}</strong>
        <input type="checkbox" aria-labelledby="consent-optional-title" aria-describedby="consent-optional-description" data-consent-optional>
        <span id="consent-optional-description">${withProviders('Permite măsurarea vizitelor și rezultatelor reclamelor prin {providers}.')}</span>
      </label>
      <div class="consent-actions">
        <button type="button" data-consent-back>${text('Înapoi')}</button>
        <button type="button" class="consent-primary" data-consent-save>${text('Salvează preferințele')}</button>
      </div>
    </div>`;
  const languageSwitcher = document.querySelector('[data-language-switcher]');
  if (languageSwitcher) dialog.querySelector('.consent-heading').append(languageSwitcher.cloneNode(true));
  document.body.append(dialog);
  const title = dialog.querySelector('#tracking-consent-title');
  const choices = dialog.querySelector('[data-consent-choices]');
  const preferences = dialog.querySelector('[data-consent-preferences]');
  const optional = dialog.querySelector('[data-consent-optional]');
  const isPrivacyPage = location.pathname.replace(/(?:\.html)?\/?$/, '') === localizedPath('/confidentialitate');
  const hasChoice = () => consent === 'granted' || consent === 'denied';

  function openDialog(showPreferences = false) {
    title.textContent = text(showPreferences ? 'Setări cookie-uri' : 'Folosim cookie-uri');
    choices.hidden = showPreferences;
    preferences.hidden = !showPreferences;
    if (showPreferences) optional.checked = consent === 'granted';
    if (!dialog.open) dialog.showModal();
    title.focus({ preventScroll: true });
  }
  function closeDialog() {
    dialog.close();
    opener?.focus({ preventScroll: true });
    opener = undefined;
  }
  function saveChoice(value) {
    try { localStorage.setItem(consentKey, value); } catch {}
    applyConsent(value);
    closeDialog();
  }

  dialog.querySelectorAll('[data-tracking-choice]').forEach(button => {
    button.addEventListener('click', () => saveChoice(button.dataset.trackingChoice));
  });
  dialog.querySelector('[data-consent-settings]').addEventListener('click', () => openDialog(true));
  dialog.querySelector('[data-consent-back]').addEventListener('click', () => openDialog());
  dialog.querySelector('[data-consent-save]').addEventListener('click', () => saveChoice(optional.checked ? 'granted' : 'denied'));
  dialog.addEventListener('cancel', event => {
    event.preventDefault();
    if (hasChoice()) closeDialog();
    else saveChoice('denied');
  });
  document.querySelectorAll('[data-tracking-settings]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      opener = button;
      openDialog();
    });
  });
  function syncConsent() {
    try { applyConsent(readConsent()); } catch {}
    if (opener) optional.checked = consent === 'granted';
    else if (hasChoice()) closeDialog();
    else if (!dialog.open && !isPrivacyPage) openDialog();
  }
  window.addEventListener('storage', event => {
    if (event.storageArea === localStorage && [consentKey, previousConsentKey, null].includes(event.key)) syncConsent();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) syncConsent(); });
  if (!hasChoice() && !isPrivacyPage) openDialog();
  initialize();
}
document.querySelectorAll('a[href^="tel:"]').forEach(link => link.addEventListener('click', () => trackEvent('phone_click')));
