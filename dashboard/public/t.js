// Nexli Analytics Tracker — privacy-friendly, no cookies (~800 bytes minified)
(function () {
  var d = document,
    s = d.currentScript;
  if (!s) return;
  var cid = s.getAttribute("data-client-id");
  var endpoint =
    s.getAttribute("data-endpoint") ||
    s.src.replace(/\/t\.js.*/, "/api/track");
  if (!cid) return;

  function hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) {
      h = ((h << 5) - h + str.charCodeAt(i)) | 0;
    }
    return "v" + Math.abs(h).toString(36);
  }

  var fp = hash(
    navigator.userAgent +
      screen.width +
      screen.height +
      Intl.DateTimeFormat().resolvedOptions().timeZone
  );

  var payload = JSON.stringify({
    clientId: cid,
    pageUrl: location.href,
    referrer: d.referrer || null,
    userAgent: navigator.userAgent,
    sessionId: fp,
    timestamp: new Date().toISOString(),
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      endpoint,
      new Blob([payload], { type: "application/json" })
    );
  } else {
    fetch(endpoint, {
      method: "POST",
      body: payload,
      headers: { "Content-Type": "application/json" },
      keepalive: true,
    });
  }
})();
