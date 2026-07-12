// 2Base mobile notification helper v2
// iPhone / Android の通知条件を案内しつつ、対応端末ではFirebase登録を止めません。
(function () {
  if (window.__grade2MobileNotificationFixV2) return;
  window.__grade2MobileNotificationFixV2 = true;

  const ua = navigator.userAgent || "";
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  const isStandalone = Boolean(
    window.matchMedia?.("(display-mode: standalone)")?.matches ||
    window.navigator.standalone === true
  );

  const $ = (id) => document.getElementById(id);
  const setText = (id, value) => {
    const el = $(id);
    if (el) el.textContent = value;
  };

  function addGuide() {
    if (!document.body.matches('[data-page="notifications"]')) return;
    if ($("mobileNotifyGuide")) return;

    const pageTitle = document.querySelector(".page-title");
    if (!pageTitle) return;

    const guide = document.createElement("div");
    guide.id = "mobileNotifyGuide";
    guide.className = "connection-banner live";

    if (isIOS && !isStandalone) {
      guide.innerHTML = "<b>iPhoneで通知を使う準備</b><br>Safariの共有ボタン → <b>ホーム画面に追加</b> → ホーム画面の2Baseから開く → 通知を許可してください。";
    } else if (isIOS && isStandalone) {
      guide.innerHTML = "<b>iPhoneのホーム画面アプリで起動中</b><br>下の『通知を許可して始める』を押すと、対応している場合はPush登録まで進みます。";
    } else if (isAndroid) {
      guide.innerHTML = "<b>Androidで起動中</b><br>『通知を許可して始める』を押すと、通知許可とFirebase Push登録を行います。";
    } else {
      guide.innerHTML = "<b>通知設定</b><br>『通知を許可して始める』を押して、この端末をPush通知に登録してください。";
    }

    pageTitle.appendChild(guide);
  }

  function blockOnlyUnsupportedIOSBrowser(event) {
    if (!isIOS || isStandalone) return;

    const button = event.target.closest("button");
    if (!button) return;

    const ids = new Set([
      "startAppBtn",
      "enableNotificationsBtn",
      "scheduleNotificationsBtn",
      "testNotificationBtn",
      "registerPushBtn",
      "sendPushTestBtn"
    ]);
    if (!ids.has(button.id)) return;

    event.preventDefault();
    event.stopImmediatePropagation();

    const message = "iPhoneではSafariの共有ボタンから『ホーム画面に追加』し、ホーム画面の2Baseから開いてください。";
    setText("notificationStatus", message);
    setText("pushStatus", message);
    setText("startupStatus", message);
  }

  function updateStatusText() {
    if (isIOS && !isStandalone) {
      setText("notificationStatus", "iPhoneはSafariで共有 → ホーム画面に追加 → ホーム画面の2Baseから開いてください。");
      setText("pushStatus", "Safariタブのままでは通知登録できません。ホーム画面アプリから開いてください。");
      setText("startupStatus", "Safariの共有ボタンからホーム画面に追加してください。");
      return;
    }

    if (isIOS && isStandalone) {
      setText("notificationStatus", "iPhoneのホーム画面アプリです。下のボタンから通知を許可してください。");
      setText("pushStatus", "通知許可後、対応していればFirebase Pushへ自動登録します。");
    }
  }

  function init() {
    addGuide();
    updateStatusText();
    document.addEventListener("click", blockOnlyUnsupportedIOSBrowser, true);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
