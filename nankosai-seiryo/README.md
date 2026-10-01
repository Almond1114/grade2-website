# 南高祭 2027「清涼」
札幌南高校の学校祭を想定した仮想公式サイトと運営CMSです。学校の公式発表ではありません。開催日、企画、校内図はサンプルです。正式な情報に差し替えてから実運用してください。

公開URL: https://almond1114.github.io/grade2-website/nankosai-seiryo/
管理URL: https://almond1114.github.io/grade2-website/nankosai-seiryo/admin.html

## 現在の接続状態
公開サイトはAPI URLが空のためデモモードです。管理画面の「デモで試す」から更新できます。データは同じブラウザのLocalStorageに保存され、そのブラウザの公開画面に反映されます。他の来場者への配信にはGoogle接続が必要です。デモ入口は本番認証ではありません。

Google側の作成済み資源:
- [CMSデータベース](https://docs.google.com/spreadsheets/d/1cIpA-hAV-SklbIgNzTKuk1oFTfmXvVRagbqYcJLmMsU/edit)
- [運営フォルダ](https://drive.google.com/drive/folders/1pB3jbTnsHPG_YjVw0Nv8zANLt345bNOy)
- [画像フォルダ](https://drive.google.com/drive/folders/1CkoXgyIJ5-yhNJZOqjOtbVRD8pochPQC)

7シートとデモデータは投入済みです。Apps Scriptの実行承認・管理者パスワードの設定・Web Appデプロイは未完了です。共有範囲は勝手に公開していません。

## 構成
|パス|役割|
|---|---|
|index.html / admin.html|公開ページ / 運営画面|
|css/base.css|共通デザイン、入力・ボタン・フォーカス|
|css/public.css / admin.css|各画面のレイアウト|
|css/animations.css|動きとreduced-motion|
|js/site-config.js|文面・見た目・接続・更新間隔の設定中枢|
|js/api.js|Demo / Apps Script Provider、取得・保存・キャッシュ|
|js/schema.js|入力検証|
|js/festival-data.js|時刻表優先の開催回、日別予定、重複時間、検索|
|js/dom.js / editor-storage.js|更新時のフォーカス保持 / 入力途中の一時保存|
|js/public-app.js / admin-app.js|各画面の機能|
|js/cards.js / icons.js|共通カード / SVGアイコン|
|js/utils.js / storage.js|エスケープ・画像URL・時刻 / ブラウザ保存|
|js/media.js|ブラウザで画像圧縮|
|js/animations.js / pwa.js|軽い演出 / PWA登録|
|data/demo.json|初期デモデータ|
|assets/maps/|差し替え用の仮SVG校内図|
|assets/posters/|軽量な抽象企画ビジュアル|
|manifest.webmanifest / sw.js|ホーム画面追加 / オフライン|
|gas/Code.gs / appsscript.json|バックエンド / Google権限設定|
|tests/|Node検証とブラウザ検証画面|
|scripts/update-cache.mjs|資材ハッシュからPWAのキャッシュ版を更新|
|docs/UX_REVIEW.md|実操作で見つかった不便、修正、検証状態|

## GitHub Pages
既存サイトのルートファイルは変更せず、このディレクトリだけを追加します。現在のPages公開設定を使用してください。ブランチ公開ならmain / rootをそのまま使用できます。全参照は相対パスです。GASはPages上で実行されず、GoogleのWeb AppがAPIを提供します。

ローカルではリポジトリルートから `python -m http.server 8765` を実行し、`http://localhost:8765/nankosai-seiryo/` を開きます。ES Modulesなのでfile://で開かないでください。

## 文面・デザイン変更
`js/site-config.js` の `SITE_CONFIG` を編集します。
- content: タイトル、年度、テーマ、英語名、コピー、学校名、説明、初期開催日・時刻、アクセス文。
- colors: 背景、サブ背景、本文、薄い文字、アクセント、警告、成功、境界。
- typography: 本文・見出し・清涼のフォント、各文字サイズ。
- layout: コンテンツ幅、余白、カード間隔、角丸、影、ヘッダー高さ。
- animation: 時間、パララックス量、フェード距離、背景光の強さ。
- api: Web App URL、タイムアウト、自動更新間隔。
- media / map: 圧縮上限、画質、フロア、校内図パス。

CSS変数とdata-config文面に反映されます。管理画面の開催日・時刻・入場案内はデータベース側の運営設定が優先します。初期データの開催日も変更する場合はCMSのサイト設定を更新してください。PWA名称・アイコンはmanifestも変更します。

## Google接続
詳しくは [gas/README.md](./gas/README.md)。作成済みSpreadsheetから「拡張機能 → Apps Script」を開き、Code.gsとappsscript.jsonを登録します。プロジェクト設定のScript Propertiesへ次を設定します。

|キー|作成済み値|
|---|---|
|SPREADSHEET_ID|1cIpA-hAV-SklbIgNzTKuk1oFTfmXvVRagbqYcJLmMsU|
|DRIVE_FOLDER_ID|1CkoXgyIJ5-yhNJZOqjOtbVRD8pochPQC|

`setupSheets()` を実行してGoogle権限を承認します。既存ヘッダーを検査し、必要なシートだけを作成します。異なるヘッダーを自動で上書きしません。新規環境ではID未設定でもSheetとフォルダを作成できます。

Sheetを再読み込みし「南高祭CMS → 管理者パスワード設定」を使います。12文字以上の新しいパスワードは本人が入力してください。ソースやフロントエンドに記載しません。`setAdminPassword()` はバインドされたSheetの入力ダイアログを開きます。

Web Appを「自分として実行 / 全員」でデプロイします。匿名公開が組織で禁止されている場合はポリシーに従い、Workspace認証等へ設計変更が必要です。/exec URLを `SITE_CONFIG.api.url` に設定しGitHubへコミットします。URL設定だけでGoogle Providerに切り替わります。APIが障害になってもデモへ勝手に切り替えません。

## 日常運用
- 企画は下書きで作成 → カードプレビュー → 公開中を選び保存。
- 下書きは名前だけでも保存できます。入力途中の内容はこのタブに一時保存し、再表示すると復元します。元データのrevisionが変わっていれば、最新の内容を表示し、以前の入力を確認するボタンを出します。
- 混雑はダッシュボードまたは企画編集の3ボタンから更新。
- 時刻変更・場所変更は時刻表を更新。中止は「中止」にチェック。
- 関連する公開時刻表が1件以上ある企画では、その開催回の日付・時間・会場が企画一覧・詳細・予定・マップの共通情報になります。関連時刻表がない終日展示等は企画側の日付・時間を使用します。
- 緊急告知はダッシュボードで文面・表示チェックを更新。
- お知らせは重要設定と公開日時を指定可能。
- 削除は確認後の論理削除。参照中の場所・企画は削除を拒否。
- 競合時は最新データを読み込み、変更を再確認して保存。
- 設定画面のJSONバックアップ、Google Sheetsの版履歴を定期的に保存。

## 画像
管理画面でJPEG / PNG / WebPを選択し、縦横最大1600px、JPEG品質0.82を基準に2MB以内へ圧縮します。Canvasによる再エンコードでEXIFを持ち越しません。GASでサイズ・画像シグネチャを検証し、専用Driveフォルダへ保存してmediaに記録します。公開するアップロード画像だけリンク共有へ変更します。人物写真等の掲載許諾は運営側で確認してください。

Drive File IDを保持し、表示URL生成はutils.jsのimageURLへ集中しています。Driveは画像CDNではなく、配信制限・画像反映遅延があり得ます。読み込み失敗は代替表示へ切り替えます。providerを追加すればR2等へ移行できます。デモ画像アップロードはブラウザ内のみ。保存容量超過はエラーを表示します。

選択した画像は保存前に取り消せます。画像ライブラリでは、企画で使っていないアップロード画像を削除できます。下書きを含む使用中画像と標準ポスターは削除できません。Googleモードでは専用フォルダ内であることを確認してDriveのゴミ箱へ移し、mediaを論理削除します。デモモードではそのブラウザ内の画像データを消して保存容量を空けます。元の写真ファイルは変更しません。

## PWA・オフライン
Safariは共有→ホーム画面に追加。主要画面・CSS・JS・デモ図をサブディレクトリのService Workerへ保存します。公開データの最終取得分はブラウザ保存し、接続エラー時に「最終保存データ」を明示します。混雑情報はオフラインでは最新ではありません。Google API・認証情報・外部画像はSWキャッシュ対象外です。Google管理操作は通信必須です。

資材更新後に `node scripts/update-cache.mjs` を実行してください。資材内容からsw.jsのキャッシュ版を作り、HTMLとES ModuleのCSS・JS参照にも同じ版のクエリを付けます。ブラウザに古いJSが残るのを防ぎます。繰り返し実行しても内容が同じなら同じ版です。新Workerは全資材の保存完了後に切り替わり、編集中の画面を自動で再読み込みしません。自分のcache prefixだけを削除します。既存ルートSWが他サイトの全キャッシュを削除する仕様なので、ルートサイト側が更新されると本サイトのオフライン資材が消える可能性があります。既存ファイル保護のため今回は変更していません。

## セキュリティと検証
入力のHTMLエスケープ、URLプロトコル制限、固定SVG、許可collection、サーバー側入力・参照検証、セッション、4時間期限、ソルト付き5000回SHA-256、保存ロック、revision競合検出、リクエストID、変更履歴、Sheet数式注入対策を実装しています。パスワードはScript Propertiesにハッシュのみを保存します。共通パスワード方式は試作向けです。本番ではWorkspace個人認証、役割・操作権限、監視、強固なパスワード導出基盤への移行が推奨されます。CacheServiceのトークンは期限前に失効する場合があります。

このディレクトリで `node --test tests/*.test.mjs` を実行するとGAS・データ整合・PWAを確認します。`tests/browser.html` はデモ限定の実操作・レスポンシブ・画像圧縮・保存と復元の検証画面です。検証中だけ専用データを使い、終了時にブラウザの保存データを戻します。実機Safari/Android、Google API接続、Drive画像の実配信、当日のアクセス負荷は別途本番接続後に確認してください。
