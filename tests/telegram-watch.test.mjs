import test from 'node:test';
import assert from 'node:assert/strict';
import {observe, unavailable, sendTelegram} from '../lib/telegram-watch.mjs';

const now = 1700000000000;
const snapshot = (delta = 0, status = 'queued', paused = false) => ({now: now + delta, checkedAt: new Date(now + delta).toISOString(), finalizedBlock: 10 + delta, paused,
  messages: [{key: 'request-1', amount: '4', recipient: 'recipient', eligibleAt: now + 120000, status}]});

test('restart preserves deduplication and crossing a deadline emits only the current reminder', () => {
  let state = {};
  observe(state, snapshot(), now);
  assert.equal(state.pending.length, 1);
  state.pending.shift(); // successful delivery
  state = JSON.parse(JSON.stringify(state));
  observe(state, snapshot(), now);
  assert.equal(state.pending.length, 0);
  observe(state, snapshot(70000), now + 70000);
  assert.match(state.pending[0].text, /50s/);
  observe(state, snapshot(110000), now + 110000);
  assert.equal(state.pending.length, 1);
  assert.match(state.pending[0].text, /10s/);
  observe(state, snapshot(120000), now + 120000);
  assert.match(state.pending[0].text, /eligible/);
});

test('cancel supersedes an undelivered reminder and historical releases do not flood a new observer', () => {
  const state = {};
  observe(state, snapshot(), now);
  observe(state, snapshot(1000, 'cancelled'), now + 1000);
  assert.equal(state.pending.length, 1);
  assert.match(state.pending[0].text, /cancelled/);
  const fresh = {};
  observe(fresh, snapshot(1000, 'released'), now + 1000);
  assert.equal(fresh.pending.length, 0);
});

test('stale chain and incomplete history fail closed; outage and recovery are deduplicated', () => {
  const state = {};
  assert.throws(() => observe(state, snapshot(), now + 91000));
  assert.throws(() => observe(state, {...snapshot(), historyError: 'catch-up'}, now));
  unavailable(state, now); unavailable(state, now + 1000);
  assert.equal(state.pending.length, 1);
  observe(state, {...snapshot(), messages: []}, now);
  observe(state, {...snapshot(), messages: []}, now);
  assert.equal(state.pending.length, 2);
  assert.equal(state.health, 'healthy');
});

test('pause transitions are persisted and request alerts describe paused releases', () => {
  const state = {};
  observe(state, snapshot(), now); state.pending = [];
  observe(state, snapshot(1000, 'queued', true), now + 1000);
  assert.equal(state.pending.length, 2);
  assert.match(state.pending.find(event => event.key).text, /paused/);
  state.pending = [];
  observe(state, snapshot(2000, 'queued', true), now + 2000);
  assert.equal(state.pending.length, 0);
});

test('Telegram uses fixed HTTPS endpoint and plain text; rate limits preserve retry timing', async () => {
  let payload;
  const send = options => sendTelegram({token: '123:secret', chatId: '42', text: '<untrusted>', ...options});
  assert.equal(await send({fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.telegram.org/bot123:secret/sendMessage');
    payload = JSON.parse(options.body);
    return {ok: true, json: async () => ({ok: true, result: {message_id: 12}})};
  }}), 12);
  assert.equal(payload.parse_mode, undefined);
  assert.match(payload.text, /<untrusted>/);
  await assert.rejects(() => send({fetchImpl: async () => ({ok: false, status: 429, json: async () => ({parameters: {retry_after: 120}})})}), error => error.retryAfter === 120);
});

test('transport failures cannot expose a token-bearing URL', async () => {
  await assert.rejects(() => sendTelegram({token: 'secret-value', chatId: '42', text: 'test', fetchImpl: async () => {throw Error('https://api.telegram.org/botsecret-value/sendMessage');}}), error => !error.message.includes('secret-value'));
});
