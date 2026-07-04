2年便利サイト v2 - 複数ページ・白基調デザイン版

この版で変わったこと
- ホームを2学年全体のページに変更
- 白基調のクールなデザインに変更
- 右上のテーマ選択で複数デザインを切り替え可能
- 2-1〜2-5のクラス別ページを追加
- よく使う「明日の準備・提出物・テスト・時間割」を各ページ上部に配置
- 1ページ詰め込みではなく、別ページ移動型に変更
- 編集画面を edit.html に分離
- 編集画面を「種類を選ぶ → 行を選ぶ → 入力して保存」の直感的UIに変更

重要：既存サイトを更新する人へ
- 既存の app-config.js は上書きしないでください。
- 既存の firebase-config-sw.js は上書きしないでください。
- このZIPには app-config.example.js / firebase-config-sw.example.js だけ入れています。
- GitHubにアップロードしても、既存の app-config.js と firebase-config-sw.js は残したままでOKです。

アップロードするファイル
index.html
classes.html
class-2-1.html
class-2-2.html
class-2-3.html
class-2-4.html
class-2-5.html
tests.html
homework.html
announcements.html
links.html
edit.html
notifications.html
style.css
theme.js
app-core.js
notifications-web.js
sw.js
firebase-messaging-sw.js
manifest.webmanifest
icons/

既存の設定ファイル
app-config.js と firebase-config-sw.js は今のリポジトリにあるものをそのまま使います。

更新後にやること
1. GitHubにこのZIPの中身をアップロード
2. app-config.js と firebase-config-sw.js は既存のものを残す
3. GitHub PagesのURLを開く
4. Ctrl + F5 で強制更新
5. まだ古い画面なら、ブラウザのサイトデータかService Workerを削除

通知が動かないとき
- notifications.html を開いて「再登録」
- firebase-messaging-sw.js が新しい安全版に置き換わっているか確認
- firebase-config-sw.js の中身が self.GRADE2_FIREBASE_CONFIG = {...}; 形式か確認

