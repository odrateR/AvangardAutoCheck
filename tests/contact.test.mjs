import test from 'node:test';
import assert from 'node:assert/strict';
import { handleContact } from '../lib/contact.js';

const valid = { name: 'Client Test', email: 'client@example.com', phone: '+373 69000000', service: 'Premium Check', message: 'Verificare automobil', consent: 'on' };
const env = { SMTP_USER: 'sender@example.com', SMTP_PASS: 'test-only-password' };
function request(body = valid, headers = {}, method = 'POST') {
  return new Request('https://avangardautocheck.com/api/contact', {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) })
  });
}

test('sends to the fixed company address with customer Reply-To, only confirming SMTP acceptance', async () => {
  let options, mail, closed = false;
  const response = await handleContact(request(), env, configuration => {
    options = configuration;
    return { sendMail: async value => { mail = value; return { accepted: ['avangardautocheck@gmail.com'] }; }, close: () => { closed = true; } };
  });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).success, true);
  assert.equal(options.port, 465);
  assert.equal(options.secure, true);
  assert.equal(mail.to, 'avangardautocheck@gmail.com');
  assert.deepEqual(mail.replyTo, { name: valid.name, address: valid.email });
  assert.match(mail.text, /Verificare automobil/);
  assert.equal(mail.disableFileAccess, true);
  assert.equal(closed, true);
});

test('does not claim success when SMTP rejects the recipient', async () => {
  const response = await handleContact(request(), env, () => ({ sendMail: async () => ({ accepted: [] }) }));
  assert.equal(response.status, 502);
  assert.equal((await response.json()).success, false);
});

test('SMTP failures return an error without exposing provider details or secrets', async () => {
  const response = await handleContact(request(), env, () => ({ sendMail: async () => { throw new Error('private provider details'); } }));
  assert.equal(response.status, 502);
  assert.doesNotMatch(await response.text(), /private provider details|test-only-password/);
});

test('missing credentials report service unavailable', async () => {
  const response = await handleContact(request(), {});
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});

test('rejects cross-origin submissions and unsupported methods', async () => {
  assert.equal((await handleContact(request(valid, { Origin: 'https://another.example' }), env)).status, 403);
  assert.equal((await handleContact(request(valid, { 'Sec-Fetch-Site': 'cross-site' }), env)).status, 403);
  const response = await handleContact(request(undefined, {}, 'GET'), env);
  assert.equal(response.status, 405);
  assert.equal(response.headers.get('Allow'), 'POST');
});

test('rejects invalid fields, header injection, unrecognized services and missing consent', async () => {
  const invalid = [
    { name: 'a' }, { name: 'Client\r\nBcc: hidden@example.com' },
    { email: 'not-an-email' }, { email: 'a@example.com\r\nBcc:x@example.com' },
    { phone: '------' }, { phone: 'invalid phone' },
    { service: 'arbitrary subject' }, { consent: undefined },
    { message: 'a'.repeat(1801) }, { email: ['client@example.com'] }
  ];
  for (const fields of invalid) {
    const response = await handleContact(request({ ...valid, ...fields }), env);
    assert.equal(response.status, 400, JSON.stringify(fields));
  }
});

test('honors Cloudflare rate limiting before contacting SMTP', async () => {
  let called = false;
  const response = await handleContact(request(), { ...env, CONTACT_RATE_LIMITER: { limit: async () => ({ success: false }) } }, () => { called = true; });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(called, false);
});

test('honeypot submissions never reach SMTP', async () => {
  let called = false;
  const response = await handleContact(request({ ...valid, website: 'spam.example' }), env, () => { called = true; });
  assert.equal(response.status, 200);
  assert.equal(called, false);
});

test('rejects malformed and oversized JSON, including streamed bodies without content-length', async () => {
  assert.equal((await handleContact(new Request('https://example.com/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken' }), env)).status, 400);
  assert.equal((await handleContact(request({ ...valid, message: 'a'.repeat(17000) }), env)).status, 413);
});

test('supports regular form-encoded submissions as well as JavaScript JSON', async () => {
  const response = await handleContact(new Request('https://example.com/api/contact', { method: 'POST', body: new URLSearchParams(valid) }), env, () => ({ sendMail: async () => ({ accepted: ['avangardautocheck@gmail.com'] }) }));
  assert.equal(response.status, 200);
});
