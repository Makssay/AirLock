import test from 'node:test';
import assert from 'node:assert/strict';
import {guardianAlerts, guardianFundingRequired} from '../lib/guardian-watch.mjs';
import {LiveV3} from '../server/live-v3.mjs';

test('guardian detects queued requests at the chain deadline and preserves paused state', () => {
  const snapshot = {now: 100000, paused: false, messages: [
    {key: 'a', status: 'queued', amount: '4', recipient: 'recipient', eligibleAt: 101000},
    {key: 'b', status: 'cancelled', eligibleAt: 101000}]};
  assert.equal(guardianAlerts(snapshot).length, 1);
  assert.equal(guardianAlerts(snapshot)[0].remainingSeconds, 1);
  assert.equal(guardianAlerts({...snapshot, now: 101000})[0].state, 'eligible');
  assert.equal(guardianAlerts({...snapshot, paused: true, now: 102000})[0].state, 'paused');
});

test('guardian affordability includes transient peak storage even with a net refund', () => {
  assert.equal(guardianFundingRequired({netDeposit: 0n, peakDeposit: 400n, fee: 10n, margin: 5n}), 425n);
  assert.equal(guardianFundingRequired({netDeposit: 500n, peakDeposit: 400n, fee: 10n, margin: 5n}), 525n);
});

test('native signing is blocked when balance covers net deposit but not peak storage', async () => {
  const live = Object.create(LiveV3.prototype);
  const unit = 10n ** 14n;
  const api = {query: {system: {account: async () => ({data: {free: 2n * unit, frozen: 0n}})}}};
  let signed = false;
  const tx = {paymentInfo: async () => ({partialFee: 1n}), signAsync: async () => {signed = true;}};
  await assert.rejects(() => live.broadcastNative({}, api, {}, tx, 0n, 4n * unit), /peak storage/);
  assert.equal(signed, false);
});
