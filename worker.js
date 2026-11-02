import { handleContact } from './lib/contact.js';

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/api/contact') return handleContact(request, env);
    if (path.startsWith('/api/')) return Response.json({ success: false, message: 'Pagina nu a fost găsită.' }, { status: 404 });
    return env.ASSETS.fetch(request);
  }
};
