const SERVICES = new Set(['Premium Check', 'Mașină la cheie', 'Expert pentru o zi', 'Import auto', 'Flote & dealeri', 'Pachet 1 + 1 = 3']);
const MAX_BODY = 16000;
const RESEND_ERRORS = new Set(['validation_error', 'missing_api_key', 'restricted_api_key', 'suspended_api_key', 'invalid_permission', 'rate_limit_exceeded', 'daily_quota_exceeded', 'monthly_quota_exceeded', 'application_error', 'service_unavailable']);
const reply = (status, message) => Response.json({ success: status === 200, message }, {
  status,
  headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...(status === 405 ? { Allow: 'POST' } : {}), ...(status === 429 ? { 'Retry-After': '60' } : {}) }
});

async function readBody(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY) throw new RangeError();
  const reader = request.body?.getReader();
  if (!reader) throw new SyntaxError();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY) { await reader.cancel(); throw new RangeError(); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.byteLength; }
  const text = new TextDecoder().decode(buffer);
  const type = request.headers.get('content-type') || '';
  if (type.startsWith('application/json')) return JSON.parse(text);
  if (type.startsWith('application/x-www-form-urlencoded')) return Object.fromEntries(new URLSearchParams(text));
  throw new SyntaxError();
}

export async function handleContact(request, env = {}, sendRequest = fetch) {
  if (request.method !== 'POST') return reply(405, 'Folosește formularul pentru a trimite o cerere.');
  const origin = request.headers.get('origin');
  if (origin && origin !== new URL(request.url).origin) return reply(403, 'Trimite cererea din formularul de pe site.');
  if (request.headers.get('sec-fetch-site') === 'cross-site') return reply(403, 'Trimite cererea din formularul de pe site.');

  let body;
  try { body = await readBody(request); }
  catch (error) { return reply(error instanceof RangeError ? 413 : 400, error instanceof RangeError ? 'Mesajul este prea lung.' : 'Datele nu au putut fi citite. Încearcă din nou.'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return reply(400, 'Datele formularului nu sunt valide.');
  if (body.website) return reply(200, 'Cererea a fost primită.');
  if (body.type != null && !['contact', 'callback'].includes(body.type)) return reply(400, 'Tipul cererii nu este valid.');
  const callback = body.type === 'callback';
  const fields = ['name', 'email', 'phone', 'service', 'message'];
  if (fields.some(field => body[field] != null && typeof body[field] !== 'string')) return reply(400, 'Datele formularului nu sunt valide.');
  const data = Object.fromEntries(fields.map(field => [field, (body[field] || '').trim()]));
  const { name, email, phone, service, message } = data;
  if (name.length < 2 || name.length > 100 || /[\r\n\x00]/.test(name) ||
      email.length > 160 || ((!callback || email) && !/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(email)) ||
      !/^[+\d ()-]{6,22}$/.test(phone) || phone.replace(/\D/g, '').length < 6 ||
      !SERVICES.has(service) || message.length > 1800 || !['true', 'on', true].includes(body.consent)) {
    return reply(400, callback ? 'Verifică numele și numărul de telefon.' : 'Verifică numele, emailul, telefonul și acordul privind datele personale.');
  }
  const apiKey = env.RESEND_API_KEY?.trim();
  if (!apiKey) return reply(503, 'Trimiterea este temporar indisponibilă. Sună la 069 448 878 sau scrie la avangardautocheck@gmail.com.');
  if (env.CONTACT_RATE_LIMITER) {
    const { success } = await env.CONTACT_RATE_LIMITER.limit({ key: request.headers.get('cf-connecting-ip') || email.toLowerCase() || phone.replace(/\D/g, '') });
    if (!success) return reply(429, 'Ai trimis mai multe cereri. Așteaptă un minut sau sună la 069 448 878.');
  }
  const delivery = { stage: 'request', status: null, reason: 'unknown' };
  try {
    const response = await sendRequest('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      // Workers support follow/manual; manual also keeps the API key off redirect targets.
      redirect: 'manual',
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        from: `Avangard Autocheck <${env.RESEND_FROM_EMAIL?.trim() || 'website@avangardautocheck.com'}>`,
        to: ['avangardautocheck@gmail.com'],
        ...(email ? { reply_to: email } : {}),
        subject: `${callback ? 'Solicitare de apel' : 'Cerere de inspecție'} — ${service}`,
        text: `Cerere nouă de pe site-ul Avangard Autocheck\n\nNume: ${name}\n${email ? `Email: ${email}\n` : ''}Telefon: ${phone}\nServiciu: ${service}\nFormular: ${callback ? 'Programare rapidă — solicitare de apel' : 'Contact detaliat'}\n\n${message || 'Fără detalii suplimentare.'}\n\nClientul a solicitat să fie contactat în legătură cu această cerere.`
      })
    });
    delivery.status = response.status;
    delivery.stage = 'response';
    const result = await response.json();
    if (!response.ok) {
      delivery.reason = RESEND_ERRORS.has(result?.name) ? result.name : 'provider_rejected';
      throw new Error('Resend did not accept the email');
    }
    if (typeof result?.id !== 'string' || !result.id.trim()) {
      delivery.reason = 'missing_email_id';
      throw new Error('Resend did not return an email ID');
    }
    return reply(200, 'Cererea a fost trimisă! Te contactăm pentru a confirma detaliile programării.');
  } catch (error) {
    // Never log credentials, message bodies or customer details.
    if (delivery.reason === 'unknown') {
      delivery.reason = error?.name === 'TimeoutError' || error?.name === 'AbortError' ? 'timeout'
        : delivery.stage === 'response' ? 'invalid_response' : 'request_failed';
    }
    console.error('Contact delivery failed: RESEND_DELIVERY_FAILED', delivery);
    return reply(502, 'Cererea nu a putut fi trimisă. Datele tale au rămas în formular. Încearcă din nou sau sună la 069 448 878.');
  }
}
