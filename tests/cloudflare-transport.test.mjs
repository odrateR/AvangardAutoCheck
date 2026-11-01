import test from 'node:test';
import assert from 'node:assert/strict';
import { createCloudflareTransport } from '../lib/cloudflare-transport.js';

function smtpSocket(rejectAuth = false) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  let server, buffer = '', inData = false, content = '';
  const respond = text => server.enqueue(encoder.encode(text + '\r\n'));
  const readable = new ReadableStream({ start(controller) { server = controller; respond('220 smtp.test ESMTP'); } });
  const writable = new WritableStream({
    write(chunk) {
      buffer += decoder.decode(chunk, { stream: true });
      let end;
      while ((end = buffer.indexOf('\r\n')) !== -1) {
        const line = buffer.slice(0, end); buffer = buffer.slice(end + 2);
        if (inData) {
          if (line === '.') { inData = false; respond('250 2.0.0 queued'); }
          else content += line + '\r\n';
        } else if (line.startsWith('EHLO')) respond('250-smtp.test\r\n250 AUTH PLAIN');
        else if (line.startsWith('AUTH')) respond(rejectAuth ? '535 5.7.8 Invalid credentials' : '235 2.7.0 authenticated');
        else if (line.startsWith('MAIL FROM') || line.startsWith('RCPT TO')) respond('250 2.1.0 OK');
        else if (line === 'DATA') { inData = true; respond('354 End data with <CRLF>.<CRLF>'); }
        else if (line === 'QUIT') { respond('221 2.0.0 closing'); server.close(); }
      }
    }
  });
  return { opened: Promise.resolve(), closed: Promise.resolve(), readable, writable, close: async () => {}, content: () => content };
}

const options = { host: 'smtp.gmail.com', port: 465, secure: true, auth: { user: 'sender@example.com', pass: 'test-only' }, connectionTimeout: 1000, greetingTimeout: 1000, socketTimeout: 1000 };

test('Cloudflare encrypted stream supports a complete Nodemailer SMTP transaction', async () => {
  const socket = smtpSocket();
  let destination, security;
  const transport = createCloudflareTransport(options, (address, settings) => { destination = address; security = settings; return socket; });
  const result = await transport.sendMail({ from: 'sender@example.com', to: 'avangardautocheck@gmail.com', subject: 'Transport test', text: 'Message body.' });
  assert.deepEqual(destination, { hostname: 'smtp.gmail.com', port: 465 });
  assert.equal(security.secureTransport, 'on');
  assert.deepEqual(result.accepted, ['avangardautocheck@gmail.com']);
  assert.match(socket.content(), /Message body/);
  transport.close();
});

test('Cloudflare transport propagates Gmail authentication rejection', async () => {
  const transport = createCloudflareTransport(options, () => smtpSocket(true));
  await assert.rejects(transport.verify(), { code: 'EAUTH', responseCode: 535 });
  transport.close();
});
