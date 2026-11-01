import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Interface, parseEther, id, Wallet, Transaction} from 'ethers';
import {validateSourceReceipt} from '../server/source-lane.mjs';
import {inspectDestination} from '../lib/crosschain-recovery.mjs';
import {LiveV3, V3_CONTRACT} from '../server/live-v3.mjs';

const config = JSON.parse(readFileSync('config/source-sepolia.json', 'utf8'));
const outbox = new Interface(JSON.parse(readFileSync('artifacts/evm/AirlockOutbox.json', 'utf8')).abi);
const iface = new Interface(JSON.parse(readFileSync('artifacts/evm/Airlock.json', 'utf8')).abi);
const hash = '0x' + 'a'.repeat(64), blockHash = '0x' + 'b'.repeat(64), domain = id('airlock:external-testnet:v1');
const relay = '0x74b438f9dDd5E9A35bd6eFD3D032F9411094dD0A';
const nonce = (11155111n << 32n) | 7n;
function sourceFixture() {
  const event = outbox.encodeEventLog(outbox.getEvent('ReleaseRequested'), [7n, config.recipient, parseEther('4'), 420420777n, config.destination]);
  const job = {input: {action: 'submit', amount: '4'}, source: {chainId: 11155111, contract: config.contract, transactionHash: hash}};
  return {job, config, save: () => {}, contract: {interface: outbox},
    rpc: {getBlockNumber: async () => 105, getBlock: async () => ({hash: blockHash})},
    receipt: {hash, blockNumber: 100, blockHash, to: config.contract, from: config.owner, status: 1, logs: [{address: config.contract, ...event}]}};
}

test('source recovery derives the original domain nonce from the canonical event', async () => {
  const fixture = sourceFixture();
  const result = await validateSourceReceipt(fixture);
  assert.equal(result.nonce, nonce);
  assert.equal(fixture.job.source.destinationNonce, nonce.toString());
  assert.equal(fixture.job.source.transactionHash, hash);
});
test('source without a receipt or six confirmations remains waiting', async () => {
  assert.equal((await validateSourceReceipt({...sourceFixture(), receipt: null})).state, 'waiting');
  const fixture = sourceFixture(); fixture.rpc.getBlockNumber = async () => 104;
  assert.equal((await validateSourceReceipt(fixture)).state, 'waiting');
  assert.equal(fixture.job.source.destinationNonce, undefined);
});
test('source recovery rejects reorgs, changed amounts and ambiguous source events', async () => {
  const reorg = sourceFixture(); reorg.rpc.getBlock = async () => ({hash: 'different'});
  await assert.rejects(() => validateSourceReceipt(reorg), /not canonical/);
  const changed = sourceFixture(); changed.job.input.amount = '3';
  await assert.rejects(() => validateSourceReceipt(changed), /intended payout/);
  const duplicate = sourceFixture(); duplicate.receipt.logs.push(duplicate.receipt.logs[0]);
  await assert.rejects(() => validateSourceReceipt(duplicate), /ambiguous/);
});

function destinationFixture({receipt = null, status = 0n, tipStatus = status} = {}) {
  const key = id('key');
  const job = {...sourceFixture().job, transactionHash: hash};
  return {job, nonce, domain, guardian: config.recipient, relay, destination: V3_CONTRACT, finalizedHeight: 200, iface,
    rpc: {getTransactionReceipt: async () => receipt, getBlock: async () => ({hash: blockHash}), getTransaction: async () => ({to: V3_CONTRACT, from: relay, value: 0n, chainId: 420420777n, data: iface.encodeFunctionData('submit', [domain, nonce, config.recipient, parseEther('4')])})},
    contract: {messageId: async () => key, messages: async (_key, options) => ({status: options ? status : tipStatus, recipient: config.recipient, amount: parseEther('4')})}};
}
const receipt = {blockNumber: 100, blockHash, status: 1};
test('unresolved destination hash and unfinalized receipt never permit replacement', async () => {
  assert.equal((await inspectDestination(destinationFixture())).state, 'waiting');
  assert.equal((await inspectDestination(destinationFixture({receipt: {...receipt, blockNumber: 201}}))).state, 'waiting');
});
test('accepted destination request is reconciled instead of sent again', async () => {
  for (const status of [1n, 2n, 3n]) {
    const result = await inspectDestination(destinationFixture({receipt, status}));
    assert.equal(result.state, 'completed'); assert.equal(result.status, 'finalized');
  }
  const fixture = destinationFixture({status: 2n}); delete fixture.job.transactionHash;
  assert.equal((await inspectDestination(fixture)).status, 'reconciled');
});
test('only absent destination or confirmed reverted submission is resumable', async () => {
  const fresh = destinationFixture(); delete fresh.job.transactionHash;
  assert.equal((await inspectDestination(fresh)).state, 'resumable');
  const reverted = await inspectDestination(destinationFixture({receipt: {...receipt, status: 0}}));
  assert.equal(reverted.state, 'resumable'); assert.equal(reverted.retryReverted, true);
  const tip = destinationFixture({tipStatus: 1n}); delete tip.job.transactionHash;
  assert.equal((await inspectDestination(tip)).state, 'waiting');
});
test('destination mismatch, reorg and missing message after success fail closed', async () => {
  const changed = destinationFixture({receipt, status: 1n}); changed.job.input.amount = '3';
  await assert.rejects(() => inspectDestination(changed), /differs/);
  const reorg = destinationFixture({receipt}); reorg.rpc.getBlock = async () => ({hash: 'other'});
  await assert.rejects(() => inspectDestination(reorg), /canonical/);
  await assert.rejects(() => inspectDestination(destinationFixture({receipt})), /no matching/);
});

