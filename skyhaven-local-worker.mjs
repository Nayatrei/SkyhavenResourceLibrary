import {localResponse} from './assets/skyhaven-local-response.mjs?v=20261023-connect-v2';
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
self.addEventListener('fetch',event=>{
  if(new URL(event.request.url).pathname.startsWith(new URL('__local/',self.registration.scope).pathname))event.respondWith(localResponse(event.request,self.registration.scope));
});
