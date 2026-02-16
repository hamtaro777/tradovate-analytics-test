# トレード分析ダッシュボード 構築ガイド

別プロジェクトで本ダッシュボードを再現するための包括的なセットアップガイドです。
CSVのデータ形式が異なる場合でも横展開できるよう、アーキテクチャ・データ仕様・カスタマイズ方法を詳細に記載しています。

---

## 目次

1. [アーキテクチャ概要](#1-アーキテクチャ概要)
2. [技術スタック](#2-技術スタック)
3. [ディレクトリ構造](#3-ディレクトリ構造)
4. [セットアップ手順](#4-セットアップ手順)
5. [モジュール構成と役割](#5-モジュール構成と役割)
6. [データフロー](#6-データフロー)
7. [正規化トレードオブジェクト仕様](#7-正規化トレードオブジェクト仕様)
8. [CSV列マッピングの仕組み](#8-csv列マッピングの仕組み)
9. [別のCSV形式に対応する方法](#9-別のcsv形式に対応する方法)
10. [KPI算出ロジック](#10-kpi算出ロジック)
11. [チャート描画](#11-チャート描画)
12. [テーブル・カレンダー](#12-テーブルカレンダー)
13. [データ永続化（localStorage）](#13-データ永続化localstorage)
14. [テスト](#14-テスト)
15. [カスタマイズチェックリスト](#15-カスタマイズチェックリスト)

---

## 1. アーキテクチャ概要

```
┌─────────────────────────────────────────────────────────┐
│                    ブラウザ（SPA）                        │
│                                                         │
│  ┌───────────┐   ┌───────────┐   ┌──────────────────┐  │
│  │ CSV Upload │──▶│CSVParser  │──▶│正規化トレード配列 │  │
│  │ (app.js)   │   │(csv-parser│   │                  │  │
│  │            │   │  .js)     │   └────────┬─────────┘  │
│  └───────────┘   └───────────┘            │             │
│                                           ▼             │
│  ┌──────────────────────────────────────────────────┐   │
│  │              KPI Calculator (kpi.js)              │   │
│  │  calculateAllKPIs / calculateExtendedKPIs         │   │
│  │  calculateDailySummary / calculateDayOfWeekSummary│   │
│  │  calculateDurationBuckets                         │   │
│  └─────────────────────┬────────────────────────────┘   │
│                        │                                │
│         ┌──────────────┼──────────────┐                 │
│         ▼              ▼              ▼                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐          │
│  │ Charts    │  │ Table     │  │ Calendar  │          │
│  │(charts.js)│  │(table.js) │  │(calendar  │          │
│  │           │  │           │  │  .js)     │          │
│  └───────────┘  └───────────┘  └───────────┘          │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │        LocalStorage (local-storage.js)            │   │
│  │        データ永続化・マージ・重複防止              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                         ▲
                         │ 静的ファイル配信
┌─────────────────────────────────────────────────────────┐
│              Node.js HTTP Server (server/index.js)       │
│              ポート: 3000（環境変数で変更可能）           │
└─────────────────────────────────────────────────────────┘
```

**設計原則**:
- **外部依存ゼロ**: npm パッケージ不要。Node.js 標準モジュールのみ使用
- **純粋関数設計**: KPI算出・CSV解析はブラウザと Node.js 両方で動作（UMD パターン）
- **データ駆動**: CSVをアップロードするだけで全KPI・チャートが自動生成
- **レスポンシブ**: モバイル対応ダークテーマUI

---

## 2. 技術スタック

| レイヤー | 技術 | 備考 |
|---------|------|------|
| バックエンド | Node.js 18+ | 標準 `http`, `fs`, `path` のみ |
| フロントエンド | Vanilla JavaScript (ES5互換) | フレームワーク不使用 |
| HTML/CSS | HTML5 + CSS3 | CSS カスタムプロパティによるダークテーマ |
| チャート描画 | Canvas API | Chart.js 等のライブラリ不使用 |
| データ永続化 | localStorage | ブラウザ内完結 |
| テスト | Node.js スクリプト | 独自テストランナー |

---

## 3. ディレクトリ構造

```
project-root/
├── dashboard/
│   ├── server/
│   │   └── index.js              # HTTP サーバー（静的ファイル配信 + API）
│   ├── public/                    # フロントエンド（ブラウザに配信）
│   │   ├── index.html             # SPA メインHTML
│   │   ├── css/
│   │   │   └── style.css          # ダークテーマCSS（CSS変数ベース）
│   │   └── js/
│   │       ├── csv-parser.js      # CSV解析・列マッピング・FIFO約定マッチング
│   │       ├── kpi.js             # KPI算出（純粋関数群）
│   │       ├── charts.js          # Canvas チャート描画（5種類）
│   │       ├── table.js           # トレード一覧テーブル（ソート・フィルタ）
│   │       ├── calendar.js        # P/L カレンダー
│   │       ├── local-storage.js   # データ永続化・マージ
│   │       └── app.js             # メインコントローラー（状態管理・UI統合）
│   ├── sample-data/               # サンプルCSVファイル
│   ├── tests/
│   │   ├── kpi.test.js            # KPI ユニットテスト（40+テスト）
│   │   ├── integration.test.js    # 統合テスト
│   │   └── local-storage.test.js  # ストレージテスト
│   ├── .env.example               # 環境変数テンプレート
│   └── README.md
```

---

## 4. セットアップ手順

### 前提条件

- Node.js 18 以上

### 起動

```bash
cd dashboard
node server/index.js
# → http://localhost:3000 でアクセス
```

npm install は不要です。

### 環境変数

```bash
# .env（任意）
PORT=3000    # デフォルト: 3000
```

### テスト実行

```bash
node dashboard/tests/kpi.test.js
node dashboard/tests/integration.test.js
node dashboard/tests/local-storage.test.js
```

---

## 5. モジュール構成と役割

各モジュールは IIFE（即時実行関数式）パターンで定義され、グローバル名前空間にエクスポートされます。
同時に `module.exports` が存在する場合は CommonJS としても動作します（UMD パターン）。

### 5.1 csv-parser.js — CSV解析エンジン

**役割**: 任意のCSV文字列を受け取り、統一されたトレードオブジェクト配列に変換する。

**主要機能**:
| 関数 | 説明 |
|------|------|
| `parseCSVText(csvText)` | CSV文字列 → `{ headers, rows }` に分解 |
| `detectCSVFormat(headers)` | ヘッダーからCSV形式を自動判別（`'fills'` / `'performance'` / `'unknown'`） |
| `autoDetectMapping(headers)` | ヘッダー列名をエイリアステーブルで照合し、カラムマッピングを生成 |
| `normalizeToTrades(parsed, mapping)` | Performance/Orders形式のCSVをトレード配列に正規化 |
| `normalizeFillsToTrades(parsed)` | Fills形式のCSVをFIFOマッチングでトレード配列に変換 |
| `parsePnL(str)` | `"$100.00"`, `"$(15.00)"`, `"-15.00"` → 数値 |
| `parseTimestamp(str)` | ISO形式 / `MM/DD/YYYY HH:mm:ss` 形式 → Date |
| `getCMETradingDate(date)` | タイムスタンプ → CME営業日（CT 17:00区切り） |

**エクスポート**: `window.CSVParser` / `module.exports`

### 5.2 kpi.js — KPI算出エンジン

**役割**: トレード配列を受け取り、各種KPIを算出する純粋関数群。

**主要機能**:
| 関数 | 説明 |
|------|------|
| `calculateAllKPIs(trades)` | 基本KPI一式を算出 |
| `calculateExtendedKPIs(trades)` | 拡張KPI（13項目）を算出 |
| `calculateDailySummary(trades)` | 日次サマリー（日次P/L、累積P/L、トレード数） |
| `calculateDayOfWeekSummary(trades)` | 曜日別サマリー（P/L、勝率） |
| `calculateDurationBuckets(trades)` | 保有時間バケット別統計 |
| `formatCurrency(value)` | 通貨フォーマット（`$1,234.56`） |
| `formatPercent(value)` | パーセントフォーマット（`65.0%`） |
| `parseDurationToSeconds(str)` | `"1hr 5min 30sec"` → 3930 |

**エクスポート**: `window.KPI` / `module.exports`

### 5.3 charts.js — チャート描画

Canvas API を使ったカスタムチャート描画（外部ライブラリ不使用）。

| チャート種類 | 関数 | 用途 |
|-------------|------|------|
| 日次損益棒グラフ | `drawDailyPnLChart(canvas, dailySummary)` | 日ごとのP/L |
| 累積損益折れ線グラフ | `drawCumulativePnLChart(canvas, dailySummary)` | 通算P/L推移 |
| 曜日別損益棒グラフ | `drawDayOfWeekChart(canvas, dayOfWeekSummary)` | 曜日ごとの傾向 |
| 保有時間別トレード数 | `drawDurationTradeCountChart(canvas, buckets)` | 時間帯分布 |
| 保有時間別勝率 | `drawDurationWinRateChart(canvas, buckets)` | 時間帯と勝率の関係 |

### 5.4 table.js — トレード一覧テーブル

ソート（全9カラム昇降順）とフィルタ（日付範囲・シンボル検索）対応。

### 5.5 calendar.js — P/Lカレンダー

月別カレンダーグリッドに日次P/Lを色分け表示。月送りナビゲーション付き。

### 5.6 local-storage.js — データ永続化

`localStorage` にトレードデータを保存。フィンガープリント（symbol + timestamp + pnl + price の組み合わせ）で重複を防止しつつマージ。

### 5.7 app.js — メインコントローラー

ファイルアップロード、CSV処理、マッピングモーダル、ダッシュボード描画を統合するエントリーポイント。

---

## 6. データフロー

```
ユーザーがCSVアップロード
    │
    ▼
FileReader.readAsText()
    │
    ▼
CSVParser.parseCSVText(csvText)          ← CSV文字列を { headers, rows } に分解
    │
    ▼
CSVParser.detectCSVFormat(headers)       ← ヘッダーからCSV形式を自動判別
    │
    ├─ "fills"       → CSVParser.normalizeFillsToTrades(parsed)  ← FIFOマッチング
    ├─ "performance" → CSVParser.autoDetectMapping(headers)
    │                   → CSVParser.normalizeToTrades(parsed, mapping)
    └─ "unknown"     → マッピングモーダルUI表示 → ユーザーが手動で列を選択
                        → CSVParser.normalizeToTrades(parsed, mapping)
    │
    ▼
TradeStorage.mergeTrades(existing, newTrades)  ← 重複除外してマージ
    │
    ▼
┌────────────────────────────────────────────┐
│ KPI算出                                    │
│  ├─ KPI.calculateAllKPIs(trades)           │
│  ├─ KPI.calculateExtendedKPIs(trades)      │
│  ├─ KPI.calculateDailySummary(trades)      │
│  ├─ KPI.calculateDayOfWeekSummary(trades)  │
│  └─ KPI.calculateDurationBuckets(trades)   │
└────────────────────────────────────────────┘
    │
    ▼
┌────────────────────────────────────────────┐
│ ダッシュボード描画                          │
│  ├─ KPIカード（5メイン + 13拡張）           │
│  ├─ P/Lカレンダー                           │
│  ├─ チャート（5種類）                       │
│  └─ トレード一覧テーブル                    │
└────────────────────────────────────────────┘
    │
    ▼
TradeStorage.save()  ← localStorageに保存
```

---

## 7. 正規化トレードオブジェクト仕様

すべてのCSV形式は最終的に以下の統一フォーマットに正規化されます。
**別のCSVに対応する場合、この仕様にさえ変換できれば KPI・チャート・テーブルはすべてそのまま動作します。**

```javascript
{
  id: Number,               // トレードID（連番）
  symbol: String,           // シンボル名（例: "NQH6", "MESH6"）
  qty: Number,              // 数量
  buyPrice: Number,         // エントリー価格
  sellPrice: Number,        // エグジット価格
  pnl: Number,              // 損益（ドル）※ 正=利益、負=損失
  boughtTimestamp: Date,    // エントリー時刻（Dateオブジェクト）
  soldTimestamp: Date,      // エグジット時刻（Dateオブジェクト）
  duration: String,         // 保有時間（例: "36min 8sec", "1hr 5min 30sec"）
  commission: Number,       // 手数料（ドル）
  direction: String,        // 売買方向（"Long" or "Short"）
  tradeDate: String,        // CME営業日（"YYYY-MM-DD"）
  dayOfWeek: String,        // 曜日（"月", "火", ... "日"）
  productDescription: String, // 商品説明（オプション）
  rawRow: Object            // 元のCSV行データ（デバッグ用）
}
```

### 各フィールドの詳細

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| `id` | Number | ○ | 1始まりの連番。マージ時に振り直される |
| `symbol` | String | ○ | 銘柄コード。手数料計算のプロダクトコード抽出に使用 |
| `qty` | Number | ○ | 取引数量。デフォルト 1 |
| `buyPrice` | Number | ○ | エントリー価格 |
| `sellPrice` | Number | ○ | エグジット価格 |
| `pnl` | Number | ○ | 損益額（ドル）。KPI算出の核となる値 |
| `boughtTimestamp` | Date | ○ | エントリー時刻。CME営業日の判定に使用 |
| `soldTimestamp` | Date | ○ | エグジット時刻。CME営業日・ソートに使用 |
| `duration` | String | ○ | `"Xhr Ymin Zsec"` 形式。保有時間分析に使用 |
| `commission` | Number | △ | 手数料。0でも可。Net P/L算出に使用 |
| `direction` | String | △ | `"Long"` or `"Short"`。空の場合はタイムスタンプから推定 |
| `tradeDate` | String | ○ | `"YYYY-MM-DD"` 形式。日次集計・カレンダーに使用 |
| `dayOfWeek` | String | ○ | 日本語曜日。曜日別集計に使用 |

---

## 8. CSV列マッピングの仕組み

### エイリアステーブル

`csv-parser.js` の `REQUIRED_COLUMNS` と `OPTIONAL_COLUMNS` で、1つの論理フィールドに対して複数の列名エイリアスを定義しています。

```javascript
// 必須カラム
var REQUIRED_COLUMNS = {
  symbol:           ['symbol', 'Symbol', 'Contract', 'contract', 'Product'],
  buyPrice:         ['buyPrice', 'Buy Price', 'Entry Price', 'entryPrice', 'avgPrice'],
  sellPrice:        ['sellPrice', 'Sell Price', 'Exit Price', 'exitPrice'],
  pnl:              ['pnl', 'P&L', 'PnL', 'Profit/Loss', 'Net P&L'],
  qty:              ['qty', 'Qty', 'Quantity', 'quantity', 'filledQty'],
  boughtTimestamp:  ['boughtTimestamp', 'Bought Timestamp', 'Buy Time', 'Entry Time', 'Fill Time'],
  soldTimestamp:    ['soldTimestamp', 'Sold Timestamp', 'Sell Time', 'Exit Time'],
  duration:         ['duration', 'Duration']
};

// オプションカラム
var OPTIONAL_COLUMNS = {
  commission:          ['commission', 'Commission', 'Fee', 'fee'],
  direction:           ['B/S', 'direction', 'Direction', 'Side', 'side', '_action'],
  productDescription:  ['Product Description', 'productDescription']
};
```

**マッピングの流れ**:
1. `autoDetectMapping(headers)` がCSVヘッダーをエイリアスと照合
2. 全必須カラムがマッチ → 自動で正規化処理に進む
3. 不足カラムがある場合 → マッピングモーダルUIを表示し、ユーザーが手動で列を選択

### フォーマット自動判別

```javascript
function detectCSVFormat(headers) {
  // Fills CSV: "Fill ID" + "B/S" + "commission" + "Contract" が全て存在
  // → 'fills'（FIFOマッチング処理へ）

  // Performance CSV: "buyPrice" + "sellPrice" + "pnl" が全て存在
  // → 'performance'（直接正規化処理へ）

  // それ以外 → 'unknown'（手動マッピングUIへ）
}
```

---

## 9. 別のCSV形式に対応する方法

### 方法 A: エイリアスの追加（最も簡単）

CSVの列名が既存エイリアスと異なる場合、`REQUIRED_COLUMNS` / `OPTIONAL_COLUMNS` にエイリアスを追加するだけで対応できます。

**例**: 新しいCSVの列名が `"EntryPrice"` と `"ExitPrice"` の場合

```javascript
// csv-parser.js の REQUIRED_COLUMNS を編集
var REQUIRED_COLUMNS = {
  // ...
  buyPrice:  ['buyPrice', 'Buy Price', 'Entry Price', 'entryPrice', 'avgPrice', 'EntryPrice'],  // ← 追加
  sellPrice: ['sellPrice', 'Sell Price', 'Exit Price', 'exitPrice', 'ExitPrice'],                // ← 追加
  // ...
};
```

### 方法 B: 新しいフォーマット検出の追加

完全に異なる構造のCSV（例: 約定データではなくポジション集計データ）に対応する場合。

**Step 1**: `detectCSVFormat()` に新しい判定ロジックを追加

```javascript
function detectCSVFormat(headers) {
  // 既存の判定...

  // 新規: MyBroker CSV
  var hasTradeId = headers.indexOf('TradeID') !== -1;
  var hasProfit = headers.indexOf('RealizedPnL') !== -1;
  if (hasTradeId && hasProfit) {
    return 'mybroker';
  }

  return 'unknown';
}
```

**Step 2**: 正規化関数を追加

```javascript
function normalizeMyBrokerToTrades(parsed) {
  var trades = [];
  for (var i = 0; i < parsed.rows.length; i++) {
    var row = parsed.rows[i];
    var rowObj = {};
    for (var j = 0; j < parsed.headers.length; j++) {
      rowObj[parsed.headers[j]] = row[j] || '';
    }

    // 正規化トレードオブジェクト（§7の仕様）に変換
    trades.push({
      id: i + 1,
      symbol: rowObj['Instrument'],
      qty: parseInt(rowObj['Size'], 10) || 1,
      buyPrice: parseFloat(rowObj['AvgEntry']) || 0,
      sellPrice: parseFloat(rowObj['AvgExit']) || 0,
      pnl: parsePnL(rowObj['RealizedPnL']),
      boughtTimestamp: parseTimestamp(rowObj['OpenTime']),
      soldTimestamp: parseTimestamp(rowObj['CloseTime']),
      duration: calculateDuration(
        parseTimestamp(rowObj['OpenTime']),
        parseTimestamp(rowObj['CloseTime'])
      ),
      commission: parseFloat(rowObj['Fees']) || 0,
      direction: rowObj['Side'] === 'BUY' ? 'Long' : 'Short',
      tradeDate: getCMETradingDate(parseTimestamp(rowObj['CloseTime'])),
      dayOfWeek: getDayOfWeekFromDateStr(
        getCMETradingDate(parseTimestamp(rowObj['CloseTime']))
      ),
      productDescription: '',
      rawRow: rowObj
    });
  }
  return trades;
}
```

**Step 3**: `app.js` の処理分岐に追加

```javascript
// app.js の processCSV 関数内
var format = CSVParser.detectCSVFormat(parsed.headers);
if (format === 'fills') {
  state.trades = CSVParser.normalizeFillsToTrades(parsed);
} else if (format === 'performance') {
  // 既存処理...
} else if (format === 'mybroker') {        // ← 追加
  state.trades = CSVParser.normalizeMyBrokerToTrades(parsed);
} else {
  // 手動マッピングUIを表示
}
```

### 方法 C: 手動マッピングUI（ユーザー操作で対応）

コード変更なしでも、`unknown` フォーマットと判定された場合にマッピングモーダルUIが表示されます。ユーザーがドロップダウンでCSVの各列を論理フィールドに紐付ければ、そのまま正規化できます。

### 方法 D: 先物以外（株式・FX等）への対応

先物固有のロジックを変更する必要があるポイント:

| 変更箇所 | ファイル | 内容 |
|---------|---------|------|
| 商品乗数テーブル | `csv-parser.js` `PRODUCT_MULTIPLIERS` | 先物のポイント単価。株式なら `1`、FXなら通貨ペアの乗数に変更 |
| 手数料テーブル | `csv-parser.js` `COMMISSION_PER_SIDE` | 商品ごとの片道手数料。証券会社に合わせて変更 |
| シンボル解析 | `csv-parser.js` `extractProductCode()` | 限月コードの除去ロジック。株式ならそのまま返す |
| 営業日判定 | `csv-parser.js` `getCMETradingDate()` | CME CT 17:00区切り。株式なら日付そのままでよい |
| DST計算 | `csv-parser.js` `getCTOffset()` | 米国夏時間。国内株式なら不要 |

**株式用に簡略化する例**:

```javascript
// 商品乗数: 株式は常に1
var PRODUCT_MULTIPLIERS = {};  // 空にする（デフォルト1が使用される）

// 手数料: 固定額にする
function calculateCommission(productCode, qty) {
  return 0;  // 手数料をCSVから読む場合は0でOK
}

// 営業日: タイムスタンプの日付をそのまま使用
function getTradingDate(date) {
  return formatDate(date);
}
```

---

## 10. KPI算出ロジック

### 基本KPI（`calculateAllKPIs`）

| KPI | 算出ロジック |
|-----|------------|
| Total P/L | `Σ trades[i].pnl` |
| Net P/L | `Total P/L - Σ trades[i].commission` |
| Win Rate | `winCount / totalTrades × 100` （`pnl > 0` = 勝ち、`pnl < 0` = 負け、`pnl === 0` = カウント外） |
| Avg Win | `Σ wins / winCount` |
| Avg Loss | `|Σ losses| / lossCount` |
| Profit Factor | `Σ wins / |Σ losses|` （損失ゼロなら `Infinity`） |
| Max Win | `max(pnl)` |
| Max Loss | `min(pnl)` |
| Max Consecutive Wins | 連続勝ち最大数 |
| Max Consecutive Losses | 連続負け最大数 |

### 拡張KPI（`calculateExtendedKPIs`）

| KPI | 説明 |
|-----|------|
| Most Active Day | 最もトレード数が多い曜日 |
| Most Profitable Day | 最も利益の大きい曜日 |
| Least Profitable Day | 最も損失の大きい曜日 |
| Total Active Days | トレードがあった営業日数 |
| Avg Trades Per Day | `totalTrades / totalActiveDays` |
| Total Lots | `Σ trades[i].qty` |
| Avg Duration | 平均保有時間（全トレード） |
| Avg Win Duration | 平均保有時間（勝ちトレードのみ） |
| Avg Loss Duration | 平均保有時間（負けトレードのみ） |
| Long/Short Ratio | ロング・ショートの比率 |
| Best Trade | 最大利益のトレード詳細 |
| Worst Trade | 最大損失のトレード詳細 |

### 日次サマリー（`calculateDailySummary`）

`tradeDate` でグループ化し、各日の P/L・累積P/L・トレード数・勝率を算出。

### 保有時間バケット（`calculateDurationBuckets`）

| バケット | 範囲 |
|---------|------|
| 0-5 min | 0秒 ～ 300秒 |
| 5-15 min | 300秒 ～ 900秒 |
| 15-30 min | 900秒 ～ 1800秒 |
| 30-60 min | 1800秒 ～ 3600秒 |
| 1-2 hr | 3600秒 ～ 7200秒 |
| 2-4 hr | 7200秒 ～ 14400秒 |
| 4hr+ | 14400秒 ～ |

---

## 11. チャート描画

Canvas API による自前描画。`charts.js` の基本パターン:

```javascript
function drawSomeChart(canvas, data) {
  var ctx = canvas.getContext('2d');

  // 1. デバイスピクセル比対応（Retina対応）
  var dpr = window.devicePixelRatio || 1;
  canvas.width = canvas.clientWidth * dpr;
  canvas.height = canvas.clientHeight * dpr;
  ctx.scale(dpr, dpr);

  // 2. 描画領域の計算（パディング考慮）
  var w = canvas.clientWidth - PADDING.left - PADDING.right;
  var h = canvas.clientHeight - PADDING.top - PADDING.bottom;

  // 3. データ範囲の計算 → スケール算出
  // 4. グリッド線描画
  // 5. データ描画（棒/線/面）
  // 6. 軸ラベル描画
}
```

**カラーパレット**（CSS変数と統一）:
```javascript
var COLORS = {
  profit: '#22c55e',      // 利益: 緑
  loss: '#ef4444',        // 損失: 赤
  line: '#3b82f6',        // 線: 青
  lineArea: 'rgba(59, 130, 246, 0.15)',
  grid: '#374151',
  text: '#9ca3af',
  bg: '#1f2937'
};
```

---

## 12. テーブル・カレンダー

### トレード一覧テーブル（table.js）

**カラム構成**: #, Date, Symbol, Qty, Entry, Exit, P/L, Commission, Duration

**ソート**: 全カラムで昇順/降順トグル
**フィルタ**: 日付範囲（From/To）、シンボル部分一致検索

### P/Lカレンダー（calendar.js）

月別カレンダーグリッドに、各日のP/Lを色分け（緑=利益、赤=損失）で表示。
トレード数も併記。月送りナビゲーション付き。

---

## 13. データ永続化（localStorage）

### ストレージキー

```
tradovate_analytics_data
```

### 保存形式

```javascript
{
  version: 2,
  trades: [...],          // トレード配列
  fileNames: [...],       // アップロード済みファイル名
  savedAt: "ISO日時文字列"
}
```

### 重複防止（フィンガープリント）

以下のフィールドを `|` で結合してフィンガープリントとし、同一トレードの重複登録を防止:

```
symbol | boughtTimestamp(ISO) | soldTimestamp(ISO) | pnl | buyPrice | sellPrice | qty
```

### カスタマイズ

ストレージキーを変更する場合は `local-storage.js` の `STORAGE_KEY` を変更してください。

---

## 14. テスト

### kpi.test.js（40+ テスト）

```bash
node dashboard/tests/kpi.test.js
```

テスト対象:
- `totalTrades`, `winCount`, `lossCount`, `evenCount`
- `winRate`, `totalPnL`, `netPnL`
- `avgWin`, `avgLoss`, `profitFactor`
- `maxWin`, `maxLoss`
- `maxConsecutiveWins`, `maxConsecutiveLosses`
- `parseDurationToSeconds` / `formatDurationFromSeconds`
- `calculateDailySummary`, `calculateDayOfWeekSummary`
- `calculateExtendedKPIs`, `calculateDurationBuckets`

### テストの追加方法

独自のテストランナーを使用しています。新しいテストの追加例:

```javascript
// tests/my-test.js
var KPI = require('../public/js/kpi');

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    console.log('FAIL: ' + message + ' (expected ' + expected + ', got ' + actual + ')');
    process.exitCode = 1;
  } else {
    console.log('PASS: ' + message);
  }
}

var trades = [
  { pnl: 100, commission: 5, qty: 1, duration: '5min 0sec', /* ... */ },
  { pnl: -50, commission: 5, qty: 1, duration: '3min 0sec', /* ... */ }
];

var kpis = KPI.calculateAllKPIs(trades);
assertEqual(kpis.totalTrades, 2, 'Total trades should be 2');
assertEqual(kpis.winRate, 50, 'Win rate should be 50%');
```

---

## 15. カスタマイズチェックリスト

別プロジェクトで本ダッシュボードを構築する際のチェックリストです。

### 必須（どのCSVでも変更が必要な箇所）

- [ ] **csv-parser.js**: `REQUIRED_COLUMNS` にCSVの列名エイリアスを追加
- [ ] **csv-parser.js**: `OPTIONAL_COLUMNS` に追加のエイリアスがあれば追加
- [ ] **csv-parser.js**: `detectCSVFormat()` に新しいフォーマット判定を追加（必要に応じて）

### 先物以外の商品を扱う場合

- [ ] **csv-parser.js**: `PRODUCT_MULTIPLIERS` を対象商品に合わせて編集
- [ ] **csv-parser.js**: `COMMISSION_PER_SIDE` を証券会社の手数料体系に合わせて編集
- [ ] **csv-parser.js**: `extractProductCode()` のシンボル解析ロジックを変更
- [ ] **csv-parser.js**: `getCMETradingDate()` を取引所の営業日区切りに変更（または日付をそのまま使用）

### UIのカスタマイズ

- [ ] **index.html**: タイトル・ヘッダーテキストを変更
- [ ] **style.css**: CSS変数（`:root`）でテーマカラーを変更
- [ ] **charts.js**: `COLORS` オブジェクトでチャートカラーを変更

### テーマカラー変更（style.css）

```css
:root {
  --bg-primary: #0f172a;     /* メイン背景色 */
  --bg-secondary: #1e293b;   /* カード背景色 */
  --text-primary: #f1f5f9;   /* メインテキスト色 */
  --positive: #22c55e;       /* 利益色（緑） */
  --negative: #ef4444;       /* 損失色（赤） */
  --accent: #3b82f6;         /* アクセント色（青） */
}
```

### オプション

- [ ] **local-storage.js**: `STORAGE_KEY` をプロジェクト固有の名前に変更
- [ ] **kpi.js**: 保有時間バケットの区間を変更（`calculateDurationBuckets`）
- [ ] **kpi.js**: 曜日表記を英語に変更（`DAY_NAME_MAP` の参照を削除）
- [ ] **server/index.js**: ポート番号・APIエンドポイントの追加

---

## 補足: 対応済みCSVフォーマット一覧

### Performance CSV（推奨）

列にエントリー/エグジット価格とP/Lが含まれる形式。直接正規化可能。

```csv
symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration
NQH6,-2,0,0.25,393570670790,393570670781,1,25266.00,25271.00,$100.00,02/11/2026 16:10:55,02/11/2026 15:34:46,36min 8sec
```

### Fills CSV

個別約定データ。FIFOマッチングアルゴリズムで買いと売りをペアリングしてトレードを生成。

```csv
_id,_orderId,_contractId,_timestamp,_tradeDate,_action,_qty,_price,...,B/S,Contract,Product,commission
393570670781,...,4086428,2026-02-11 06:34:46.772Z,...,1,1,25271.0,...,Sell,NQH6,NQ,0.79
```

**FIFOマッチングの仕組み**:
1. contractId でグループ化
2. タイムスタンプ順にソート
3. Buy/Sell をキューに入れ、反対側のキューが存在すればマッチング
4. P/L = `(sellPrice - buyPrice) × 商品乗数`
5. 手数料は商品ごとの固定テーブルから算出

### Orders CSV

注文データ。自動判別できないため手動マッピングUIで対応。

```csv
orderId,Account,Order ID,B/S,Contract,Product,Product Description,avgPrice,filledQty,Fill Time,...
393570670770,...,Sell,NQH6,NQ,E-Mini NASDAQ 100,25271.0,1,02/11/2026 15:34:46,...
```
