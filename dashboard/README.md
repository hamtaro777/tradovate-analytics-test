# Tradovate トレード分析ダッシュボード

TradovateからダウンロードしたCSVファイルをアップロードするだけで、主要KPIとチャートを表示するブラウザベースの分析ツールです。

## 機能

- **CSVアップロード**: ドラッグ&ドロップ対応。Tradovateの Performance / Fills / Orders CSV に対応
- **自動列マッピング**: CSVの列を自動検出。不足項目は手動選択UI
- **KPIカード表示**:
  - Total P/L（手数料込みNet P/L）
  - Win率（勝率）
  - 平均勝ち / 平均負け
  - Profit Factor
  - 総トレード数
- **チャート表示**:
  - 日次損益（棒グラフ）
  - 累積損益（線グラフ）
  - 曜日別損益（棒グラフ）
- **トレード一覧テーブル**: 全カラムソート対応、日付・シンボルフィルタ
- **Google Sheets保存**: ワンクリックでスプレッドシートにデータ出力

## ローカル起動手順

### 前提条件

- Node.js 18 以上

### 手順

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd tradovate-analytics-test/dashboard

# 2. 環境変数を設定（Google Sheets連携が必要な場合のみ）
cp .env.example .env
# .env ファイルを編集して Google API 情報を入力

# 3. サーバーを起動
node server/index.js

# 4. ブラウザでアクセス
# http://localhost:3000
```

外部パッケージのインストールは不要です（Node.js標準モジュールのみ使用）。

### テスト実行

```bash
node tests/kpi.test.js
```

## Google Sheets 連携手順

### 1. Google Cloud Console でプロジェクトを作成

1. [Google Cloud Console](https://console.cloud.google.com/) にアクセス
2. 新しいプロジェクトを作成（または既存プロジェクトを選択）
3. 「APIとサービス」→「ライブラリ」から **Google Sheets API** を有効化

### 2. サービスアカウントを作成

1. 「APIとサービス」→「認証情報」→「認証情報を作成」→「サービスアカウント」
2. 名前をつけて作成
3. 「キー」タブ →「鍵を追加」→「新しい鍵を作成」→ JSON を選択
4. ダウンロードされた JSON から以下を `.env` に設定：
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY`

### 3. スプレッドシートを準備

1. Google Sheets で新しいスプレッドシートを作成
2. 3つのシートを作成：**Trades**, **DailySummary**, **KPI**
3. スプレッドシートの共有設定で、サービスアカウントのメールアドレスに **編集者** 権限を付与
4. スプレッドシート URL から ID を `.env` の `GOOGLE_SPREADSHEET_ID` に設定

## デプロイ手順（Vercel）

### 前提条件

- Vercel CLI がインストール済み（`npm i -g vercel`）
- Vercel アカウント

### 手順

```bash
# 1. Vercel にログイン
vercel login

# 2. デプロイ
cd dashboard
vercel

# 3. 環境変数を設定
vercel env add GOOGLE_SERVICE_ACCOUNT_EMAIL
vercel env add GOOGLE_PRIVATE_KEY
vercel env add GOOGLE_SPREADSHEET_ID

# 4. 再デプロイ（環境変数反映）
vercel --prod
```

**注意**: Vercelにデプロイする場合は、サーバーをVercel Serverless Functions形式に変換する必要があります。
`/api/sheets/save` を `api/sheets/save.js` として配置してください。

## プロジェクト構造

```
dashboard/
├── public/                  # 静的ファイル（フロントエンド）
│   ├── index.html           # メインHTML
│   ├── css/
│   │   └── style.css        # ダークテーマCSS
│   └── js/
│       ├── csv-parser.js    # CSV解析・列マッピング
│       ├── kpi.js           # KPI算出（純粋関数）
│       ├── charts.js        # Canvas チャート描画
│       ├── table.js         # トレードテーブル
│       └── app.js           # メインアプリケーション
├── server/
│   ├── index.js             # HTTPサーバー
│   └── google-sheets.js     # Google Sheets API連携
├── tests/
│   └── kpi.test.js          # ユニットテスト（40テスト）
├── sample-data/             # サンプルCSV
├── .env.example             # 環境変数テンプレート
└── README.md
```

## 設計方針

- **外部依存ゼロ**: Node.js標準モジュールのみ使用。npm installは不要
- **純粋関数設計**: KPI計算・CSV解析はブラウザとNode.jsの両方で動作
- **将来移行対応**: データ保存層を差し替えればPostgreSQL等にも対応可能
- **レスポンシブ**: モバイル対応のダークテーマUI

## CSV対応フォーマット

| CSVタイプ | 自動検出 | 備考 |
|-----------|----------|------|
| Performance (推奨) | ○ | `pnl`列から直接損益取得 |
| Fills | △ | 列マッピングUIで対応 |
| Orders | △ | 列マッピングUIで対応 |
