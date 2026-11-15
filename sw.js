// 헤븐인 업무일정 앱 설치용 서비스워커
// 화면 파일은 항상 최신본을 먼저 받고, 인터넷이 끊겼을 때만 저장본을 보여 줍니다.
// 글 데이터는 저장하지 않습니다. 사진 미리보기는 화면이 따로 보관합니다(hia-thumbs).
var CACHE = 'heavenin-v4';
var SHELL = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.png', 'logo-full.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE && k.indexOf('hia-') !== 0; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req, { cache: 'no-cache' }).then(function (res) { // 브라우저 임시 저장본 대신 서버의 최신 화면을 확인합니다
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) { return hit || caches.match('./'); });
    })
  );
});

/* ---------- 새 일정 알림 ----------
   서버가 내용 없는 알림 신호를 보내면, 서버에서 알림 문구를 받아 띄웁니다. 누르면 웹앱을 엽니다. */
var API = 'https://script.google.com/macros/s/AKfycbyi7qyGBloWlyzilhxT63JSwaMWUuLksYX4km49evavfQyUwipPIyp7XZw1uhlkQKvF1A/exec';
self.addEventListener('push', function (e) {
  e.waitUntil(self.registration.pushManager.getSubscription().then(function (sub) {
    if (!sub) return [];
    return fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ fn: 'pushNotices', args: [sub.endpoint] }) })
      .then(function (r) { return r.json(); }).then(function (j) { return j && j.ok ? j.data : []; });
  }).catch(function () { return []; }).then(function (list) {
    if (!list || !list.length) list = [{ id: 'new', title: '헤븐인 업무일정', body: '새 일정이 올라왔습니다' }];
    return Promise.all(list.slice(0, 3).map(function (n) {
      return self.registration.showNotification(n.title || '헤븐인 업무일정', { body: n.body || '', tag: 'hia-' + n.id, icon: 'icon-192.png', badge: 'icon-192.png', data: { url: './' } });
    }));
  }));
});
self.addEventListener('notificationclick', function (e) {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
    for (var i = 0; i < list.length; i++) if ('focus' in list[i]) return list[i].focus();
    return self.clients.openWindow('./');
  }));
});
