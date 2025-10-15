chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.type !== 'uconn-menu-fetch' || typeof message.url !== 'string') {
    return;
  }

  const controller = new AbortController();
  const signal = controller.signal;

  const timeout = setTimeout(() => {
    controller.abort();
  }, 15000);

  fetch(message.url, {
    credentials: 'include',
    signal,
    headers: {
      'X-Requested-With': 'XMLHttpRequest'
    }
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const html = await response.text();
      sendResponse({ success: true, html });
    })
    .catch((error) => {
      sendResponse({ success: false, error: error.message || String(error) });
    })
    .finally(() => {
      clearTimeout(timeout);
    });

  return true;
});
