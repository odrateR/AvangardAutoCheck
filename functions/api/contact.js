// Cloudflare Pages alternative: the same handler as the Workers deployment.
import { handleContact } from '../../lib/contact.js';
import { connect } from 'cloudflare:sockets';
import { createCloudflareTransport } from '../../lib/cloudflare-transport.js';

export function onRequest(context) {
  return handleContact(context.request, context.env, options => createCloudflareTransport(options, connect));
}
