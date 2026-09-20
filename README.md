# my-obsidian-plugins

Obsidianプラグインをまとめて開発するnpm workspacesのmonorepoです。

各プラグインは独立したバージョンとリリースを持ちます。リリースタグ、配布ZIP、展開後のディレクトリ名には、各プラグインのIDを使用します。

## プラグイン

| プラグイン | ID | ソース | バージョン | 概要 |
| --- | --- | --- | --- | --- |
| Markdown Capture | `markdown-capture` | `plugins/capture/` | `0.1.1` | Daily Noteへメモやタスクをすばやく追記し、その日のCaptureをタイムラインで確認します。 |

## インストール

1. [Releases](https://github.com/imishinist/my-obsidian-plugins/releases)から、対象プラグインのZIPをダウンロードします。
2. ZIPを展開します。
3. 展開されたプラグインディレクトリを、Vaultの`.obsidian/plugins/`へコピーします。
4. Obsidianを再起動し、**設定 → コミュニティプラグイン**からプラグインを有効化します。

Markdown Captureの場合は、`markdown-capture-vX.Y.Z.zip`を展開すると次の構成になります。

```text
markdown-capture/
├── main.js
├── manifest.json
└── styles.css
```

## Markdown Capture

Markdownを唯一のSource of Truthとして、Obsidian標準のDaily NotesへCaptureを保存します。

### 主な機能

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

Markdown Captureを使用するには、Obsidian標準のDaily Notesコアプラグインを有効にしてください。

## 開発

```bash
npm install
npm run check
npm test
npm run build
```

ルートのコマンドは、各workspaceに存在する同名のスクリプトをまとめて実行します。特定のプラグインだけを対象にする場合はworkspaceを指定します。

```bash
npm run build --workspace @my-obsidian-plugins/capture
npm run check --workspace @my-obsidian-plugins/capture
npm run test --workspace @my-obsidian-plugins/capture
```

ビルド成果物は`dist/<plugin-id>/`へ出力されます。

## リリース方針

プラグインごとに独立してバージョンを管理します。別のプラグインに変更がなければ、そのプラグインのバージョンは更新しません。

Markdown Capture `0.1.1`の例:

```text
タグ: markdown-capture-v0.1.1
配布物: markdown-capture-v0.1.1.zip
展開後: markdown-capture/
```

配布ZIPには、対象プラグインの`main.js`、`manifest.json`、`styles.css`だけを収録します。

Obsidian公式Community Pluginsへの登録は、リポジトリ直下の`manifest.json`とバージョン番号だけのリリースタグを前提とするため、このmonorepoから直接は行いません。登録する場合は、対象プラグイン専用の公開リポジトリへ同期します。

## ディレクトリ構成

```text
dist/
└── <plugin-id>/             インストール可能なビルド成果物
plugins/
└── <workspace>/
    ├── manifest.json        Obsidianプラグイン情報
    ├── package.json         workspaceとバージョン
    ├── src/                 実装
    ├── tests/               テスト
    └── styles.css           プラグインのスタイル
```
