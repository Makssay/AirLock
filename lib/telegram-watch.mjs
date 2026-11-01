// Persistent delivery projection. No signing keys or transaction methods.
export function observe(state, snapshot, wallNow = Date.now()) {
  if (snapshot.historyError || !Number.isFinite(snapshot.now) ||
      Math.abs(wallNow - snapshot.now) > 90000 ||
      !Number.isFinite(Date.parse(snapshot.checkedAt)) || Math.abs(wallNow - Date.parse(snapshot.checkedAt)) > 45000) {
    throw Error('Fresh complete finalized state is unavailable');
  }
  state.messages ||= {};
  state.pending ||= [];
  const emit = (id, text, key) => {
    if (!state.pending.some(event => event.id === id)) state.pending.push({id, text, key, observedAt: snapshot.checkedAt});
  };
  if (state.health === 'unavailable') emit('recovered:' + snapshot.finalizedBlock, 'V3 monitoring recovered. Finalized state is available.');
  if (state.paused !== undefined && state.paused !== snapshot.paused) {
    emit('pause:' + snapshot.finalizedBlock, snapshot.paused ? 'Guardian paused releases on V3.' : 'Releases resumed on V3.');
  }
  for (const message of snapshot.messages) {
    const old = state.messages[message.key];
    const detail = `${message.amount} tPOT\nRecipient: ${message.recipient}\nRequest: ${message.key}`;
    if (message.status === 'queued') {
      const remaining = Math.ceil((message.eligibleAt - snapshot.now) / 1000);
      const stage = snapshot.paused ? 'paused' : remaining <= 0 ? 'eligible' : remaining <= 15 ? '15s' : remaining <= 60 ? '60s' : 'queued';
      if (!old || old.status !== 'queued' || old.stage !== stage) {
        const headline = snapshot.paused ? 'Queued request; releases are paused.' : remaining <= 0 ? 'Request is eligible. Review immediately.' : `Request in quarantine: ${remaining}s remaining at verified chain time.`;
        // Replace an undelivered older reminder with the latest verified state.
        state.pending = state.pending.filter(event => event.key !== message.key);
        emit(`${message.key}:${stage}`, `${headline}\n${detail}\nEligible at: ${new Date(message.eligibleAt).toISOString()}`, message.key);
      }
      state.messages[message.key] = {status: message.status, stage};
    } else if (old) {
      if (old.status !== message.status) {
        state.pending = state.pending.filter(event => event.key !== message.key);
        emit(`${message.key}:${message.status}`, `Request ${message.status}.\n${detail}`, message.key);
      }
      state.messages[message.key] = {status: message.status};
    }
  }
  state.health = 'healthy';
  state.paused = snapshot.paused;
  state.checkedAt = snapshot.checkedAt;
  state.finalizedBlock = snapshot.finalizedBlock;
  return state;
}

export function unavailable(state, now = Date.now()) {
  state.pending ||= [];
  if (state.health !== 'unavailable') state.pending.push({id: 'unavailable:' + now, text: 'V3 monitoring interrupted. Request coverage and deadlines cannot currently be verified.', observedAt: new Date(now).toISOString()});
  state.health = 'unavailable';
}

export async function sendTelegram({token, chatId, text, reviewUrl, prefix = 'Airlock · Portaldot V3', fetchImpl = fetch}) {
  const body = {chat_id: chatId, text: prefix + '\n' + text, link_preview_options: {is_disabled: true}};
  if (reviewUrl) body.reply_markup = {inline_keyboard: [[{text: 'Open Airlock', url: reviewUrl}]]};
  // Never propagate fetch errors: they may contain the token-bearing URL.
  let response, result;
  try {
    response = await fetchImpl(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body), signal: AbortSignal.timeout(15000)
    });
    result = await response.json();
  } catch { throw Error('Telegram transport unavailable'); }
  if (!response.ok || result.ok !== true) {
    const error = Error('Telegram delivery rejected (HTTP ' + response.status + ')');
    error.retryAfter = Math.min(86400, Math.max(1, Number(result.parameters?.retry_after) || 5));
    throw error;
  }
  return result.result.message_id;
}
