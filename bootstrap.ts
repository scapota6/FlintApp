// bootstrap.ts — load env first, then import the server to prevent early SDK init
import 'dotenv/config';

// sanitize whitespace/newlines in env
for (const k of ['SNAPTRADE_CLIENT_ID','SNAPTRADE_CONSUMER_KEY','SNAPTRADE_ENV','SNAPTRADE_REDIRECT_URI']) {
  if (process.env[k]) process.env[k] = process.env[k]!.trim().replace(/\r|\n/g,'');
}

console.log('[ENV CHECK]', {
  CLIENT_ID: process.env.SNAPTRADE_CLIENT_ID,
  CONSUMER_KEY_LEN: process.env.SNAPTRADE_CONSUMER_KEY?.length,
  ENV: process.env.SNAPTRADE_ENV,
  REDIRECT: process.env.SNAPTRADE_REDIRECT_URI,
});

// OPTIONAL: fail fast if misconfigured to avoid 1076 later
if (process.env.SNAPTRADE_ENV !== 'sandbox') throw new Error(`SNAPTRADE_ENV must be 'sandbox' during testing`);
if (!/^FLINT-/.test(process.env.SNAPTRADE_CLIENT_ID || '')) throw new Error('Use your sandbox Client ID (FLINT-...)');
if (!/^https:\/\/.+\.kirk\.replit\.dev/.test(process.env.SNAPTRADE_REDIRECT_URI || ''))
  throw new Error('SNAPTRADE_REDIRECT_URI must be your public Replit URL with /snaptrade/callback');

(async () => {
  // now import your real server AFTER env is present
  await import('./server/index.js'); // importing the actual server entry point
})();