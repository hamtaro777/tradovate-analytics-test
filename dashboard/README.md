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

## ローカル起動手順

### 前提条件

- Node.js 18 以上

### 手順

```bash
# 1. リポジトリをクローン
git clone <repository-url>
cd tradovate-analytics-test/dashboard

# 2. サーバーを起動
node server/index.js

# 3. ブラウザでアクセス
# http://localhost:3000
```

外部パッケージのインストールは不要です（Node.js標準モジュールのみ使用）。

### テスト実行

```bash
node tests/kpi.test.js
```

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
│   └── index.js             # HTTPサーバー
├── tests/
│   └── kpi.test.js          # ユニットテスト（40テスト）
├── sample-data/             # サンプルCSV
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