function recoveryFixture({receipt: savedReceipt, status = 0n, paused = false} = {}) {
  const fixture = destinationFixture({receipt: savedReceipt, status}); delete fixture.job.transactionHash;
  const live = Object.create(LiveV3.prototype);
  live.plan = {guardianEvm: config.recipient, relay}; live.rpc = fixture.rpc; live.iface = iface;
  live.contract = {...fixture.contract, sourceDomain: async () => domain, paused: async () => paused};
  live.connect = async () => ({rpc: {chain: {getFinalizedHead: async () => hash, getHeader: async () => ({number: 200})}}});
  live.assertIdentity = async () => {}; live.save = () => {};
  live.verifyRecoverySource = async () => ({state: 'verified', nonce});
  live.sendRelay = async (job, _api, options) => {assert.equal(options.sourceNonce, nonce); job.status = 'finalized'; live.sent = true;};
  live.store = {jobs: [fixture.job]}; fixture.job.id = 'saved-job'; fixture.job.status = 'uncertain';
  return {live, job: fixture.job};
}
test('inspection never signs; explicit resume relays the original verified nonce', async () => {
  const {live, job} = recoveryFixture();
  await live.recover(job, false); assert.equal(live.sent, undefined); assert.equal(job.recovery.state, 'resumable');
  await live.recover(job, true); assert.equal(live.sent, true); assert.equal(job.recovery.state, 'completed');
  assert.equal(job.source.transactionHash, hash);
});
test('paused or already accepted requests are never resent by recovery', async () => {
  const paused = recoveryFixture({paused: true}); await paused.live.recover(paused.job, true);
  assert.equal(paused.live.sent, undefined); assert.equal(paused.job.recovery.state, 'blocked');
  const accepted = recoveryFixture({status: 2n}); await accepted.live.recover(accepted.job, true);
  assert.equal(accepted.live.sent, undefined); assert.equal(accepted.job.status, 'reconciled');
});
test('recovery admission requires inspection and serializes/deduplicates the same job', async () => {
  const {live, job} = recoveryFixture(); live.running = new Set(); live.busy = false;
  assert.throws(() => live.startRecovery({jobId: job.id, resume: true}, 'recovery-request-id-001'), /Inspect/);
  live.recover = async () => {job.recovery = {state: 'resumable'};};
  const requestId = 'recovery-request-id-002';
  live.startRecovery({jobId: job.id, resume: false}, requestId);
  assert.equal(live.startRecovery({jobId: job.id, resume: false}, requestId), job);
  assert.throws(() => live.startRecovery({jobId: job.id, resume: false}, 'recovery-request-id-003'), /Another/);
  await new Promise(resolve => setImmediate(resolve)); await new Promise(resolve => setImmediate(resolve));
  assert.equal(live.busy, false);
});

test('resumed relay signs only the original destination nonce and preserves prior reverted hash', async () => {
  const {live, job} = recoveryFixture();
  delete live.sendRelay;
  const wallet = new Wallet('0x' + '11'.repeat(32)); // disposable fixture; never funded
  live.relayWallet = () => wallet; live.plan.relay = wallet.address;
  live.store.messages = {};
  job.transactionHash = hash; job.blockNumber = 100;
  let broadcasts = 0;
  live.rpc = {send: async () => '0x1', estimateGas: async () => 100n, getBalance: async () => parseEther('100'), getTransactionCount: async () => 3,
    broadcastTransaction: async raw => {
      broadcasts++;
      const tx = Transaction.from(raw);
      assert.equal(tx.chainId, 420420777n);
      assert.equal(iface.decodeFunctionData('submit', tx.data)[1], nonce);
      assert.equal(tx.to.toLowerCase(), V3_CONTRACT.toLowerCase());
    }, waitForTransaction: async () => receipt, getBlock: async () => ({hash: blockHash})};
  live.waitFinalized = async () => {};
  await live.sendRelay(job, {}, {sourceNonce: nonce});
  assert.equal(broadcasts, 1);
  assert.equal(job.status, 'finalized');
  assert.equal(job.destinationAttempts[0].transactionHash, hash);
  assert.equal(job.source.transactionHash, hash);
  assert.equal(job.nonce, nonce.toString());
  await assert.rejects(() => live.sendRelay(job, {}), /source request already exists/);
});
