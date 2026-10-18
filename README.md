# 2Base / 2年3組

GitHub Pages + Google Apps Script + Google Sheets のクラスサイトです。

- 時間割・明日の準備・提出物・テスト・お知らせを2年3組に固定
- 「お知らせ」の写真をDriveに保存し、保存したURLから表示
- 指定したClassroomのストリーム・課題・資料の写真を、出典リンク付きで引用
- Classroomの時間割画像を投稿名・ファイル名から絞り込み、2年3組ページに最新の登録画像を表示
- 写真の共有範囲を保持し、編集キーを確認してからPOSTで保存
- 編集中の本文と未送信の写真を、同じページ内で種類・行を切り替えても保持

**更新時は [Google側の接続・再デプロイ手順](docs/GRADE23_SETUP.md) も必要です。** GitHubへの反映だけでは、既存のApps Scriptは更新されません。

```sh
npm test
npm run build
```

Node.js 20以上。追加パッケージのインストールは不要です。GitHub Pagesの既存のルート配信もそのまま使えます。

| ファイル | 役割 |
| --- | --- |
| `app-config.js` | 接続先URL・サイト名 |
| `app-core.js` | 2年3組のデータ表示 |
| `editor-add.js` | 新規追加・編集フォーム |
| `backend-client.js` | 編集キーとPOST通信 |
| `media-editor.js` | 写真選択・縮小・Drive保存・Classroom引用 |
| `media-display.js` / `media.css` | 共有URLからの写真表示 |
| `Code.gs` / `Media.gs` | Apps Script側の保存・権限確認・Classroom取得 |
| `appsscript.json` | Google APIのサービスと権限 |

`fps-game/`、`neon-arena/`、`nankosai-seiryo/` は別コンテンツとして保持しています。
