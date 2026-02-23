# MD2slide アーキテクチャ図

要件定義・技術スタック・アーキテクチャに基づく Mermaid 図を格納しています。

## 図一覧

| ファイル | 内容 |
|----------|------|
| **`diagrams.md`** | **Markdown 形式（プレビュー推奨）** — 上記3図を ` ```mermaid ` で埋め込み |
| `architecture.mmd` | システム全体構成（ブラウザ、バックエンド、Worker、キュー、外部サービス） |
| `export-flow-sequence.mmd` | エクスポートフロー（Google Slides / PDF のシーケンス図） |
| `component-detail.mmd` | コンポーネント詳細（フロントエンド・バックエンド・Worker の責務） |

## 閲覧方法

### 1. Markdown プレビュー（推奨）
**`docs/diagrams.md`** を開き、VS Code の Markdown プレビュー（`Cmd+Shift+V`）で表示できます。GitHub でもそのままレンダリングされます。

### 2. Mermaid Live Editor
[Mermaid Live Editor](https://mermaid.live/) に `.mmd` の内容を貼り付けてプレビュー・PNG/SVG エクスポートできます。

### 3. VS Code 拡張
「Mermaid」拡張をインストールすると、`.mmd` ファイルをエディタ内でプレビューできます。

### 4. コマンドライン（@mermaid-js/mermaid-cli）
```bash
pnpm add -D @mermaid-js/mermaid-cli
npx mmdc -i docs/architecture.mmd -o docs/architecture.png
```
