2年便利サイト Web/PWA版
=======================

これは、アプリ版からWebサイト版へ戻したものです。
GitHub Pagesにそのまま置けます。

できること
----------
- クラスごとの時間割表示
- 明日の準備まとめ
- テスト予定、提出物、持ち物、お知らせ、学習リンク表示
- サイト内から既存行を編集してスプレッドシートへ保存
- 誰でも編集できる公開編集モード
- 編集履歴表示
- Firebase Web Push通知
- 初回は「通知を許可して始める」だけ
- PWAとしてホーム画面に追加可能

ファイル構成
------------
index.html
style.css
script.js
app-config.js
notifications-web.js
manifest.webmanifest
sw.js
firebase-messaging-sw.js
firebase-config-sw.js
Code.gs
icons/
docs/

最短セットアップ
----------------
1. Googleスプレッドシートを新規作成
2. 拡張機能 → Apps Script を開く
3. Code.gs の中身を貼る
4. Code.gs の SPREADSHEET_ID にスプレッドシートIDを入れる
5. setupSheets を1回実行
6. デプロイ → 新しいデプロイ → ウェブアプリ
   - 実行ユーザー: 自分
   - アクセスできるユーザー: 全員
7. 出てきたWebアプリURLを app-config.js の GAS_URL に貼る
8. GitHub Pagesへこのフォルダの中身をアップロード

Firebase Web Push設定
---------------------
1. Firebase Consoleでプロジェクト作成
2. Webアプリを追加
3. 表示された firebaseConfig を app-config.js の FIREBASE_CONFIG に貼る
4. 同じ firebaseConfig を firebase-config-sw.js に貼る
5. Firebase Console → Cloud Messaging → Web Push certificates で公開VAPIDキーを作る
6. 公開VAPIDキーを app-config.js の FIREBASE_VAPID_KEY に貼る
7. Firebaseのサービスアカウント秘密鍵を作る
8. Apps Script → プロジェクトの設定 → スクリプトプロパティに次を追加
   FIREBASE_PROJECT_ID
   FIREBASE_CLIENT_EMAIL
   FIREBASE_PRIVATE_KEY

重要: FIREBASE_PRIVATE_KEY はGitHubへ置かないでください。必ずApps Scriptのスクリプトプロパティにだけ入れます。

毎日の通知
----------
Apps Script画面で setupDailyPushTrigger を1回実行すると、毎日20時ごろに登録端末へ「明日の準備」通知を送ります。
すぐテストしたい場合は、サイトの通知ページで「Firebaseテスト送信」を押してください。

利用者側の使い方
----------------
Android / PC:
1. サイトを開く
2. 「通知を許可して始める」を押す
3. 通知を許可

IPhone / iPad:
1. Safariでサイトを開く
2. 共有 → ホーム画面に追加
3. ホーム画面のアイコンから開く
4. 「通知を許可して始める」を押す
5. 通知を許可

注意
----
誰でも編集できる設定にすると、本当に誰でも内容を書き換えられます。
荒らされたときは、Googleスプレッドシートの「版の履歴」から戻してください。
本名、顔写真、LINE、住所、電話番号などは載せない方が安全です。
