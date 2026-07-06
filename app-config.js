// 配布前に管理者がここだけ設定します。
// 利用者はサイトを開いて「通知を許可して始める」を押すだけで使えます。
window.GRADE2_CONFIG = {
  // Google Apps Script のウェブアプリURL
  GAS_URL: "https://script.google.com/macros/s/AKfycbyDXtmdiqrJF4WpmKQhQglX0f_HNBIU66-kmNHvlESY_ce2E-j-wWeKmVSAj01EnLdT/exec",

  // スプレッドシートを直接開くボタンを使いたい場合だけ入力
  SHEET_URL: "https://docs.google.com/spreadsheets/d/1r5uwPUP3oXz-ZkImgZ5j6YfDqwHgK1Vy6xyKj0T4rHg/edit",

  // 本物のAI今日の一言を使う場合だけ、Render / Cloudflare Workers などのURLを入力
  AI_ENDPOINT: "",

  // Firebase Web Push用。Firebase Console の Webアプリ設定を貼ります。
  FIREBASE_CONFIG: {
    apiKey: "AIzaSyDBKyDO2V2fGVcpZtBTl2z1ihte291yBk0",
    projectId: "grade2-website",
    messagingSenderId: "1030380979370",
    appId: "1:1030380979370:web:78419d5b3f4c1c1d10bcd3",
  },

  // Firebase Console → Cloud Messaging → Web Push certificates の公開VAPIDキー
  FIREBASE_VAPID_KEY: "BKxCSbWT9WbmvMD0hqJWpySqkDNEqi4PpAPQyJzSnP-NDPp3UKVmRlFbed01kpS_Jdb_2qxubQ8Qv75H16z4-Pw",

  // 毎日の確認通知の時刻。サイトを開いている間の簡易通知にも使います。
  DEFAULT_NOTIFY_TIME: "20:00",

  // 初回起動で「通知を許可して始める」画面を出す
  AUTO_ONBOARDING: true,

  // 通知許可後、Firebase Web Push登録も自動で行う
  AUTO_PUSH_REGISTER: true,

  APP_VERSION: "2.0.1-gas-url"
};
