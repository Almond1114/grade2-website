# 2Base

Google Sheetsと連動するクラスサイトです。スマホとPCは同じURLです。

- スマホの下部にホーム・時間割・提出物・お知らせ・メニューを固定
- 時間割は2年3組ページへ直接移動
- 写真の縦横比を保ち、ホーム上部の操作を2列に整理
- NEON RUSHを削除し、旧ゲームURLは2Baseへ案内

[スマホの画面と操作](docs/MOBILE_UI.md)を参照してください。Drive保存・Classroom引用の接続機能は別の更新で追加します。

```sh
npm test
npm run build
```

Node.js 20以上。追加パッケージは不要です。
