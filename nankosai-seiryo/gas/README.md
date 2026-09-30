# Google Apps Script API
## 配置と実行
親READMEの作成済みSheetへバインドしたプロジェクトを作ります。Code.gsをコピーし、設定から「appsscript.jsonをエディタで表示」を有効にして同名ファイルを登録します。Script PropertiesへSPREADSHEET_IDとDRIVE_FOLDER_IDを設定、setupSheetsを実行して権限を承認します。

Sheet再読み込み後のメニューからsetAdminPasswordを実行します。パスワードは本人がダイアログへ入力します。ソルトとハッシュを保存し、変更時は全セッションを失効します。コードへパスワードを埋め込まないでください。

デプロイ → 新しいデプロイ → ウェブアプリ → 自分として実行 → 全員。取得した/exec URLをsite-config.jsのapi.urlへ設定します。コード修正後はデプロイのバージョンも更新します。/dev URLは公開サイトで使いません。

## データ
settings / projects / news / schedule / locations / media / auditの7シートを使用します。ヘッダーはCode.gsのSCHEMASで定義されます。列名・順番を変更しないでください。日時はISO文字列、開催日はYYYY-MM-DD、時刻はHH:mmで保持します。Google Sheetsの自動日付変換で数値化しないよう注意してください。

statusはdraft / published。混雑はquiet / normal / busy。featured・important・cancelled等はtrue / false。revisionは更新時に加算し、古い値からの上書きを拒否します。deletedAtで論理削除します。場所/企画の参照整合性を検査します。

## API
GET ?action=bootstrap は匿名で公開データのみ返します。POSTはURLSearchParamsでaction / payload(JSON文字列) / token / requestIdを送ります。JSONレスポンスは `{ok:true,data:...}` または `{ok:false,error:{code,message}}`。GAS ContentServiceではHTTP状態コードに依存しないでください。

|action|用途|
|---|---|
|login|パスワード検証、一時トークン発行|
|logout|トークン失効|
|adminBootstrap|下書き・履歴を含む管理データ|
|saveRecord|projects/news/schedule/locations保存|
|deleteRecord|論理削除|
|updateCrowd|企画の混雑変更|
|saveSettings|開催情報・緊急バナー|
|uploadImage|Driveへの画像保存とmedia記録|

公開GETのみ15秒キャッシュ。変更時に失効。書き込みはScriptLock、再送結果は10分以内のCacheServiceで同じrequestIdに対して再利用します。キャッシュの早期破棄や新requestIdでの再操作は完全な重複防止保証ではありません。通信失敗後は最新状態を確認してください。

## 権限と制約
このAPIはデプロイ所有者としてSheetとDriveへアクセスします。フォルダ全体を公開せず、アップロードした公開用画像だけをリンク共有します。個人情報をSheetへ混在させないでください。Google割当量、実行時間、Drive画像配信制限を超える大規模イベントには専用DB/画像CDNを検討してください。

ログイン失敗を全体で5分間に10回まで制限します。GASでは信頼できるクライアントIPを取得できないため、これはIP別制限ではありません。試作向けの共通パスワード認証です。個別権限が必要ならlogin_/requireSession_をWorkspace認証へ交換し、UIのProvider契約を維持してください。
