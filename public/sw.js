self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (error) {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Chat', {
      body: data.body || '',
      tag: data.tag || 'pipeelo-chat',
      renotify: true,
      data: { url: data.url || null },
    })
  );
});

function conversationOf(url) {
  const hash = url.indexOf('#');
  const query = url.indexOf('?');
  const raw = hash >= 0 ? url.slice(hash + 1) : query >= 0 ? url.slice(query + 1) : '';
  const params = new URLSearchParams(raw);
  const code = params.get('c');
  if (code) return code.toLowerCase();
  return ((params.get('id') || '') + (params.get('eid') || '')).replace(/-/g, '').toLowerCase();
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data && event.notification.data.url;
  if (!url) return;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const target = clients.find((client) => conversationOf(client.url) === conversationOf(url));
      return target ? target.focus() : self.clients.openWindow(url);
    })
  );
});
