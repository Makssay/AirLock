// Pure projection of a finalized snapshot; does not sign or send transactions.
export function guardianAlerts(snapshot) {
  const now = Number(snapshot.now);
  if (!Number.isFinite(now)) throw Error('Snapshot needs a chain timestamp');
  return snapshot.messages.filter(message => message.status === 'queued').map(message => {
    const remainingSeconds = Math.ceil((message.eligibleAt - now) / 1000);
    return {key: message.key, amount: message.amount, recipient: message.recipient,
      eligibleAt: new Date(message.eligibleAt).toISOString(), remainingSeconds,
      state: snapshot.paused ? 'paused' : remainingSeconds > 0 ? 'quarantine' : 'eligible',
      action: snapshot.paused ? 'Review and cancel if unauthorized' : 'Review immediately; pause releases if unauthorized'};
  });
}

export function guardianFundingRequired({netDeposit, peakDeposit, fee, margin}) {
  const deposit = peakDeposit > netDeposit ? peakDeposit : netDeposit;
  return deposit + fee * 2n + margin;
}
