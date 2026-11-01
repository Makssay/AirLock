import test from 'node:test';
import assert from 'node:assert/strict';
import {LiveV3} from '../server/live-v3.mjs';
import {explainPayout} from '../lib/payout-explanation.mjs';

function fixture(balance, peak = 4n * 10n ** 14n, rejected = false) {
  const live = Object.create(LiveV3.prototype);
  live.assertIdentity = async () => {};
  live.contract = {policy: async () => ({instant: 1n, cap: 5n, delaySeconds: 120n, maxPending: 20n})};
  live.iface = {encodeFunctionData: method => method};
  live.connect = async () => ({
    query: {system: {account: async () => ({data: {free: balance, frozen: 0n}})}},
    call: {reviveApi: {call: async () => ({
      storageDeposit: {isCharge: false}, maxStorageDeposit: {isCharge: true, asCharge: peak},
      result: {isErr: rejected, asErr: {isModule: false}},
      toJSON: () => ({result: {ok: {flags: {bits: 0}}}}), weightRequired: {refTime: 100n, proofSize: 100n}
    })}},
    tx: {revive: {call: () => ({paymentInfo: async address => {assert.ok(typeof address === 'string');return {partialFee: 10n};}})}}
  });
  return live;
}

test('readiness prices peak storage without loading a guardian key or signing', async () => {
  const live = fixture(5n * 10n ** 14n);
  live.guardianKey = () => {throw Error('Must not access key');};
  const result = await live.guardianReadiness();
  assert.equal(result.checks.length, 2);
  assert.equal(result.checks[0].ready, true);
  assert.equal(result.checks[0].peakDeposit, '4.0');
  assert.equal(result.available, '5.0');
});

test('readiness flags insufficient peak funding and cannot mark runtime rejection ready', async () => {
  const result = await fixture(2n * 10n ** 14n).guardianReadiness();
  assert.equal(result.checks[0].ready, false);
  assert.match(result.checks[0].reason, /Insufficient/);
  const rejected = await fixture(50n * 10n ** 14n, 4n, true).guardianReadiness();
  assert.equal(rejected.checks[0].ready, false);
  assert.equal(rejected.checks[0].required, null);
});

const state = {now: 100000, paused: false, policy: {cap: '5', instant: '1'}, spent: '3', reserved: '4', reserveFloor: '5', balance: '20'};
const message = {status: 'queued', amount: '4', eligibleAt: 101000};
test('queue explanation distinguishes time, pause and exact budget constraints', () => {
  const result = explainPayout({...state, paused: true}, message);
  assert.equal(result.blockers.length, 3);
  assert.equal(result.ready, false);
  assert.match(result.context, /current instant threshold/);
  assert.equal(explainPayout({...state, spent: '1', now: 102000}, message).ready, true);
  assert.equal(explainPayout({...state, spent: '1.000000000000000001', now: 102000}, message).ready, false);
});

test('queue explanation handles reserve shortage and resolved requests', () => {
  assert.match(explainPayout({...state, balance: '8'}, message).blockers.join(' '), /reserve floor/);
  assert.deepEqual(explainPayout(state, {...message, status: 'cancelled'}).blockers, []);
});
