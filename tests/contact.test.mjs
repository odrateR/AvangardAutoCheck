import test from 'node:test';
import assert from 'node:assert/strict';
import { handleContact } from '../lib/contact.js';
import { onRequest } from '../functions/api/contact.js';
import worker from '../worker.js';

const valid = { name: 'Client Test', email: 'client@example.com', phone: '+373 69000000', service: 'Premium Check', message: 'Verificare automobil', consent: 'on' };
const env = { RESEND_API_KEY: 're_test_only_key' };
const accepted = () => Response.json({ id: 'test-message-id' });
function request(body = valid, headers = {}, method = 'POST') {
  return new Request('https://avangardautocheck.com/api/contact', {
    method, headers: { 'Content-Type': 'application/json', ...headers },
    ...(method === 'GET' ? {} : { body: JSON.stringify(body) })
  });
}

test('sends through Resend with the verified sender, fixed recipient and customer Reply-To', async () => {
  let destination, options, mail;
  const response = await handleContact(request({ ...valid, to: 'other@example.com', from: 'spoof@example.com' }), env, async (url, configuration) => {
    destination = url;
    options = configuration;
    mail = JSON.parse(configuration.body);
    return accepted();
  });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.success, true);
  assert.doesNotMatch(JSON.stringify(body), /re_test_only_key/);
  assert.equal(destination, 'https://api.resend.com/emails');
  assert.equal(options.method, 'POST');
  assert.equal(options.headers.Authorization, `Bearer ${env.RESEND_API_KEY}`);
  assert.equal(options.headers['Content-Type'], 'application/json');
  assert.equal(options.redirect, 'manual');
  assert.ok(options.signal instanceof AbortSignal);
  assert.equal(mail.from, 'Avangard Autocheck <website@avangardautocheck.com>');
  assert.deepEqual(mail.to, ['avangardautocheck@gmail.com']);
  assert.equal(mail.reply_to, valid.email);
  assert.match(mail.subject, /Premium Check/);
  assert.match(mail.text, /Client Test/);
  assert.match(mail.text, /Verificare automobil/);
});

test('supports a sender on a separately verified domain and trims configuration', async () => {
  const response = await handleContact(request(), { RESEND_API_KEY: ' re_test_only_key ', RESEND_FROM_EMAIL: ' website@mail.avangardautocheck.com ' }, async (_url, options) => {
    assert.equal(options.headers.Authorization, 'Bearer re_test_only_key');
    assert.equal(JSON.parse(options.body).from, 'Avangard Autocheck <website@mail.avangardautocheck.com>');
    return accepted();
  });
  assert.equal(response.status, 200);
});

test('callback requests deliver a name and phone without inventing an email address', async () => {
  const callback = { type: 'callback', name: 'Client Test', phone: '+373 69448878', service: 'Premium Check', consent: 'on' };
  let mail;
  const response = await handleContact(request(callback), env, async (_url, options) => {
    mail = JSON.parse(options.body);
    return accepted();
  });
  assert.equal(response.status, 200);
  assert.equal(mail.reply_to, undefined);
  assert.match(mail.subject, /Solicitare de apel/);
  assert.match(mail.text, /Telefon: \+373 69448878/);
  assert.doesNotMatch(mail.text, /Email:/);
  assert.deepEqual(mail.to, ['avangardautocheck@gmail.com']);
});

test('callback validation preserves consent, service, phone and injection protections', async () => {
  const callback = { type: 'callback', name: 'Client Test', phone: '069448878', service: 'Premium Check', consent: 'on' };
  for (const fields of [{ name: 'a' }, { name: 'Client\r\nBcc:x@example.com' }, { phone: '------' }, { phone: 'abc123456' }, { phone: '12345' }, { consent: undefined }, { service: 'unknown' }, { email: 'invalid' }, { type: 'unknown' }, { name: ['Client Test'] }]) {
    let sent = false;
    const response = await handleContact(request({ ...callback, ...fields }), env, async () => { sent = true; return accepted(); });
    assert.equal(response.status, 400, JSON.stringify(fields));
    assert.equal(sent, false);
  }
});

test('callbacks use the same rate limit and preserve delivery failure responses', async () => {
  const callback = { type: 'callback', name: 'Client Test', phone: '+373 (69) 448-878', service: 'Premium Check', consent: 'on' };
  let key;
  const response = await handleContact(request(callback), { ...env, CONTACT_RATE_LIMITER: { limit: async options => { key = options.key; return { success: false }; } } }, async () => { throw new Error('Must not send'); });
  assert.equal(response.status, 429);
  assert.equal(key, '37369448878');
  assert.equal((await handleContact(request(callback), {})).status, 503);
  assert.equal((await handleContact(request({ ...callback, type: undefined }), env)).status, 400);
});

