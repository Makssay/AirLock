import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {protectionSteps,legitimateSteps} from '../lib/demo-scenarios.mjs';
const load = name => JSON.parse(readFileSync('artifacts/' + name + '.json', 'utf8'));

test('V3 story preserves all four recorded receipts and final unchanged treasury', () => {
  const report = load('v3-attack-demo'), steps = protectionSteps(report);
  assert.equal(steps.length, 4);
  assert.deepEqual(steps.map(step => step.message.status), ['released','queued','queued','cancelled']);
  assert.ok(steps.every(step => !step.local && step.state.chainId === 420420777));
  assert.equal(steps.at(-1).state.balance, '48.75');
  assert.equal(steps[2].operation.status, 'finalized');
});

test('legitimate story proves queue, TooEarly rejection and exact delayed payment', () => {
  const steps = legitimateSteps(load('local-final-scenario'));
  assert.equal(steps.length, 3);
  assert.ok(steps.every(step => step.local && step.state.chainId === 31337));
  assert.equal(steps[1].check.reason, 'TooEarly');
  assert.equal(steps[1].operation, null);
  assert.equal(steps[0].state.balance, '49.75');
  assert.equal(steps[2].state.balance, '47.75');
  assert.equal(steps[2].message.status, 'released');
  assert.equal(steps[2].state.reserved, '0.0');
});

test('mixed networks and incomplete receipts cannot be presented as evidence', () => {
  const local = load('local-final-scenario'); local.chainId = 420420777;
  assert.throws(() => legitimateSteps(local));
  const v3 = load('v3-attack-demo'); v3.quarantined.chainId = 31337;
  assert.throws(() => protectionSteps(v3));
  const missing = load('local-final-scenario'); delete missing.scenarios.legitimate.released.operation.hash;
  assert.throws(() => legitimateSteps(missing));
});

test('early releases, wrong rejection reasons and incorrect balance deltas are rejected', () => {
  const early = load('local-final-scenario'); early.scenarios.legitimate.released.now = early.scenarios.legitimate.queued.now;
  assert.throws(() => legitimateSteps(early));
  const reason = load('local-final-scenario'); reason.scenarios.legitimate.earlyCheck.reason = 'RPC error';
  assert.throws(() => legitimateSteps(reason));
  const delta = load('local-final-scenario'); delta.scenarios.legitimate.released.balance = '47.750000000000000001';
  assert.throws(() => legitimateSteps(delta));
});

test('rendered proof identifies its network and never invents a transaction for a read-only check', async () => {
  const {createServer} = await import('vite');
  const React = await import('react');
  const {renderToStaticMarkup} = await import('react-dom/server');
  const {createServer: createHttpServer} = await import('node:http');
  const server = await createServer({server:{middlewareMode:true,hmr:{server:createHttpServer()}},appType:'custom'});
  try {
    const {StoryProof} = await server.ssrLoadModule('/src/StoryDemo.jsx');
    const local = legitimateSteps(load('local-final-scenario'));
    const render = item => renderToStaticMarkup(React.createElement(StoryProof,{item}));
    const localHtml = render(local[2]);
    assert.match(localHtml, /Local Anvil contract evidence/);
    assert.match(localHtml, /31337/);
    assert.doesNotMatch(localHtml, /Finalized Portaldot V3/);
    const check = render(local[1]);
    assert.match(check, /TooEarly/);
    assert.match(check, /No transaction was broadcast/);
    assert.doesNotMatch(check, new RegExp(local[0].operation.hash));
    assert.match(render(protectionSteps(load('v3-attack-demo'))[3]), /Finalized Portaldot V3 evidence/);
  } finally {await server.close();}
});
