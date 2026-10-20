/** Notifies at each minute boundary while the app is visible, and on return to it. */
export function subscribeMinute(listener: () => void): () => void {
  let timer = 0;
  const tick = () => {
    clearTimeout(timer);
    if (document.hidden) return;
    listener();
    timer = window.setTimeout(tick, 60000 - (Date.now() % 60000) + 30);
  };
  timer = window.setTimeout(tick, 60000 - (Date.now() % 60000) + 30);
  document.addEventListener('visibilitychange', tick);
  window.addEventListener('focus', tick);
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', tick);
    window.removeEventListener('focus', tick);
  };
}

export function currentMinute(): number {
  return Math.floor(Date.now() / 60000);
}
