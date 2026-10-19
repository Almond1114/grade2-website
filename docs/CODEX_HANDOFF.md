# 2Base：Codexへの引き継ぎ

更新日時：2026-10-19 21:08（日本時間）。このファイルは作業時点の記録です。再開時はGitHub・公開API・Google側の現状を確認してください。

## 目的と再開するブランチ

- リポジトリ：`Almond1114/grade2-website`
- 作業ブランチ：`codex/2base-grade23-drive-classroom`
- ドラフトPR：[#19](https://github.com/Almond1114/grade2-website/pull/19)
- テスト済みコードの基準コミット：`4fac93cfa9980571f9bda4a2c548d1ed9f612143`
- 公開サイト：<https://almond1114.github.io/grade2-website/>

2年3組専用の2Baseにする。端末の写真をGoogle Driveへ保存し、そのURLで表示する。Classroomの投稿・課題・資料に添付された画像を出典付きで引用し、時間割の写真を2年3組ページに掲載できるようにする。モバイルでも使いやすくする。

ユーザーは実装・改善・GitHubへの反映を依頼済み。通常の調査や修正で何度も確認せず進める。本人認証や認証情報の新規設定など、実際に本人操作が必要な箇所だけ具体的に案内する。

## 反映状況

### 公開済みの変更

PR [#20](https://github.com/Almond1114/grade2-website/pull/20) はmainへマージ済み。mainの基準は `6acc727b7c02b05bc47a55da4d959de2cdfa1a68`。GitHub Pagesのデプロイ成功と公開ページを確認した。

- モバイルの下部ナビゲーション、メニュー、レイアウトを改善。
- NEON RUSHを削除。旧 `fps-game/` はトップへ誘導。
- 他のゲームや南高祭のディレクトリは保持。
- この公開更新では、既存のGoogle接続とFirebase設定を変更していない。

### PR #19に実装済み・未公開の変更

- 表示・保存・通知先のクラスを2-3に固定。他クラスの既存行は削除せず除外する。
- 編集キーを検証するPOST保存。キーはブラウザのメモリだけに保持する。
- 写真を長辺2000px以下・3MB以下のJPEGへ変換し、Driveへ保存する。
- Classroomの許可したコースだけを検索し、添付画像と元投稿のリンクを引用する。
- 「時間割の写真」シートから掲載日が新しい画像を表示する。
- 下書き保持、送信中の操作制御、再送抑制、保存後の再同期失敗への対応。
- mainのモバイル改善を取り込み済み。

`npm test` は48件成功、`npm run build` と `git diff --check` も成功した。テストはSheets・Drive・Classroomのモックを含む。実際の写真アップロード・引用・スマホ実機の検証はまだ完了していない。

## Google側で実施したこと

1. `app-config.js` の既存 `SHEET_URL` の管理シートから、紐づくApps Scriptを開いた。既存WebアプリのデプロイIDが、本番の `GAS_URL` と一致することを確認した。
2. 同じApps Scriptで、既存の `コード.gs` をPRの `Code.gs` の内容に置き換え、`Media.gs` を追加した。重複する `Code.gs` は作っていない。転送した本文の一致と保存を確認した。
3. `appsscript.json` にClassroomサービスと必要なOAuthスコープを追加。既存の `webapp` 設定・実行者・公開範囲は保持した。
4. 非公開の写真保存用Driveフォルダを作り、スクリプトプロパティの `PHOTO_FOLDER_ID` と `SPREADSHEET_ID` を設定した。既存のFirebaseプロパティは保持した。IDや秘密値はこの文書に記載しない。
5. Googleの本人確認・追加権限承認後、`authorizeGrade23` を実行し、21:05:46に正常終了した。シートと写真フォルダへの接続を確認できた。
6. `migrateGrade23` を実行し、21:06:57に正常終了した。既存行を削除せず、不足するシート・列を追加する移行である。
7. `listMyClassroomCourseIds` を実行し、21:08:11に正常終了した。ただし、認証したアカウントの参加コースは対象と確認できない1件のみで、2年3組のコースは見つかっていない。`CLASSROOM_COURSE_IDS` は未設定。

**既存Webアプリは新バージョンへ更新していない。** 本番はまだ旧API。編集キーを使う新しい画面を先に公開しない。

## 残作業

1. 作業ブランチを取得し、この文書と [接続手順](GRADE23_SETUP.md) を読む。実装を一から作り直さない。
2. 実際の2年3組のClassroomへアクセスできるGoogleアカウント・実行者を確認する。学校の共有制限に従う。現アカウントの唯一のコースを、確認せず許可リストへ登録しない。
3. 対象コースIDを `CLASSROOM_COURSE_IDS` に設定する。実行するGoogleアカウントが、管理シートと写真フォルダにもアクセスできることを確認する。
4. 管理者本人に、スクリプトプロパティ `EDITOR_KEY` へ16文字以上の推測されにくい編集キーを設定してもらう。この作業時点では、ブラウザに項目名を入れた未保存の空欄だけを用意した状態。新しいセッションでは、その画面やGoogleログインが引き継がれると仮定しない。
5. 必要なGoogle権限と `authorizeGrade23` の成功を確認し、既存Webアプリの同じデプロイを新バージョンへ更新する。現在の実行者・公開範囲を意図せず変えない。URLを保持できれば `app-config.js` の変更は不要。
6. 公開APIの `data.meta.apiVersion` が4以上、`classId` が `2-3` であることを確認。編集キー付きPOSTの接続、Drive保存、Classroomの実際の時間割画像の引用・表示を確認する。実際に確認できなかった項目は未検証と報告する。
7. Google側と整合したらPR #19をマージし、GitHub Pagesの成功と公開サイトを確認する。モバイル操作・画像の閲覧権限も確認する。

## 守ること

- **既存シートで `setupSheets` を実行しない。** 移行には `migrateGrade23` を使う。
- 編集キー・Firebase秘密鍵・OAuthトークンを、GitHub、文書、ログ、チャットへ記載しない。現在のスクリプト設定には既存のFirebase秘密値がある。設定画面の全内容を出力しない。
- `app-config.js` と既存Firebase設定を理由なく置き換えない。
- `ALLOW_PUBLIC_PHOTOS` は既定で無効。写真フォルダの共有範囲を引き継ぐ。Classroomの元画像の権限を変えない。
- Classroomは授業の投稿・課題・資料の添付画像が対象。生徒の提出物・名簿・成績を取得する処理を追加しない。
- 時間割画像の候補検索はファイル名・投稿名に対するもの。OCRや自動同期は実装していない。
- 公開GitHub Pagesと公開データAPIに学校の在籍認証はない。写真の閲覧制限は元のDrive権限による。
- 再送抑制は6時間のキャッシュを使う最善努力。永続的な重複防止ではない。
- 前環境ではサイトのプレビュー基盤が起動エラー。新しいCodex環境で使える検証手段を確認し、未実施の実機確認を済んだ扱いにしない。

## 主なファイルと検証コマンド

サーバー：`Code.gs`、`Media.gs`、`appsscript.json`。

画面：`app-core.js`、`backend-client.js`、`editor-add.js`、`media-editor.js`、`media-display.js`、`ux-enhancements.js`、`mobile-ui.css`。

手順：[GRADE23_SETUP.md](GRADE23_SETUP.md)、[MOBILE_UI.md](MOBILE_UI.md)。

外部依存のインストールは不要。

```sh
npm test
npm run build
git diff --check
```
