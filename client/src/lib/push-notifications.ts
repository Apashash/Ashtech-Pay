import { apiRequest } from "@/lib/queryClient";

export type PushSupport =
  | { supported: true; installedOnIos: boolean }
  | { supported: false; reason: "unsupported" | "ios-home-screen" };

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isIosHomeScreen(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches
    || Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
}

export function getPushSupport(): PushSupport {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { supported: false, reason: "unsupported" };
  }
  if (isIos() && !isIosHomeScreen()) {
    return { supported: false, reason: "ios-home-screen" };
  }
  return { supported: true, installedOnIos: isIos() };
}

function urlBase64ToArrayBuffer(value: string): ArrayBuffer {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes.buffer;
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  await navigator.serviceWorker.ready;
  return registration;
}

export async function hasPushSubscription(): Promise<boolean> {
  const support = getPushSupport();
  if (!support.supported) return false;
  const registration = await getRegistration();
  return Boolean(await registration.pushManager.getSubscription());
}

export async function subscribeToPush(): Promise<void> {
  const support = getPushSupport();
  if (!support.supported) {
    if (support.reason === "ios-home-screen") {
      throw new Error("Sur iPhone, ajoutez d'abord AshTech Pay à l'écran d'accueil, puis ouvrez-le depuis son icône.");
    }
    throw new Error("Ce navigateur ne prend pas en charge les notifications push.");
  }

  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;
  if (permission !== "granted") {
    throw new Error("L'autorisation des notifications a été refusée. Activez-la dans les réglages du navigateur.");
  }

  const publicKeyResponse = await apiRequest("GET", "/api/push/public-key");
  const publicKeyData = await publicKeyResponse.json();
  if (!publicKeyResponse.ok || !publicKeyData.publicKey) {
    throw new Error(publicKeyData.message || "Le service de notifications n'est pas configuré.");
  }

  const registration = await getRegistration();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToArrayBuffer(publicKeyData.publicKey),
    });
  }

  const json = subscription.toJSON();
  const response = await apiRequest("POST", "/api/push-subscriptions", {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh,
    auth: json.keys?.auth,
  });
  if (!response.ok) {
    throw new Error((await response.json()).message || "Impossible d'enregistrer cet appareil.");
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  const support = getPushSupport();
  if (!support.supported) return;
  const registration = await getRegistration();
  const subscription = await registration.pushManager.getSubscription();
  if (!subscription) return;

  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  const response = await apiRequest("DELETE", "/api/push-subscriptions", { endpoint });
  if (!response.ok) {
    throw new Error((await response.json()).message || "Impossible de désactiver les notifications.");
  }
}