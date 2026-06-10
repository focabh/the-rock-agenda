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

const VERSION = "v5-offline";
const STATIC_CACHE = "rock-static-" + VERSION;
const RUNTIME_CACHE = "rock-runtime-" + VERSION;

// Página de OFFLINE dedicada (HTML puro, sem React). Servida quando se navega
// pra uma rota que ainda não foi baixada. NUNCA servir outra rota cacheada no
// lugar — o HTML de "/" numa URL diferente quebra a hidratação (React #418).
const OFFLINE_HTML = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sem conexão</title><style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b0b0c;color:#e5e5e5;font-family:system-ui,-apple-system,sans-serif;text-align:center;padding:24px}.c{max-width:340px}h1{font-size:19px;margin:0 0 10px}p{color:#a1a1aa;font-size:14px;line-height:1.55;margin:0 0 18px}button{background:#dc2626;color:#fff;border:0;border-radius:9px;padding:11px 18px;font-size:14px;font-weight:600;cursor:pointer}</style></head><body><div class="c"><h1>📴 Sem conexão</h1><p>Essa tela ainda não foi baixada pra usar offline. Conecte uma vez à internet — ou toque em <b>"Baixar tudo pra offline"</b> no menu — e ela fica disponível no palco.</p><button onclick="location.reload()">Tentar de novo</button></div></body></html>`;

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

// Páginas e dados: NETWORK-FIRST com WRITE-THROUGH. Online sempre pega o fresco
// (nunca serve build velha, nunca trava o app) E grava uma cópia no RUNTIME —
// assim toda página/dado visitado fica disponível offline automaticamente, sem
// precisar "baixar". Offline cai no último visto; navegação sem cache cai no
// shell (/modo-show ou /). Como online é sempre rede-primeiro e os assets são
// versionados por hash, não há risco de servir build velha quando há conexão.
async function networkThenCacheOffline(request) {
  try {
    const res = await fetch(request);
    // Grava cópia de respostas boas same-origin (200, tipo basic) pra offline.
    if (res && res.ok && res.type === "basic") {
      const copy = res.clone();
      caches.open(RUNTIME_CACHE).then((cache) => cache.put(request, copy)).catch(() => {});
    }
    return res;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Navegação pra rota ainda não baixada → página de offline DEDICADA.
    // (Servir outra rota no lugar causava erro de hidratação React #418.)
    if (request.mode === "navigate") {
      return new Response(OFFLINE_HTML, {
        status: 200,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
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
    event.respondWith(networkThenCacheOffline(request));
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
