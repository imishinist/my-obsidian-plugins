# my-obsidian-plugins

Obsidianプラグインをまとめて開発するnpm workspacesのmonorepoです。

## プラグイン

| プラグイン | ID | バージョン | 説明 |
| --- | --- | --- | --- |
| [Markdown Capture](plugins/capture/README.md) | `markdown-capture` | `0.1.1` | Daily Noteへメモやタスクをすばやく記録します。 |

インストール方法、機能、操作、設定については、各プラグインのREADMEを参照してください。

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

各プラグインは独立したバージョンとリリースを持ちます。

```text
タグ: <plugin-id>-v<version>
配布物: <plugin-id>-v<version>.zip
展開後: <plugin-id>/
```

配布ZIPには、対象プラグインの`main.js`、`manifest.json`、`styles.css`を収録します。

Obsidian公式Community Pluginsへ登録する場合は、対象プラグイン専用の公開リポジトリへ同期します。

## ディレクトリ構成

```text
dist/
└── <plugin-id>/
plugins/
└── <workspace>/
    ├── README.md
    ├── manifest.json
    ├── package.json
    ├── src/
    ├── tests/
    └── styles.css
```
