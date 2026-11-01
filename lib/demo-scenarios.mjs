const requireProof = condition => {if (!condition) throw Error('Scenario evidence is incomplete or inconsistent');};
const units = value => {
  requireProof(typeof value === 'string' && /^\d+(\.\d{1,18})?$/.test(value));
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
};
const hash = value => typeof value === 'string' && /^0x[0-9a-f]{64}$/i.test(value);

export function protectionSteps(report) {
  const snapshots = [report.before, report.quarantined, report.paused, report.after];
  const titles = ['Normal work continues', 'A larger request must wait', 'The guardian pauses releases', 'The request is cancelled'];
  const expected = ['released', 'queued', 'queued', 'cancelled'];
  return snapshots.map((state, index) => {
    requireProof(state?.chainId === 420420777 && Number.isInteger(state.finalizedBlock));
    const operation = index === 0 ? report.baseline : report.operations.findLast(item => item.status === 'finalized' && item.input.action === ['submit', 'submit', 'pause', 'cancel'][index]);
    const message = index === 0 ? state.messages.find(item => item.nonce === report.baseline.nonce) : state.messages.find(item => item.key === report.messageKey);
    requireProof(message?.status === expected[index] && operation?.status === 'finalized' && hash(operation.transactionHash));
    if (index === 2) requireProof(state.paused === true);
    if (index === 3) requireProof(units(state.balance) === units(report.quarantined.balance) && units(state.reserved) === 0n);
    const descriptions = [
      `An earlier Sepolia request paid ${message.amount} tPOT on Portaldot V3. Small payouts can pass within the spending budget.`,
      `This ${message.amount} tPOT request enters quarantine. The funds stay in the treasury, reserved for the request.`,
      'An independent guardian pauses releases. Queued requests cannot execute while releases are paused.',
      `The guardian cancels the request. Its nonce remains consumed; the vault remains at ${state.balance} tPOT.`
    ];
    return {title: titles[index], description: descriptions[index], state, message, operation, local: false};
  });
}

export function legitimateSteps(report) {
  requireProof(report.chainId === 31337 && report.network === 'Local Anvil' && report.status === 'passed');
  const {queued, released, earlyCheck} = report.scenarios?.legitimate || {};
  requireProof(queued?.chainId === 31337 && released?.chainId === 31337 && queued.contract === report.contract && released.contract === report.contract);
  requireProof(queued.message?.status === 'queued' && released.message?.status === 'released' && queued.message.key === released.message.key);
  requireProof(hash(queued.operation?.hash) && hash(released.operation?.hash) && queued.blockNumber === queued.operation.blockNumber && released.blockNumber === released.operation.blockNumber);
  requireProof(earlyCheck?.status === 'rejected' && earlyCheck.reason === 'TooEarly' && earlyCheck.blockNumber === queued.blockNumber);
  requireProof(queued.now < queued.message.eligibleAt && released.now >= queued.message.eligibleAt && released.blockNumber > queued.blockNumber);
  const amount = units(queued.message.amount);
  requireProof(amount > units(queued.policy.instant) && amount === units(released.message.amount));
  requireProof(units(queued.balance) - units(released.balance) === amount && units(queued.reserved) - units(released.reserved) === amount);
  requireProof(!queued.paused && !released.paused);
  return [
    {title: 'A legitimate larger payment enters quarantine', description: `${queued.message.amount} tPOT exceeds the ${queued.policy.instant} tPOT instant threshold. The request waits under the same contract rules.`, state: queued, message: queued.message, operation: queued.operation},
    {title: 'The waiting period is enforced', description: 'An early execution call is rejected with TooEarly. The request stays queued and the funds remain in the vault.', state: queued, message: queued.message, operation: null, check: earlyCheck},
    {title: 'After quarantine, the payment succeeds', description: `Once eligible, the request executes within the spending budget. The recipient receives ${released.message.amount} tPOT and the reservation is cleared.`, state: released, message: released.message, operation: released.operation}
  ].map(step => ({...step, local: true}));
}
