import {readFileSync, writeFileSync, renameSync, existsSync, mkdirSync, openSync, closeSync, unlinkSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createHash} from 'node:crypto';
import {observe, unavailable, sendTelegram} from '../lib/telegram-watch.mjs';

const envPath = process.env.AIRLOCK_NOTIFY_ENV || '.env';
const config = {...(existsSync(envPath) ? parseEnv(readFileSync(envPath, 'utf8')) : {}), ...process.env};
const token = config.TELEGRAM_BOT_TOKEN, chatId = config.TELEGRAM_CHAT_ID;
const dry = process.argv.includes('--dry-run'), once = process.argv.includes('--once');
if (!dry && (!/^\d+:[A-Za-z0-9_-]+$/.test(token || '') || !/^-?\d+$/.test(chatId || ''))) {
  console.error('Set TELEGRAM_BOT_TOKEN and numeric TELEGRAM_CHAT_ID in the local .env. Values are never logged.');
  process.exit(1);
}
let reviewUrl = config.AIRLOCK_REVIEW_URL || undefined;
if (reviewUrl) {
  const url = new URL(reviewUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search) throw Error('Review URL must be HTTPS with no credentials or query parameters');
}
mkdirSync('deployments', {recursive: true});
const identity = createHash('sha256').update(dry ? 'dry-run' : token + ':' + chatId).digest('hex').slice(0, 16);
const file = `deployments/telegram-${identity}.local.json`, lock = file + '.lock';
if (existsSync(lock)) {
  const pid = Number(readFileSync(lock, 'utf8'));
  let alive = true;
  try { process.kill(pid, 0); } catch (error) { if (error.code === 'ESRCH') alive = false; }
  if (alive) throw Error('An observer already owns this delivery journal');
  unlinkSync(lock);
}
const fd = openSync(lock, 'wx'); writeFileSync(fd, String(process.pid)); closeSync(fd);
const cleanup = () => {try {unlinkSync(lock);} catch {}};
process.on('exit', cleanup);
let stopped = false;
process.on('SIGINT', () => {stopped = true;});
process.on('SIGTERM', () => {stopped = true;});
let state = existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : {pending: [], messages: {}};
const save = () => {writeFileSync(file + '.tmp', JSON.stringify(state, null, 2)); renameSync(file + '.tmp', file);};
// Separate event-history journal: never race the signing console's store.
const {LiveV3} = await import('../server/live-v3.mjs');
const live = new LiveV3({journalFile: `deployments/telegram-chain-${identity}.local.json`});
let failures = 0, deliveryFailures = 0;
try {
  do {
    try {
      const snapshot = await live.snapshot(true);
      observe(state, snapshot);
      failures = 0;
    } catch {
      failures++;
      unavailable(state);
      console.error('Observer cannot verify complete fresh state; retrying reads.');
    }
    save();
    if (dry) {
      console.log(JSON.stringify({dryRun: true, health: state.health, finalizedBlock: state.finalizedBlock, pending: state.pending}));
    } else if (Date.now() >= (state.nextDeliveryAt || 0)) {
      // One delivery per poll prevents an outage recovery from flooding the chat.
      const event = state.pending[0];
      if (event) {
        try {
          await sendTelegram({token, chatId, text: event.text + '\nObserved: ' + event.observedAt, reviewUrl});
          state.pending.shift(); state.lastDeliveredAt = new Date().toISOString();
          state.nextDeliveryAt = 0; deliveryFailures = 0; save();
          console.log('Guardian notification delivered.');
        } catch (error) {
          deliveryFailures++;
          state.nextDeliveryAt = Date.now() + Math.max(error.retryAfter || 0, Math.min(300, 5 * 2 ** Math.min(deliveryFailures, 6))) * 1000;
          save(); console.error('Telegram delivery unavailable; notification retained for retry.');
        }
      }
    }
    if (once) {if (failures || (!dry && state.pending.length)) process.exitCode = 1; break;}
    const delay = Math.min(30000, 5000 * 2 ** Math.min(failures, 3)) + Math.floor(Math.random() * 1000);
    // Short waits allow prompt shutdown without abandoning the journal.
    for (let waited = 0; waited < delay && !stopped; waited += 250) await new Promise(resolve => setTimeout(resolve, 250));
  } while (!stopped);
} finally {
  await live.api?.disconnect(); live.rpc.destroy(); cleanup();
}
