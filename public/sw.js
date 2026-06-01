// Service worker do The Rock — Web Push + cache offline (leitura).
//
// Estratégia (pensada pra não servir build velha):
//  - Assets imutáveis (/_next/static, ícones): cache-first (nome com hash muda
//    a cada build, então nunca serve velho de verdade).
//  - Navegações/páginas/dados (GET same-origin): NETWORK-FIRST — online sempre
//    pega o fresco e atualiza o cache; offline cai no último visto.
//  - Só GET é cacheado. Server Actions (POST) nunca — mutações exigem rede.
//  - "Modo Show": a página warm-a o próprio cache via postMessage pra garantir
//    o pacote do show inteiro disponível offline.

const VERSION = "v2-offline";
const STATIC_CACHE = "rock-static-" + VERSION;
const RUNTIME_CACHE = "rock-runtime-" + VERSION;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

function isImmutableAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:js|css|woff2?|ttf|png|jpg|jpeg|webp|svg|ico)$/.test(url.pathname)
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res && res.ok) {
    const cache = await caches.open(STATIC_CACHE);
    cache.put(request, res.clone());
  }
  return res;
}

async function networkFirst(request) {
  try {
    const res = await fetch(request);
    // Não cacheia redirecionado (ex.: sessão expirada → /login) nem opaco.
    if (res && res.ok && res.type === "basic" && !res.redirected) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Navegação sem rede e sem cache → tenta o Modo Show (pacote offline).
    if (request.mode === "navigate") {
      const fallback =
        (await caches.match("/modo-show")) || (await caches.match("/"));
      if (fallback) return fallback;
    }
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return; // mutações só por rede
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return; // não mexe em terceiros
  // Não cacheia o próprio SW nem o manifest (sempre fresco).
  if (url.pathname === "/sw.js") return;

  if (isImmutableAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else {
    event.respondWith(networkFirst(request));
  }
});

// "Baixar pra offline": a página manda as URLs a pré-cachear (a própria página
// + letras/recursos). Cacheamos no RUNTIME pra ficar igual à navegação.
self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "WARM_CACHE" && Array.isArray(msg.urls)) {
    event.waitUntil(
      (async () => {
        const cache = await caches.open(RUNTIME_CACHE);
        await Promise.all(
          msg.urls.map(async (u) => {
            try {
              const res = await fetch(u, { credentials: "same-origin" });
              if (res && res.ok) await cache.put(u, res.clone());
            } catch {
              /* ignora o que não der */
            }
          })
        );
        // Avisa quem pediu que terminou.
        const clientsArr = await self.clients.matchAll();
        for (const c of clientsArr) c.postMessage({ type: "WARM_CACHE_DONE" });
      })()
    );
  }
});

self.addEventListener("push", function (event) {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch (e) {
    data = { title: "The Rock", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "The Rock";
  const options = {
    body: data.body || "",
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    vibrate: [100, 50, 100],
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    data: { url: data.url || "/" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", function (event) {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            client.focus();
            if ("navigate" in client && target) client.navigate(target);
            return;
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(target);
      })
  );
});
