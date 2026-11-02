# Booking and advertising measurement

The quick booking modal collects only a name and phone number. Its hidden
service field preserves the selected offer. It uses `/api/contact`, the same
Resend delivery and rate limiting as the detailed contact form. Email remains
required for the detailed form; callback requests do not need an email.

## Add account IDs later

Edit `content/tracking.json` and rebuild:

```json
{
  "metaPixelId": "123456789012345",
  "googleAdsId": "AW-123456789",
  "googleAdsLeadLabel": "YOUR_CONVERSION_LABEL",
  "ga4MeasurementId": "G-YOURMEASUREMENTID"
}
```

All values currently stay empty. Empty or invalid account IDs do not load
Google or Meta scripts. No cookie banner appears until at least one valid ID
is configured. IDs are public identifiers; never put account access tokens
or API secrets in this file. GA4 is optional. Google Ads lead conversion
tracking needs both the Ads ID and the conversion action label.

When configured, visitors can accept or decline measurement. Scripts only
load after acceptance. The footer's “Preferințe cookie” button reopens the
choice. Consent is stored locally; revocation updates Google's four consent
signals and revokes Meta consent. Events collected before consent are not
replayed later.

## Events

| Action | GA4 | Meta | Google Ads |
| --- | --- | --- | --- |
| Open booking | `booking_open` | Custom `BookingOpen` | — |
| Tap a phone link | `phone_click` | Custom `PhoneClick` | — |
| Server accepts either contact form | `generate_lead` | Standard `Lead` | `conversion`, using the configured label |

Only a successful API response records a lead. Opening the modal, invalid
input, pending requests and failed delivery do not record conversions. A phone
click measures intent to call, not a completed call. We send only the service
and form source; names, phone numbers, email addresses and message text are
excluded. Automatic Meta configuration and enhanced conversions are disabled.
Do not also configure a second Google Ads conversion for the same GA4 lead
unless you intentionally want separate conversion actions.

Implementation references: [Google tag API](https://developers.google.com/tag-platform/gtagjs/reference),
[Google consent mode](https://developers.google.com/tag-platform/security/guides/consent),
[Meta Pixel](https://developers.facebook.com/docs/meta-pixel/get-started/).

## Local review

Run `npm run dev` and visit `http://127.0.0.1:4173`. A local callback request
needs the existing Resend secret in `.dev.vars` to deliver real email. Browser
tests intercept delivery and advertising scripts; they do not send real leads
or report real conversions.

Run `npm run check`, `npm test` and `npm run test:browser`. Tests cover the
two-field callback API, server failures, responsive layouts, reduced viewport
height, consent and conversion events. The modal follows `visualViewport`
height and offset when the keyboard opens. A real iPhone/Android keyboard
check is still useful before publishing.
