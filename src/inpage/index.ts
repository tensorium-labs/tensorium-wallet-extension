// Injected into page's main world — creates window.tensorium provider.
// No imports: this file must compile to plain JS without module syntax.
(function () {
  if ((window as any).tensorium?.isInstalled) return;

  const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
  let nextId = 1;

  window.addEventListener('message', (e) => {
    if (e.source !== window || (e.data as any)?.txm_source !== 'content') return;
    const { id, result, error } = e.data as any;
    const cb = pending.get(id as number);
    if (!cb) return;
    pending.delete(id as number);
    if (error) cb.reject(new Error(error as string));
    else cb.resolve(result);
  });

  function request(method: string, params: unknown = {}) {
    return new Promise<unknown>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      window.postMessage({ txm_source: 'inpage', id, method, params }, '*');
    });
  }

  (window as any).tensorium = {
    isInstalled: true,
    getAddress: () => request('getAddress'),
    requestAccounts: () => request('requestAccounts'),
    sendTransaction: (to: string, amount_atoms: number) =>
      request('sendTransaction', { to, amount_atoms }),
    signAssetTx: (unsignedTx: unknown, summary: unknown) =>
      request('signAssetTx', { unsignedTx, summary }),
    getAssets: (address: string) => request('getAssets', { address }),
  };
})();
