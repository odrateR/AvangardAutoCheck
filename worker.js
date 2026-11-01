import { handleContact } from './lib/contact.js';
import { connect } from 'cloudflare:sockets';
import { createCloudflareTransport } from './lib/cloudflare-transport.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/contact') return handleContact(request, env, options => createCloudflareTransport(options, connect));
    if (path.startsWith('/api/')) return Response.json({ success: false, message: 'Pagina nu a fost găsită.' }, { status: 404 });
    return env.ASSETS.fetch(request);
  }
};
