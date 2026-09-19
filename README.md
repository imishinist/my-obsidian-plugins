# my-obsidian-plugins

Obsidianプラグインをまとめて開発するnpm workspacesのmonorepoです。

## Markdown Capture

Daily Noteへメモやタスクをすばやく追記し、その日のCaptureをタイムラインで確認できるプラグインです。Markdownを唯一のSource of Truthとして扱います。

### 主な機能

- Obsidian標準のDaily Notes設定（保存先、日付形式、テンプレート）を使用
- ObsidianネイティブMarkdownエディタによる入力
- Live Preview／Source modeの切り替え
- 通常メモとTask Board互換タスクの投稿
- Scheduled（`⏳`）とDue（`📅`）の日付指定
- `HH:mm`／`HH:mm:ss`の時刻見出し
- 任意の見出し配下、またはDaily Note末尾への追記
- 当日のCaptureを新しい順に表示するタイムライン
- タイムラインから編集、内部リンクのコピー、Obsidianリンクのコピー、元ファイル表示
- 設定変更の即時反映

### 操作

リボンのプラスアイコン、またはコマンドパレットの **Markdown Capture: Open capture page** からCaptureページを開きます。

- `Cmd/Ctrl + Enter`: 通常送信
- `Cmd/Ctrl + Shift + Enter`: タスクとして送信
- タイムラインをダブルクリック: 編集
- タイムラインを右クリック: リンクのコピー、編集、Source表示

入力の先頭がMarkdownタスク（例: `- [ ]`）の場合、通常送信でもタスクとして認識します。

### 保存形式

```markdown
###### 10:20:15
通常メモ
###### 10:21:03
- [ ] タスク #project/foo ⏳ 2026-09-20 📅 2026-09-30
```

見出しレベルと時刻形式は設定で変更できます。Capture間には余分な空行を追加しません。既存の`HH:mm`形式と`HH:mm:ss`形式は同じDaily Note内で併用できます。

### 設定

- **Capture format**
  - 見出しレベル
  - 時刻形式
- **Editor**
  - Live Preview／Source mode
- **Buttons**
  - 通常送信ボタンとタスク送信ボタンのラベル
- **Destination**
  - 挿入先の見出し（未指定の場合はファイル末尾）

## インストール（手動）

1. `npm install`
2. `npm run build`
3. ビルドされた`dist/markdown-capture/`をVaultの`.obsidian/plugins/markdown-capture/`へコピー
4. Obsidianのコミュニティプラグインから **Markdown Capture** を有効化

Obsidian標準のDaily Notesコアプラグインを有効にしてください。

## 開発

```bash
npm install
npm run check
npm test
npm run build
```

テストでは、Markdown出力、タスク判定、Daily Noteのパス、見出し配下への追記、時刻形式の互換性、タイムライン解析、競合を防ぐ編集処理を検証しています。

## 構成

```text
dist/
  markdown-capture/  インストール可能なビルド成果物
plugins/
  capture/
    src/       実装
    tests/     仕様テスト
```
