// Veya AI — фоновый помощник: показывает уведомления, когда приложение закрыто.
// Текст уведомления берётся из памяти телефона (сервер его не знает).
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

function idb() {
  return new Promise((res, rej) => { const r = indexedDB.open('veya'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function kvGet(k) {
  const db = await idb();
  return new Promise((res, rej) => { const t = db.transaction('kv').objectStore('kv').get(k); t.onsuccess = () => res(t.result); t.onerror = () => rej(t.error); });
}
async function kvSet(k, v) {
  const db = await idb();
  return new Promise((res, rej) => { const tx = db.transaction('kv', 'readwrite'); tx.objectStore('kv').put(v, k); tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error); });
}

self.addEventListener('push', e => {
  e.waitUntil((async () => {
    let d = {};
    try { d = e.data ? e.data.json() : {}; } catch (_) {}
    let item = null;
    try {
      const q = (await kvGet('pushq')) || [];
      item = q.find(x => x.id === d.id) || q.filter(x => x.at <= Date.now() + 120000).sort((a, b) => a.at - b.at)[0] || null;
      if (item) await kvSet('pushq', q.filter(x => x !== item && x.id !== item.id));
      const badge = ((await kvGet('badge')) || 0) + 1;
      await kvSet('badge', badge);
      if (self.navigator.setAppBadge) self.navigator.setAppBadge(badge).catch(() => {});
    } catch (_) {}
    const title = item ? item.title : 'Veya';
    const body = item ? item.body : 'Новое сообщение';
    await self.registration.showNotification(title, {
      body, tag: item && item.chatId ? 'chat-' + item.chatId : 'veya',
      icon: 'icon-192.png', badge: 'icon-192.png',
      data: { chatId: item ? item.chatId : null },
    });
  })());
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const chatId = e.notification.data && e.notification.data.chatId;
  e.waitUntil((async () => {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    if (list.length) { const c = list[0]; await c.focus(); c.postMessage({ openChat: chatId }); return; }
    await self.clients.openWindow('./' + (chatId ? '?chat=' + encodeURIComponent(chatId) : ''));
  })());
});