test('provider redirects and rejections never report success or expose provider details', async () => {
  for (const status of [301, 302, 307, 308, 401, 403, 422, 429, 500]) {
    const response = await handleContact(request(), env, async () => Response.json({ id: 'not-accepted', message: 'private provider details re_test_only_key' }, { status }));
    assert.equal(response.status, 502);
    const body = await response.json();
    assert.equal(body.success, false);
    assert.doesNotMatch(body.message, /private provider details|re_test_only_key/);
  }
});

test('requires a successful Resend response containing an email ID', async () => {
  for (const body of [{}, { id: '' }, { id: ' ' }, { id: 1 }, null]) {
    const response = await handleContact(request(), env, async () => Response.json(body));
    assert.equal(response.status, 502);
    assert.equal((await response.json()).success, false);
  }
  const response = await handleContact(request(), env, async () => new Response('not JSON'));
  assert.equal(response.status, 502);
});

test('network failures and timeouts return a safe error', async () => {
  for (const error of [new Error('private provider details re_test_only_key'), new DOMException('Request timed out', 'TimeoutError')]) {
    const response = await handleContact(request(), env, async () => { throw error; });
    assert.equal(response.status, 502);
    assert.doesNotMatch(await response.text(), /private provider details|re_test_only_key|Request timed out/);
  }
});

test('delivery diagnostics identify failures without logging secrets or customer data', async t => {
  const logs = [];
  t.mock.method(console, 'error', (...args) => { logs.push(args); });
  const cases = [
    { send: async () => Response.json({ name: 'validation_error', message: 'private provider details re_test_only_key client@example.com' }, { status: 401 }), expected: { stage: 'response', status: 401, reason: 'validation_error' } },
    { send: async () => Response.json({ name: 're_test_only_key', message: 'private provider details' }, { status: 403 }), expected: { stage: 'response', status: 403, reason: 'provider_rejected' } },
    { send: async () => new Response('private provider details', { status: 502 }), expected: { stage: 'response', status: 502, reason: 'invalid_response' } },
    { send: async () => Response.json({}), expected: { stage: 'response', status: 200, reason: 'missing_email_id' } },
    { send: async () => { throw new Error('private provider details re_test_only_key'); }, expected: { stage: 'request', status: null, reason: 'request_failed' } },
    { send: async () => { throw new DOMException('private provider details', 'TimeoutError'); }, expected: { stage: 'request', status: null, reason: 'timeout' } }
  ];
  for (const { send, expected } of cases) {
    assert.equal((await handleContact(request(), env, send)).status, 502);
    assert.deepEqual(logs.at(-1), ['Contact delivery failed: RESEND_DELIVERY_FAILED', expected]);
  }
  assert.doesNotMatch(JSON.stringify(logs), /private provider details|re_test_only_key|client@example.com|Client Test|Verificare automobil/);
});

test('missing or empty API keys report unavailable without contacting Resend', async () => {
  for (const configuration of [{}, { RESEND_API_KEY: '' }, { RESEND_API_KEY: '  ' }]) {
    let called = false;
    const response = await handleContact(request(), configuration, async () => { called = true; return accepted(); });
    assert.equal(response.status, 503);
    assert.equal((await response.json()).success, false);
    assert.equal(called, false);
  }
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

test('honors Cloudflare rate limiting before contacting Resend', async () => {
  let called = false;
  const response = await handleContact(request(), { ...env, CONTACT_RATE_LIMITER: { limit: async () => ({ success: false }) } }, () => { called = true; });
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('Retry-After'), '60');
  assert.equal(called, false);
});

test('honeypot submissions never reach Resend', async () => {
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
  const response = await handleContact(new Request('https://example.com/api/contact', { method: 'POST', body: new URLSearchParams(valid) }), env, async () => accepted());
  assert.equal(response.status, 200);
});

test('Pages and Worker endpoints both use the shared Resend handler', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, 'https://api.resend.com/emails');
    calls++;
    return accepted();
  });
  assert.equal((await onRequest({ request: request(), env })).status, 200);
  assert.equal((await worker.fetch(request(), env)).status, 200);
  assert.equal(calls, 2);
  assert.equal((await worker.fetch(new Request('https://example.com/api/missing'), env)).status, 404);
});
