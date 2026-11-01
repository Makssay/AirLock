import {parseEther} from 'ethers';

const equal = (a, b) => typeof a === 'string' && typeof b === 'string' && a.toLowerCase() === b.toLowerCase();

// Reconcile an existing destination hash and nonce. This function never signs.
export async function inspectDestination({rpc, contract, iface, job, nonce, domain, guardian, relay, destination, finalizedHeight}) {
  const key = await contract.messageId(domain, nonce);
  let receipt;
  if (job.transactionHash) {
    receipt = await rpc.getTransactionReceipt(job.transactionHash);
    if (!receipt) return {state: 'waiting', key, reason: 'Saved destination hash is unresolved. No replacement will be sent.'};
    if (receipt.blockNumber > finalizedHeight) return {state: 'waiting', key, reason: 'Destination receipt is not finalized yet.'};
    const block = await rpc.getBlock(receipt.blockNumber);
    if (!block || block.hash !== receipt.blockHash) throw Error('Contract: destination receipt is not canonical');
    const tx = await rpc.getTransaction(job.transactionHash);
    if (!tx || !equal(tx.to, destination) || !equal(tx.from, relay) || BigInt(tx.value) !== 0n || BigInt(tx.chainId) !== 420420777n) throw Error('Contract: saved destination transaction does not match the relay');
    let args;
    try { args = iface.decodeFunctionData('submit', tx.data); } catch { throw Error('Contract: saved destination transaction is not a payout submission'); }
    if (!equal(args[0], domain) || args[1] !== nonce || !equal(args[2], guardian) || args[3] !== parseEther(job.input.amount)) throw Error('Contract: destination transaction differs from the verified source request');
  }
  const message = await contract.messages(key, {blockTag: finalizedHeight});
  if (message.status !== 0n) {
    if (!equal(message.recipient, guardian) || message.amount !== parseEther(job.input.amount)) throw Error('Contract: destination nonce belongs to a different payout');
    return {state: 'completed', key, status: receipt?.status === 1 ? 'finalized' : 'reconciled', messageStatus: ['missing', 'queued', 'released', 'cancelled'][Number(message.status)], receipt};
  }
  if (receipt?.status === 1) throw Error('Contract: successful receipt has no matching finalized message');
  // Also inspect the current gateway tip, so a newly included request cannot be retried.
  if ((await contract.messages(key)).status !== 0n) return {state: 'waiting', key, reason: 'Destination message exists at the tip; waiting for finalized state.'};
  return {state: 'resumable', key, retryReverted: receipt?.status === 0, reason: 'Source verified; destination has no accepted message for this nonce.'};
}
