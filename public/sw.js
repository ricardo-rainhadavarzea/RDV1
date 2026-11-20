self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => event.respondWith(fetch(event.request)));

// Lembretes de ruptura (notificação push). O servidor manda { titulo, texto, tag, url }.
self.addEventListener('push', (event) => {
  let dados = {};
  try {
    dados = event.data ? event.data.json() : {};
  } catch {
    dados = {};
  }
  event.waitUntil(
    self.registration.showNotification(dados.titulo || 'Hora da ruptura', {
      body: dados.texto || 'Faça a checagem de ruptura.',
      icon: '/ruptura-192.png',
      badge: '/ruptura-192.png',
      tag: dados.tag || 'ruptura',
      renotify: true,
      data: { url: dados.url || '/?app=ruptura' },
    })
  );
});

// Tocar na notificação abre (ou volta para) o app da Ruptura.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/?app=ruptura';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((janelas) => {
      const aberta = janelas.find((j) => j.url.includes('app=ruptura'));
      if (aberta && 'focus' in aberta) return aberta.focus();
      return self.clients.openWindow(url);
    })
  );
});
