// Cloudflare Pages alternative: the same handler as the Workers deployment.
import { handleContact } from '../../lib/contact.js';

export function onRequest(context) {
  return handleContact(context.request, context.env);
}
