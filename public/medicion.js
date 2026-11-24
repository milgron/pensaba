/*
 * Medición de visitas con PostHog (región UE), en vez de Plausible. Plan: docs/plan-migracion-posthog-2026-11-24.md.
 * Original en infra-taller-oliva/configs/posthog/medicion.js: cada sitio tiene una copia idéntica en public/medicion.js
 * (en WordPress, en el tema). Si cambia acá, se copia en todos.
 *
 * - Sin cookies ni storage: cookieless_mode "always". El proyecto de PostHog tiene que tener activado "cookieless
 *   tracking" (Settings → Project → Web analytics), como pide la guía de PostHog, antes de que llegue el primer evento.
 * - Sale por el proxy del propio dominio, /cauce, para que los bloqueadores no lo corten. Otro host se pasa con
 *   data-api-host en el <script> (p. ej. el proxy administrado de PostHog o https://eu.i.posthog.com).
 * - Manda solo: páginas vistas (también la navegación interna de los sitios Next), salidas de página, clics en links
 *   externos, descargas y formularios enviados. Los links van sin ?… ni #…, y de los formularios no va nada de lo escrito.
 *   Sin autocapture, sin grabación, sin encuestas.
 * - Con ?yo=1 en la URL no carga: así no te medís a vos mismo.
 */
(function () {
  if (new URLSearchParams(location.search).get("yo") === "1") return;
  var script = document.currentScript;
  var HOST = (script && script.getAttribute("data-api-host")) || "/cauce";

  // El snippet de PostHog: deja una cola de llamadas y baja la librería de <host>/static/array.js.
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister reset get_distinct_id set_config opt_out_capturing".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  // La clave del proyecto es pública (va en cada página). Está acá y no en una variable de entorno para que un deploy
  // sin la variable no apague la medición sin avisar.
  window.posthog.init("phc_m26EmApBQikF85T5ubUgG3XrFqBAtmHbcQLyqvyk3TJx", {
    api_host: HOST,
    ui_host: "https://eu.posthog.com",
    defaults: "2026-08-30",
    cookieless_mode: "always",
    person_profiles: "identified_only",
    capture_pageview: "history_change",
    capture_pageleave: true,
    autocapture: false,
    rageclick: false,
    capture_dead_clicks: false,
    capture_performance: false,
    capture_exceptions: false,
    disable_session_recording: true,
    disable_surveys: true,
    disable_product_tours: true,
    disable_conversations: true,
    disable_web_experiments: true
  });

  // Los objetivos que Plausible medía solo (salvo el 404, que ningún sitio mandaba).
  var DESCARGA = /\.(pdf|xlsx?|docx?|txt|rtf|csv|exe|key|pps|pptx?|7z|pkg|rar|gz|zip|avi|mov|mp4|mpe?g|wmv|midi?|mp3|wav|wma|dmg)$/i;
  function clic(e) {
    if (e.type === "auxclick" && e.button !== 1) return;
    var a = e.target instanceof Element ? e.target.closest("a[href]") : null;
    if (!a) return;
    var u;
    try { u = new URL(a.href, location.href); } catch (err) { return; }
    if (u.protocol !== "http:" && u.protocol !== "https:") return;
    var url = u.origin + u.pathname;
    if (DESCARGA.test(u.pathname)) window.posthog.capture("descarga", { url: url });
    else if (u.host !== location.host) window.posthog.capture("link_externo", { url: url });
  }
  document.addEventListener("click", clic, true);
  document.addEventListener("auxclick", clic, true);
  document.addEventListener("submit", function () { window.posthog.capture("formulario"); }, true);
})();
