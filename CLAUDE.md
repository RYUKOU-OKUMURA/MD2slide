# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

MD2slide — Marp互換MarkdownをWebエディタで編集・プレビューし、Google Slides / PDFとしてエクスポートするWebアプリケーション。

## Architecture

**フロントエンド（Next.js / React）**
- CodeMirror 6でMarkdown編集、@marp-team/marp-coreでiframeプレビュー
- Google OAuth 2.0 (PKCE) をクライアント主導で取得、アクセストークンはAuthorizationヘッダーで送信
- 下書き・設定はLocalStorage/IndexedDB、サーバーには永続保存しない

**バックエンド（Node.js — エクスポート専用）**
- Export API: `format` パラメータ（"slides" | "pdf"）でジョブ登録、jobId返却
- Worker: Chromium同梱コンテナでmarp-cli実行（`--pptx` or `--pdf`）
- Slides出力時のみDrive APIでアップロード（mimeType指定でSlides変換）、PDF出力はDrive連携不要
- キュー: Phase1=Cloud Tasks、Phase2=Redis+BullMQ（共通インターフェース enqueue/getStatus/onComplete で抽象化）

**データフロー**
1. フロントがmd/css + format + folderId?をPOST → jobId取得
2. フロントが `/jobs/{jobId}/status` を3秒間隔でポーリング（最大5分）
3. Workerが生成・アップロード完了後、ステータスを"done"に更新（slidesUrl or downloadUrl）

## Design Documents (authoritative)

- `要件定義.md` — 機能要件、非機能要件、MVP受入基準
- `アーキテクチャ.md` — コンポーネント詳細、OAuthフロー、データフロー、セキュリティ対策
- `技術スタック.md` — 採用技術、インフラ構成、OAuthスコープ方針

設計判断に迷った場合はこれらを参照すること。日本語で記述されている。

## Key Constraints

- **OAuthスコープ**: `drive.file` のみ（最小権限）。Drive全体アクセスは使用禁止
- **画像取得**: httpsのみ、RFC1918/メタデータエンドポイント/ループバック拒否、リダイレクト再検証（最大3回）
- **カスタムCSS**: ホワイトリスト検証必須（`url()`, `expression()`, `@import` 禁止）
- **一時ファイル**: ジョブ完了後即削除、最大30分保持
- **コンテナ**: メモリ2GB以上、タイムアウト5分
- **フォント**: Noto Sans JP推奨、16:9固定

## Template Priority (MVP)

- **P1**: 2カラム（左58%/右42%固定比率）— 最優先
- **P2**: 図解3種（3ボックス横並び、縦フロー、Before/After）
- **P3**: ラベル/バッジ

## Task Progress Tracking

`実装計画.md` のチェックボックスで進捗を管理する。
- `- [ ]` : 未着手
- `- [x]` : 完了
タスクを完了したら該当チェックボックスにチェックを入れること。
