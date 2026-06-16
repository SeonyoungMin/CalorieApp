type Listener = (online: boolean) => void;

let online = true;
const listeners = new Set<Listener>();

export function setOnline(next: boolean) {
  if (online === next) return;
  online = next;
  listeners.forEach((l) => {
    try { l(online); } catch {}
  });
}

export function isOnline(): boolean {
  return online;
}

export function subscribeOnline(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function isNetworkError(error: any): boolean {
  if (!error) return false;
  if (error.response) return false;
  const code = error.code || error?.cause?.code;
  if (code === 'ECONNABORTED' || code === 'ERR_NETWORK' || code === 'ENETUNREACH' || code === 'ECONNREFUSED' || code === 'ECONNRESET') return true;
  const msg = (error.message || '').toLowerCase();
  if (msg.includes('network error')) return true;
  if (msg.includes('failed to fetch')) return true;
  if (msg.includes('timeout') && msg.includes('exceeded')) return true;
  return false;
}
