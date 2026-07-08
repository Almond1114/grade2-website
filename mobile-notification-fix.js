// 2Base mobile notification helper v1
// iPhone / Android の通知設定を分かりやすく分岐します。
(function () {
  if (window.__grade2MobileNotificationFix) return;
  window.__grade2MobileNotificationFix = true;

  const ua = navigator.userAgent || "";
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  const isStandalone = window.matchMedia?.("(display-mode: standalone)")?.matches || window.navigator.standalone === true;

  const $ = (id) => document.getElementById(id);
  const setText = (id, text) => { const el = $(id); if (el) el.textContent = text; };

  function hideStartupOverlay() {
    const overlay = $("startupOverlay");
    if (overlay) overlay.classList.add("hidden");
  }

  function showNotice() {
    if (!document.body.matches('[data-page="notifications"]')) return;
    if ($("mobileNotifyGuide")) return;

    const pageTitle = document.querySelector(".page-title");
    if (!pageTitle) return;

    const guide = document.createElement("div");
    guide.id = "mobileNotifyGuide";
    guide.className = "connection-banner live";

    if (isIOS && !isStandalone) {
      guide.innerHTML = "<b>iPhone通知の準備：</b><br>Safariの共有ボタン → <b>ホーム画面に追加</b> → ホーム画面の2Baseから開く → 通知を許可。SafariのタブのままだとiPhoneのWeb Pushは使えません。";
    } else if (isIOS && isStandalone) {
      guide.innerHTML = "<b>iPhoneアプリ版で起動中：</b><br>下の『通知を許可して始める』で通知許可とテスト通知を使えます。編集通知のFirebase登録はAndroid/PC向けです。";
    } else if (isAndroid) {
      guide.innerHTML = "<b>Androidで起動中：</b><br>通知を許可するとFirebase Push登録できます。編集時の通知も使えます。";
    } else {
      guide.innerHTML = "<b>通知設定：</b><br>通知を許可すると、この端末で通知テストとFirebase Push登録を使えます。";
    }

    pageTitle.appendChild(guide);
  }

  async function requestLocalPermission() {
    if (!("Notification" in window)) {
      setText("notificationStatus", "この端末ではブラウザ通知が使えません。");
      setText("startupStatus", "この端末ではブラウザ通知が使えません。");
      return false;
    }

    if (Notification.permission === "denied") {
      const msg = "通知がブロックされています。iPhoneの設定 → 通知 → 2Base から許可してください。";
      setText("notificationStatus", msg);
      setText("startupStatus", msg);
      return false;
    }

    const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
    const ok = permission === "granted";
    const msg = ok ? "通知を許可しました。テスト通知を送ります。" : "通知が許可されませんでした。";
    setText("notificationStatus", msg);
    setText("startupStatus", msg);
    return ok;
  }

  function sendLocalTestNotification() {
    try {
      new Notification("2Base", {
        body: "通知テスト成功。2Baseの通知を受け取れます。",
        icon: "icons/icon-192.png",
        badge: "icons/icon-192.png"
      });
      setText("notificationStatus", "テスト通知を表示しました。");
    } catch (error) {
      setText("notificationStatus", "通知表示に失敗しました: " + error.message);
    }
  }

  async function handleIOSClick(event) {
    const button = event.target.closest("button");
    if (!button) return;

    const notificationButtons = [
      "startAppBtn",
      "enableNotificationsBtn",
      "scheduleNotificationsBtn",
      "testNotificationBtn",
      "registerPushBtn",
      "sendPushTestBtn"
    ];
    if (!notificationButtons.includes(button.id)) return;

    // iPhoneはSafariタブのままだとHome Screen Web Push不可。Firebase登録へ進ませない。
    if (isIOS && !isStandalone) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const msg = "iPhoneはまずSafariの共有ボタンから『ホーム画面に追加』して、ホーム画面の2Baseから開いてください。";
      setText("notificationStatus", msg);
      setText("pushStatus", msg);
      setText("startupStatus", msg);
      return;
    }

    // iPhone PWAではFirebase登録ボタンは使わず、端末通知の許可とテストに集中。
    if (isIOS && isStandalone) {
      event.preventDefault();
      event.stopImmediatePropagation();

      if (button.id === "registerPushBtn" || button.id === "sendPushTestBtn") {
        const msg = "iPhoneではFirebase登録ではなく、ホーム画面アプリの通知許可を使います。『テスト通知』で確認してください。";
        setText("pushStatus", msg);
        setText("notificationStatus", msg);
        return;
      }

      const ok = await requestLocalPermission();
      if (ok) {
        localStorage.setItem("grade2SetupDone", "true");
        hideStartupOverlay();
        sendLocalTestNotification();
        setText("pushStatus", "iPhoneの通知許可は完了。Android/PCのFirebase Pushとは別方式です。");
      }
    }
  }

  function init() {
    showNotice();

    if (isIOS && !isStandalone) {
      setText("notificationStatus", "iPhoneはSafariで共有 → ホーム画面に追加 → ホーム画面の2Baseから開いて通知を許可してください。");
      setText("pushStatus", "SafariタブではiPhoneのWeb Pushは使えません。ホーム画面に追加してください。");
      setText("startupStatus", "Safariの共有ボタンからホーム画面に追加してください。");
    }

    if (isIOS && isStandalone) {
      setText("notificationStatus", "iPhoneアプリ版です。通知を許可してテスト通知を確認してください。");
      setText("pushStatus", "iPhoneではFirebase登録ボタンではなく、ホーム画面アプリの通知許可を使います。");
    }

    document.addEventListener("click", handleIOSClick, true);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
