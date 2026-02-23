# MD2slide Worker Dockerfile
# Chromium + marp-cli + Noto Sans JP

FROM node:20-slim

# 必要なパッケージをインストール
RUN apt-get update && apt-get install -y \
    # Chromium依存パッケージ
    chromium \
    chromium-sandbox \
    # フォント
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    # その他ユーティリティ
    curl \
    dumb-init \
    # 不要なキャッシュを削除
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# 環境変数設定
ENV NODE_ENV=production
ENV CHROMIUM_PATH=/usr/bin/chromium
# Chromiumのサンドボックス設定（コンテナ内では無効化が必要な場合がある）
ENV CHROMIUM_FLAGS="--no-sandbox --disable-gpu --disable-dev-shm-usage"

# 作業ディレクトリ
WORKDIR /app

# パッケージファイルをコピー
COPY package*.json ./

# 依存関係をインストール
RUN npm ci --only=production

# marp-cliをインストール
RUN npm install @marp-team/marp-cli

# アプリケーションコードをコピー
COPY . .

# 一時ファイル用ディレクトリ
RUN mkdir -p /tmp/marp-work

# 非rootユーザーで実行
RUN groupadd -r marp && useradd -r -g marp marp \
    && chown -R marp:marp /app /tmp/marp-work
USER marp

# ヘルスチェック
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# ポート公開
EXPOSE 3000

# エントリーポイント
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
