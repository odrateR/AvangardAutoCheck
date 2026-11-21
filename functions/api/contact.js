import { handleContact } from '../../lib/contact.js';

export function onRequest({ request, env }) {
  const service = env.CONTACT_RATE_LIMIT_SERVICE;
  return handleContact(request, {
    ...env,
    CONTACT_RATE_LIMITER: service && { limit: ({ key }) => service.limit(key) }
  });
}
