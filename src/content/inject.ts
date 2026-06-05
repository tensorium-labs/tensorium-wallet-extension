// Content script — injected into *.tensoriumlabs.com pages.
// Injects the inpage provider and relays messages to the background.
// No imports: must compile to plain JS without module syntax.

const s = document.createElement('script');
s.src = (chrome as any).runtime.getURL('inpage.js');
(document.head || document.documentElement).prepend(s);

window.addEventListener('message', (e) => {
  if (e.source !== window || (e.data as any)?.txm_source !== 'inpage') return;
  const { id, method, params } = e.data as any;
  chrome.runtime.sendMessage({ type: 'dapp', method, params }, (resp) => {
    const err = chrome.runtime.lastError?.message;
    window.postMessage(
      { txm_source: 'content', id, ...(err ? { error: err } : resp) },
      '*'
    );
  });
});
