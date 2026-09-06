/* AshTech Pay Web Push service worker */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "AshTech Pay", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "AshTech Pay";
  const options = {
    body: data.body || "Vous avez une nouvelle notification.",
    icon: "/favicon.png",
    badge: "/favicon.png",
    lang: "fr",
    dir: "auto",
    tag: data.transactionId ? `ashtech-${data.transactionId}` : (data.type || "ashtech-notification"),
    renotify: true,
    actions: [{ action: "open", title: "Consulter mon compte" }],
    data: { url: data.url || "/dashboard/notifications", transactionId: data.transactionId || null },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/dashboard/notifications", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => "focus" in client);
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    }),
  );
});