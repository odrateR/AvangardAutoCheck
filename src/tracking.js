import settings from '../content/tracking.json';

// Public IDs only. Empty IDs keep all advertising and analytics scripts disabled.
const metaId = /^\d+$/.test(settings.metaPixelId) ? settings.metaPixelId : '';
const adsId = /^AW-\d+$/.test(settings.googleAdsId) ? settings.googleAdsId : '';
const analyticsId = /^G-[A-Z0-9]+$/.test(settings.ga4MeasurementId) ? settings.ga4MeasurementId : '';
const enabled = Boolean(metaId || adsId || analyticsId);
const consentKey = 'avangard-tracking-consent-v1';
let consent = null;
let initialized = false;
try { consent = localStorage.getItem(consentKey); } catch {}

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
  if (adsId || analyticsId) {
    window.dataLayer ||= [];
    window.gtag = function () { window.dataLayer.push(arguments); };
    window.gtag('consent', 'default', googleConsent(false));
    window.gtag('consent', 'update', googleConsent(true));
    window.gtag('js', new Date());
    // Send only the canonical path; query strings may contain personal information.
    window.gtag('set', { page_location: location.origin + location.pathname, page_referrer: '', allow_enhanced_conversions: false });
    if (adsId) window.gtag('config', adsId, { allow_enhanced_conversions: false });
    if (analyticsId) window.gtag('config', analyticsId, { allow_google_signals: false, allow_ad_personalization_signals: false });
    loadScript('https://www.googletagmanager.com/gtag/js?id=' + (adsId || analyticsId));
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
  const providers = [adsId || analyticsId ? 'Google' : '', metaId ? 'Meta' : ''].filter(Boolean).join(' și ');
  const banner = document.createElement('aside');
  let settingsOpener;
  banner.id = 'tracking-consent';
  banner.setAttribute('aria-labelledby', 'tracking-consent-title');
  banner.hidden = consent === 'granted' || consent === 'denied';
  banner.innerHTML = `<h2 id="tracking-consent-title">Preferințe cookie</h2>
    <p>Cu acordul tău, folosim ${providers} pentru a măsura vizitele și rezultatele reclamelor.</p>
    <div class="consent-actions">
      <button type="button" data-tracking-choice="denied">Refuz</button>
      <button type="button" data-tracking-choice="granted">Accept</button>
    </div>
    <a href="/confidentialitate">Politica de confidențialitate</a>`;
  document.body.append(banner);
  function closeSettings() {
    banner.hidden = true;
    settingsOpener?.focus({ preventScroll: true });
    settingsOpener = undefined;
  }
  banner.querySelectorAll('[data-tracking-choice]').forEach(button => button.addEventListener('click', () => {
    const value = button.dataset.trackingChoice;
    try { localStorage.setItem(consentKey, value); } catch {}
    applyConsent(value);
    closeSettings();
  }));
  banner.addEventListener('keydown', event => {
    if (event.key === 'Escape' && settingsOpener) closeSettings();
  });
  document.querySelectorAll('[data-tracking-settings]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => {
      settingsOpener = button;
      banner.hidden = false;
      banner.querySelector('[data-tracking-choice="denied"]').focus({ preventScroll: true });
    });
  });
  function syncConsent() {
    try { applyConsent(localStorage.getItem(consentKey)); } catch {}
    if (!settingsOpener) banner.hidden = consent === 'granted' || consent === 'denied';
  }
  window.addEventListener('storage', event => {
    if (event.storageArea === localStorage && (event.key === consentKey || event.key === null)) syncConsent();
  });
  window.addEventListener('pageshow', event => { if (event.persisted) syncConsent(); });
  initialize();
}
document.querySelectorAll('a[href^="tel:"]').forEach(link => link.addEventListener('click', () => trackEvent('phone_click')));
