
const CACHE_NAME = "mini-robot-control-v2";

const ARCHIVOS = [
    "./",
    "./index.html",
    "./style.css",
    "./app.js",
    "./manifest.json",
    "./icon.svg"
];


// =====================================
// INSTALACIÓN
// =====================================

self.addEventListener("install", event => {

    event.waitUntil(

        caches.open(CACHE_NAME).then(cache => {
            return cache.addAll(ARCHIVOS);
        })

    );

    self.skipWaiting();
});


// =====================================
// ACTIVACIÓN Y LIMPIEZA DE CACHÉ
// =====================================

self.addEventListener("activate", event => {

    event.waitUntil(

        caches.keys().then(keys => {

            return Promise.all(

                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))

            );

        })

    );

    self.clients.claim();
});


// =====================================
// ACTUALIZACIÓN DE ARCHIVOS
// =====================================

self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") return;

    const url = new URL(event.request.url);

    // Solo gestionar archivos de nuestra aplicación
    if (url.origin !== self.location.origin) return;

    const esAppJS = url.pathname.endsWith("/app.js");
    const esHTML =
        event.request.mode === "navigate" ||
        url.pathname.endsWith("/index.html");

    // APP.JS Y HTML: PRIMERO BUSCAR EN INTERNET
    if (esAppJS || esHTML) {

        event.respondWith(

            fetch(event.request)
                .then(response => {

                    if (response.ok) {

                        const copia = response.clone();

                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(event.request, copia);
                        });
                    }

                    return response;

                })
                .catch(async () => {

                    const guardado = await caches.match(event.request);

                    if (guardado) return guardado;

                    return caches.match("./index.html");
                })

        );

        return;
    }


    // RESTO DE ARCHIVOS: CACHÉ PRIMERO

    event.respondWith(

        caches.match(event.request).then(cached => {

            if (cached) return cached;

            return fetch(event.request).then(response => {

                if (response.ok) {

                    const copia = response.clone();

                    caches.open(CACHE_NAME).then(cache => {
                        cache.put(event.request, copia);
                    });
                }

                return response;
            });

        })

    );

});
