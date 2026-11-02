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

function setConsent(value) {
  consent = value;
  try { localStorage.setItem(consentKey, value); } catch {}
  if (value === 'granted') {
    initialize();
    if (initialized) {
      window.gtag?.('consent', 'update', googleConsent(true));
      window.fbq?.('consent', 'grant');
    }
  } else {
    window.gtag?.('consent', 'update', googleConsent(false));
    window.fbq?.('consent', 'revoke');
  }
  document.querySelector('#tracking-consent')?.setAttribute('hidden', '');
}

if (enabled) {
  const banner = document.createElement('aside');
  banner.id = 'tracking-consent';
  banner.setAttribute('aria-label', 'Preferințe de confidențialitate');
  banner.hidden = consent === 'granted' || consent === 'denied';
  banner.innerHTML = '<div><strong>Tu alegi ce măsurăm.</strong><p>Cu acordul tău, folosim Google și Meta pentru statistici și reclame. <a href="confidentialitate.html">Detalii</a></p></div><div class="consent-actions"><button type="button" class="button button-outline" data-tracking-choice="denied">Refuz</button><button type="button" class="button button-primary" data-tracking-choice="granted">Accept</button></div>';
  document.body.append(banner);
  banner.querySelectorAll('[data-tracking-choice]').forEach(button => button.addEventListener('click', () => setConsent(button.dataset.trackingChoice)));
  document.querySelectorAll('[data-tracking-settings]').forEach(button => {
    button.hidden = false;
    button.addEventListener('click', () => { banner.hidden = false; banner.querySelector('button').focus(); });
  });
  initialize();
}
document.querySelectorAll('a[href^="tel:"]').forEach(link => link.addEventListener('click', () => trackEvent('phone_click')));
