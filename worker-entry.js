import { WorkerEntrypoint } from 'cloudflare:workers';

export { default } from './worker.js';

export class ContactRateLimit extends WorkerEntrypoint {
  limit(key) {
    return this.env.CONTACT_RATE_LIMITER.limit({ key });
  }
}
