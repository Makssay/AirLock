// Present execution constraints; a current policy cannot establish historical queue reasons.
const units = value => {
  const [whole, fraction = ''] = String(value).split('.');
  return BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, '0'));
};
export function explainPayout(snapshot, message) {
  if (message.status !== 'queued') return {blockers: [], context: 'Request ' + message.status + '.'};
  const blockers = [];
  if (snapshot.paused) blockers.push('Guardian paused releases. Resume requires scheduling and activating a policy after its delay.');
  const remaining = Math.max(0, Math.ceil((message.eligibleAt - snapshot.now) / 1000));
  if (remaining) blockers.push(`Quarantine has ${remaining}s remaining at the verified block.`);
  if (units(snapshot.spent) + units(message.amount) > units(snapshot.policy.cap)) blockers.push('This payout exceeds the remaining budget in the current fixed window. Wait for a new window or review the policy.');
  if (units(snapshot.reserved) + units(snapshot.reserveFloor) > units(snapshot.balance)) blockers.push('Vault balance does not cover reserved requests and the reserve floor.');
  const context = units(message.amount) > units(snapshot.policy.instant)
    ? 'This amount exceeds the current instant threshold. The policy at submission may have differed.'
    : 'Requests can enter quarantine when the instant threshold or available window budget prevents immediate release. The original reason is not recorded in the queue event.';
  return {blockers, context, ready: blockers.length === 0};
}
