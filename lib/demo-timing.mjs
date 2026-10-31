export function verifyPauseTiming({eligibleAt, pauseBlockTimestamp}) {
  if (!Number.isFinite(eligibleAt) || !Number.isFinite(pauseBlockTimestamp)) throw Error('Missing chain timing evidence');
  const marginSeconds = (eligibleAt - pauseBlockTimestamp * 1000) / 1000;
  if (marginSeconds <= 0) throw Error('Pause was not included before quarantine expiry');
  return {eligibleAt: new Date(eligibleAt).toISOString(), pauseBlockTimestamp, marginSeconds};
}
