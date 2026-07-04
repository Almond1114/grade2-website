(function () {
  const CONFIG = window.GRADE2_CONFIG || {};
  const STATUS_ID = "notificationStatus";
  const TIME_ID = "notifyTime";
  const PUSH_STATUS_ID = "pushStatus";
  const PUSH_TOKEN_ID = "pushTokenText";
  const OVERLAY_ID = "startupOverlay";
  const STARTUP_STATUS_ID = "startupStatus";

  let messaging = null;
  let firebaseRegistration = null;
  let reminderTimer = null;

  const $ = (id) => document.getElementById(id);

  function setStatus(text) {
    const box = $(STATUS_ID);
    if (box) box.textContent = text;
  }

  function setPushStatus(text) {
    const box = $(PUSH_STATUS_ID);
    if (box) box.textContent = text;
  }

  function setStartupStatus(text) {
    const box = $(STARTUP_STATUS_ID);
    if (box) box.textContent = text;
  }

  function setTokenText(token) {
    const box = $(PUSH_TOKEN_ID);
    if (!box) return;
    box.textContent = token ? `${token.slice(0, 18)}...${token.slice(-10)}` : "未登録";
    box.title = token || "";
  }

  function toast(message) {
    if (typeof window.toast === "function") return window.toast(message);
    const box = document.getElementById("toast");
    if (!box) return;
    box.textContent = message;
    box.classList.add("show");
    window.clearTimeout(toast.timer);
    toast.timer = window.setTimeout(() => box.classList.remove("show"), 2200);
  }

  function getGasUrl() {
    try {
      return typeof GAS_URL !== "undefined" ? String(GAS_URL || "").trim() : String(CONFIG.GAS_URL || "").trim();
    } catch {
      return String(CONFIG.GAS_URL || "").trim();
    }
  }

  function getDeviceId() {
    const key = "grade2DeviceId";
    let id = localStorage.getItem(key);
    if (!id) {
      id = "web_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(key, id);
    }
    return id;
  }

  function getSelectedClass() {
    return window.grade2App?.getSnapshot?.().selectedClass || localStorage.getItem("grade2SelectedClass") || "未選択";
  }

  function getPlatform() {
    const ua = navigator.userAgent.toLowerCase();
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone;
    if (/iphone|ipad|ipod/.test(ua)) return standalone ? "ios-pwa" : "ios-safari";
    if (/android/.test(ua)) return standalone ? "android-pwa" : "android-web";
    return standalone ? "desktop-pwa" : "desktop-web";
  }

  function jsonpCall(url) {
    return new Promise((resolve, reject) => {
      const callbackName = "web_push_callback_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const separator = url.includes("?") ? "&" : "?";
      const timer = window.setTimeout(() => {
        cleanup();
        reject(new Error("通信がタイムアウトしました"));
      }, 18000);

      function cleanup() {
        window.clearTimeout(timer);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = (data) => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error("通信に失敗しました"));
      };

      script.src = `${url}${separator}callback=${callbackName}`;
      document.body.appendChild(script);
    });
  }

  function firebaseConfigReady() {
    const cfg = CONFIG.FIREBASE_CONFIG || {};
    return Boolean(cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId && CONFIG.FIREBASE_VAPID_KEY);
  }

  async function registerServiceWorkers() {
    if (!("serviceWorker" in navigator)) {
      throw new Error("このブラウザはService Workerに対応していません");
    }

    try {
      await navigator.serviceWorker.register("sw.js");
    } catch (error) {
      console.warn("PWA Service Worker登録失敗", error);
    }

    firebaseRegistration = await navigator.serviceWorker.register("firebase-messaging-sw.js");
    return firebaseRegistration;
  }

  async function requestNotificationPermission() {
    if (!("Notification" in window)) {
      setStatus("このブラウザでは通知が使えません。");
      return false;
    }

    if (Notification.permission === "granted") {
      setStatus("通知はすでに許可されています。");
      return true;
    }

    if (Notification.permission === "denied") {
      setStatus("通知がブロックされています。ブラウザやスマホの設定から許可してください。");
      return false;
    }

    const permission = await Notification.requestPermission();
    const ok = permission === "granted";
    setStatus(ok ? "通知を許可しました。" : "通知が許可されませんでした。");
    return ok;
  }

  async function initFirebaseMessaging() {
    if (!firebaseConfigReady()) {
      throw new Error("Firebase Web Push設定が未入力です。app-config.js と firebase-config-sw.js を設定してください。");
    }
    if (!window.firebase?.messaging) {
      throw new Error("Firebase SDKを読み込めませんでした。ネット接続やscriptタグを確認してください。");
    }

    if (!firebase.apps.length) firebase.initializeApp(CONFIG.FIREBASE_CONFIG);
    messaging = firebase.messaging();

    if (typeof messaging.onMessage === "function") {
      messaging.onMessage((payload) => {
        const title = payload?.notification?.title || payload?.data?.title || "2年便利サイト";
        const body = payload?.notification?.body || payload?.data?.body || "更新通知を受信しました。";
        setPushStatus(`${title}: ${body}`);
        toast("通知を受信しました");
        if (window.grade2App?.reload) window.grade2App.reload();
        if (Notification.permission === "granted" && document.visibilityState === "visible") {
          try {
            new Notification(title, { body, icon: "icons/icon-192.png" });
          } catch (error) {
            console.warn(error);
          }
        }
      });
    }

    return messaging;
  }

  async function registerTokenToServer(token) {
    const gasUrl = getGasUrl();
    if (!token) {
      setPushStatus("トークンが空です。もう一度登録してください。");
      return false;
    }
    if (!gasUrl) {
      setPushStatus("GAS_URL未設定。端末内には保存しましたが、編集通知は送れません。");
      return false;
    }

    const params = new URLSearchParams({
      action: "registerPushToken",
      token,
      platform: getPlatform(),
      deviceId: getDeviceId(),
      className: getSelectedClass(),
      userAgent: navigator.userAgent.slice(0, 300),
      appVersion: CONFIG.APP_VERSION || "2.0.0-web"
    });

    try {
      const result = await jsonpCall(`${gasUrl}?${params.toString()}&_=${Date.now()}`);
      if (result?.ok) {
        setPushStatus(`編集通知を受け取れるようにしました。登録端末数: ${result.count ?? "-"}`);
        return true;
      }
      setPushStatus(`登録できませんでした: ${result?.error || "不明なエラー"}`);
      return false;
    } catch (error) {
      setPushStatus(`登録通信に失敗しました: ${error.message}`);
      return false;
    }
  }

  async function registerRemotePush() {
    if (!("serviceWorker" in navigator)) {
      setPushStatus("このブラウザではPush通知が使えません。");
      return false;
    }

    const ok = await requestNotificationPermission();
    if (!ok) return false;

    try {
      setPushStatus("Firebase Web Pushを準備中...");
      const registration = await registerServiceWorkers();
      const msg = await initFirebaseMessaging();
      const token = await msg.getToken({
        vapidKey: CONFIG.FIREBASE_VAPID_KEY,
        serviceWorkerRegistration: registration
      });

      if (!token) {
        setPushStatus("通知トークンを取得できませんでした。ブラウザの通知設定を確認してください。");
        return false;
      }

      localStorage.setItem("grade2PushToken", token);
      setTokenText(token);
      await registerTokenToServer(token);
      return true;
    } catch (error) {
      console.error(error);
      setPushStatus(`Push登録エラー: ${error.message}`);
      return false;
    }
  }

  async function unregisterRemotePush() {
    const token = localStorage.getItem("grade2PushToken") || "";
    const gasUrl = getGasUrl();

    if (!token) {
      setPushStatus("このブラウザはまだプッシュ登録されていません。");
      return;
    }

    try {
      if (messaging?.deleteToken) await messaging.deleteToken(token);
    } catch (error) {
      console.warn("Firebase token delete failed", error);
    }

    if (gasUrl) {
      const params = new URLSearchParams({ action: "unregisterPushToken", token, deviceId: getDeviceId() });
      try {
        const result = await jsonpCall(`${gasUrl}?${params.toString()}&_=${Date.now()}`);
        if (!result?.ok) setPushStatus(`サーバー解除に失敗: ${result?.error || "不明なエラー"}`);
      } catch (error) {
        setPushStatus(`解除通信に失敗しました: ${error.message}`);
      }
    }

    localStorage.removeItem("grade2PushToken");
    setTokenText("");
    setPushStatus("このブラウザのプッシュ登録を解除しました。");
  }

  function buildNotificationBody() {
    const snapshot = window.grade2App?.getSnapshot?.();
    if (!snapshot) return "明日の時間割・提出物・テストを確認しよう。";

    const parts = [];
    if (snapshot.selectedClass) parts.push(snapshot.selectedClass);
    if (snapshot.tomorrow?.timetable) {
      const subjects = ["1時間目", "2時間目", "3時間目", "4時間目", "5時間目", "6時間目"]
        .map(key => snapshot.tomorrow.timetable[key])
        .filter(Boolean)
        .slice(0, 3)
        .join("・");
      if (subjects) parts.push(`明日: ${subjects}...`);
    }
    if (snapshot.nextHomework?.タイトル) parts.push(`提出物: ${snapshot.nextHomework.タイトル}`);
    if (snapshot.nextTest?.タイトル) parts.push(`テスト: ${snapshot.nextTest.タイトル}`);
    return parts.length ? parts.join(" / ") : "明日の時間割・提出物・テストを確認しよう。";
  }

  function getSelectedTime() {
    const input = $(TIME_ID);
    const defaultTime = CONFIG.DEFAULT_NOTIFY_TIME || "20:00";
    const value = input?.value || localStorage.getItem("grade2NotifyTime") || defaultTime;
    const [hour, minute] = value.split(":").map(Number);
    return { value, hour: Number.isFinite(hour) ? hour : 20, minute: Number.isFinite(minute) ? minute : 0 };
  }

  function msUntilNext(hour, minute) {
    const date = new Date();
    date.setHours(hour, minute, 0, 0);
    if (date <= new Date()) date.setDate(date.getDate() + 1);
    return date.getTime() - Date.now();
  }

  function scheduleInPageReminder(options = {}) {
    const { value, hour, minute } = getSelectedTime();
    localStorage.setItem("grade2NotifyTime", value);
    window.clearTimeout(reminderTimer);

    if (Notification.permission === "granted") {
      reminderTimer = window.setTimeout(() => {
        try {
          new Notification("2年便利サイト", { body: buildNotificationBody(), icon: "icons/icon-192.png" });
        } catch (error) {
          console.warn(error);
        }
        scheduleInPageReminder({ silent: true });
      }, msUntilNext(hour, minute));
    }

    if (!options.silent) {
      setStatus(`毎日 ${value} の確認通知を保存しました。サイトを閉じていても通知したい場合は、Apps Scriptの時間トリガーも設定してください。`);
    }
    return true;
  }

  async function scheduleDailyNotifications(options = {}) {
    const ok = options.skipPermission ? Notification.permission === "granted" : await requestNotificationPermission();
    if (!ok) return false;
    return scheduleInPageReminder();
  }

  async function testNotification() {
    const ok = await requestNotificationPermission();
    if (!ok) return;
    try {
      new Notification("2年便利サイト", { body: buildNotificationBody(), icon: "icons/icon-192.png" });
      setStatus("ブラウザ通知を表示しました。");
    } catch (error) {
      setStatus(`通知表示に失敗しました: ${error.message}`);
    }
  }

  async function sendFirebaseTestPush() {
    const gasUrl = getGasUrl();
    if (!gasUrl) {
      setPushStatus("GAS_URL未設定なので、Firebase送信テストはできません。");
      return;
    }
    setPushStatus("全登録端末へテストPushを送信中...");
    const params = new URLSearchParams({
      action: "sendPushTest",
      title: "2年便利サイト",
      body: buildNotificationBody(),
      className: getSelectedClass()
    });
    try {
      const result = await jsonpCall(`${gasUrl}?${params.toString()}&_=${Date.now()}`);
      if (result?.ok) {
        setPushStatus(`送信完了: 成功 ${result.sent || 0} / 失敗 ${result.failed || 0}`);
      } else {
        setPushStatus(`送信できませんでした: ${result?.error || "不明なエラー"}`);
      }
    } catch (error) {
      setPushStatus(`送信通信に失敗しました: ${error.message}`);
    }
  }

  async function completeOneTapSetup() {
    setStartupStatus("通知の許可を確認しています...");
    const localOk = await requestNotificationPermission();

    if (localOk) {
      setStartupStatus("通知時刻を保存しています...");
      scheduleInPageReminder({ silent: true });
    }

    if (localOk && CONFIG.AUTO_PUSH_REGISTER !== false) {
      setStartupStatus("編集通知を受け取るためブラウザ登録しています...");
      await registerRemotePush();
    }

    localStorage.setItem("grade2SetupDone", "true");
    hideStartupOverlay();
    toast(localOk ? "通知設定が完了しました" : "通知なしで開始しました");
    setStartupStatus(localOk ? "設定完了" : "通知なしで開始しました");
    return localOk;
  }

  function hideStartupOverlay() {
    const overlay = $(OVERLAY_ID);
    if (overlay) overlay.classList.add("hidden");
  }

  function showStartupOverlayIfNeeded() {
    const overlay = $(OVERLAY_ID);
    if (!overlay) return;
    const done = localStorage.getItem("grade2SetupDone") === "true";
    const enabled = CONFIG.AUTO_ONBOARDING !== false;
    if (!enabled || done) overlay.classList.add("hidden");
    else overlay.classList.remove("hidden");
  }

  function refreshTokenClassRegistration() {
    const token = localStorage.getItem("grade2PushToken") || "";
    if (token) registerTokenToServer(token);
  }

  function initNotificationUi() {
    registerServiceWorkers().catch(error => console.warn(error));

    const defaultTime = CONFIG.DEFAULT_NOTIFY_TIME || "20:00";
    const savedTime = localStorage.getItem("grade2NotifyTime") || defaultTime;
    if ($(TIME_ID)) $(TIME_ID).value = savedTime;

    const savedToken = localStorage.getItem("grade2PushToken");
    setTokenText(savedToken || "");

    $("startAppBtn")?.addEventListener("click", completeOneTapSetup);
    $("skipSetupBtn")?.addEventListener("click", () => {
      localStorage.setItem("grade2SetupDone", "true");
      hideStartupOverlay();
      toast("あとで通知設定できます");
    });
    $("enableNotificationsBtn")?.addEventListener("click", completeOneTapSetup);
    $("scheduleNotificationsBtn")?.addEventListener("click", scheduleDailyNotifications);
    $("testNotificationBtn")?.addEventListener("click", testNotification);
    $("registerPushBtn")?.addEventListener("click", registerRemotePush);
    $("sendPushTestBtn")?.addEventListener("click", sendFirebaseTestPush);
    $("unregisterPushBtn")?.addEventListener("click", unregisterRemotePush);

    window.addEventListener("grade2:class-changed", refreshTokenClassRegistration);
    window.addEventListener("grade2:data-updated", () => {
      if (localStorage.getItem("grade2SetupDone") === "true" && Notification.permission === "granted") {
        scheduleInPageReminder({ silent: true });
      }
    });

    if (Notification.permission === "granted") scheduleInPageReminder({ silent: true });

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const standalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone;
    if (ios && !standalone) {
      setStatus("iPhoneはSafariでホーム画面に追加してから通知を許可すると安定します。");
      setPushStatus("iPhoneはホーム画面に追加したWebアプリでWeb Pushを使えます。");
    } else {
      setStatus("Webサイト版として起動中。通知許可だけで開始できます。");
      setPushStatus(savedToken ? "このブラウザは編集通知に登録済みです。" : "通知許可後に自動登録します。");
    }

    showStartupOverlayIfNeeded();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initNotificationUi);
  } else {
    initNotificationUi();
  }
})();
