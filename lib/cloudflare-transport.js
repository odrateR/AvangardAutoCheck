import { Duplex } from 'node:stream';
import nodemailer from 'nodemailer';

// Nodemailer's DNS/socket selection is designed for Node. Supply a native,
// already encrypted Cloudflare TCP connection and retain its SMTP/MIME logic.
export function createCloudflareTransport(options, connect) {
  return nodemailer.createTransport({
    ...options,
    getSocket(_options, callback) {
      const socket = connect({ hostname: 'smtp.gmail.com', port: 465 }, { secureTransport: 'on' });
      socket.closed.catch(() => {});
      let setupTimer;
      const deadline = new Promise((_, reject) => {
        setupTimer = setTimeout(() => {
          const error = Object.assign(new Error('SMTP connection timed out'), { code: 'ETIMEDOUT' });
          reject(error);
          socket.close().catch(() => {});
        }, options.connectionTimeout || 10000);
      });
      Promise.race([socket.opened, deadline]).then(() => {
        clearTimeout(setupTimer);
        const connection = Duplex.fromWeb({ readable: socket.readable, writable: socket.writable });
        let idleTimer;
        connection.setTimeout = milliseconds => {
          clearTimeout(idleTimer);
          if (milliseconds > 0) idleTimer = setTimeout(() => connection.emit('timeout'), milliseconds);
          return connection;
        };
        connection.once('close', () => {
          clearTimeout(idleTimer);
          socket.close().catch(() => {});
        });
        callback(null, { connection, secured: true });
      }, error => {
        clearTimeout(setupTimer);
        socket.close().catch(() => {});
        callback(error);
      });
    }
  });
}
