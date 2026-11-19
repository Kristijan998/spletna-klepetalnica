const SESSION_LOCK = "chattko:active-session";

export function acquireBrowserSession(locks = globalThis.navigator?.locks) {
  if (!locks) {
    return Promise.reject(new Error("Browser session locking is unavailable"));
  }

  return new Promise((resolve, reject) => {
    locks.request(SESSION_LOCK, { ifAvailable: true }, (lock) => {
      if (!lock) {
        resolve(null);
        return;
      }

      return new Promise((release) => resolve(() => release(undefined)));
    }).catch(reject);
  });
}
