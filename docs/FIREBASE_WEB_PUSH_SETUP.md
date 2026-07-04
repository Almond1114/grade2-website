# Firebase Web Push設定メモ

## 公開してよいもの

`app-config.js` と `firebase-config-sw.js` に入れる Firebase Webアプリ設定は、ブラウザ側で使う公開設定です。
ただし、Firebaseのセキュリティルールや権限設定は必ず確認してください。

## 公開してはいけないもの

以下は絶対にGitHubへ置かないでください。

- サービスアカウント秘密鍵
- `FIREBASE_PRIVATE_KEY`
- 管理者用の認証情報

これらはApps Scriptの「スクリプトプロパティ」に保存します。

## 必要なスクリプトプロパティ

```text
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n
```

## Web Pushで必要なファイル

- `notifications-web.js`
- `firebase-messaging-sw.js`
- `firebase-config-sw.js`
- `app-config.js`

`firebase-messaging-sw.js` はGitHub Pagesの公開ルートに置いてください。
