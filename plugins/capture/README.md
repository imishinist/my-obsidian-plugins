# Markdown Capture

Daily Noteへメモやタスクをすばやく追記し、その日のCaptureをタイムラインで確認できるObsidianプラグインです。Markdownを唯一のSource of Truthとして扱います。

## インストール

1. [Releases](https://github.com/imishinist/my-obsidian-plugins/releases)から`markdown-capture-vX.Y.Z.zip`をダウンロードします。
2. ZIPを展開します。
3. `markdown-capture/`ディレクトリを、Vaultの`.obsidian/plugins/`へコピーします。
4. Obsidianを再起動し、**設定 → コミュニティプラグイン**から **Markdown Capture** を有効化します。

```text
markdown-capture/
├── main.js
├── manifest.json
└── styles.css
```

Obsidian標準のDaily Notesコアプラグインを有効にしてください。

## 主な機能

- Obsidian標準のDaily Notes設定（保存先、日付形式、テンプレート）を使用
- ObsidianネイティブMarkdownエディタによる入力
- デスクトップとモバイルの両方に対応
- Live Preview／Source modeの切り替え
- 通常メモとTask Board互換タスクの投稿
- Scheduled（`⏳`）とDue（`📅`）の日付指定
- `HH:mm`／`HH:mm:ss`の時刻見出し
- 任意の見出し配下、またはDaily Note末尾への追記
- 当日のCaptureを新しい順に表示するタイムライン
- タイムラインから編集、内部リンクのコピー、Obsidianリンクのコピー、元ファイル表示
- 設定変更の即時反映

## 操作

リボンのプラスアイコン、またはコマンドパレットの **Markdown Capture: Open capture page** からCaptureページを開きます。

- `Cmd/Ctrl + Enter`: 通常送信
- `Cmd/Ctrl + Shift + Enter`: タスクとして送信
- タイムラインをダブルクリック: 編集
- タイムラインを右クリック: リンクのコピー、編集、Source表示

入力の先頭がMarkdownタスク（例: `- [ ]`）の場合、通常送信でもタスクとして認識します。

## 保存形式

```markdown
###### 10:20:15
通常メモ
###### 10:21:03
- [ ] タスク #project/foo ⏳ 2026-09-20 📅 2026-09-30
```

見出しレベルと時刻形式は設定で変更できます。Capture間には余分な空行を追加しません。既存の`HH:mm`形式と`HH:mm:ss`形式は同じDaily Note内で併用できます。

## 設定

- **Capture format**
  - 見出しレベル
  - 時刻形式
- **Editor**
  - Live Preview／Source mode
- **Buttons**
  - 通常送信ボタンとタスク送信ボタンのラベル
- **Destination**
  - 挿入先の見出し（未指定の場合はファイル末尾）

## 開発

リポジトリのルートで実行します。

```bash
npm install
npm run check --workspace @my-obsidian-plugins/capture
npm run test --workspace @my-obsidian-plugins/capture
npm run build --workspace @my-obsidian-plugins/capture
```

ビルド成果物は`dist/markdown-capture/`へ出力されます。
