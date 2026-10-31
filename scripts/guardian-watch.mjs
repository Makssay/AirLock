import {guardianAlerts} from '../lib/guardian-watch.mjs';
const base = 'http://127.0.0.1:' + (process.env.AIRLOCK_PORT || '5173');
const once = process.argv.includes('--once');
const seen = new Map();
let failures = 0;
do {
  try {
    const response = await fetch(base + '/api/live/state?refresh=1', {signal: AbortSignal.timeout(45000)});
    if (!response.ok) throw Error('Local console returned HTTP ' + response.status);
    const snapshot = await response.json();
    if (snapshot.historyError) throw Error('Incomplete event history');
    const alerts = guardianAlerts(snapshot);
    for (const alert of alerts) {
      if (once || seen.get(alert.key) !== alert.state) {
        console.log(JSON.stringify({type: 'guardian-alert', checkedAt: snapshot.checkedAt, finalizedBlock: snapshot.finalizedBlock, ...alert}));
      }
    }
    // Resolved entries can alert again if subsequently observed queued.
    seen.clear(); for (const alert of alerts) seen.set(alert.key, alert.state);
    if (once) console.log(JSON.stringify({type: 'watch-status', checkedAt: snapshot.checkedAt, finalizedBlock: snapshot.finalizedBlock, queued: alerts.length}));
    if (failures) console.log(JSON.stringify({type: 'watch-recovered', checkedAt: snapshot.checkedAt}));
    failures = 0;
  } catch {
    failures++;
    console.error(JSON.stringify({type: 'watch-unavailable', checkedAt: new Date().toISOString(), message: 'Cannot verify fresh state; check the local console and RPC. Previous observations are stale.', failures}));
    if (once) process.exitCode = 1;
  }
  if (!once) await new Promise(resolve => setTimeout(resolve, Math.min(30000, 5000 * 2 ** Math.min(failures, 3)) + Math.floor(Math.random() * 1000)));
} while (!once);
