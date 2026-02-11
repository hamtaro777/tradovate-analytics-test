/**
 * Integration Test - サンプルCSVファイルの解析テスト
 * 実行: node tests/integration.test.js
 */
const fs = require('fs');
const path = require('path');
const assert = require('assert');
const CSVParser = require('../public/js/csv-parser');
const KPI = require('../public/js/kpi');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  \u2713 ' + name);
  } catch (e) {
    failed++;
    console.log('  \u2717 ' + name);
    console.log('    ' + e.message);
  }
}

console.log('\n=== Integration Tests: Sample CSV Files ===\n');

// Performance CSV（推奨フォーマット）
const perfCSV = fs.readFileSync(
  path.join(__dirname, '..', 'sample-data', 'Performance_trdovate.csv'),
  'utf-8'
);

test('Performance CSV: parse successfully', function () {
  const parsed = CSVParser.parseCSVText(perfCSV);
  assert.ok(parsed.headers.length > 0, 'Headers should not be empty');
  assert.ok(parsed.rows.length > 0, 'Rows should not be empty');
});

test('Performance CSV: auto-detect all columns', function () {
  const parsed = CSVParser.parseCSVText(perfCSV);
  const detection = CSVParser.autoDetectMapping(parsed.headers);
  assert.strictEqual(detection.missing.length, 0, 'No missing columns: ' + detection.missing.join(', '));
});

test('Performance CSV: normalize to 10 trades', function () {
  const parsed = CSVParser.parseCSVText(perfCSV);
  const mapping = CSVParser.autoDetectMapping(parsed.headers).mapping;
  const trades = CSVParser.normalizeToTrades(parsed, mapping);
  assert.strictEqual(trades.length, 10);
});

test('Performance CSV: first trade is NQH6 with $100 profit', function () {
  const parsed = CSVParser.parseCSVText(perfCSV);
  const mapping = CSVParser.autoDetectMapping(parsed.headers).mapping;
  const trades = CSVParser.normalizeToTrades(parsed, mapping);
  assert.strictEqual(trades[0].symbol, 'NQH6');
  assert.strictEqual(trades[0].pnl, 100);
});

test('Performance CSV: last 3 trades are losses', function () {
  const parsed = CSVParser.parseCSVText(perfCSV);
  const mapping = CSVParser.autoDetectMapping(parsed.headers).mapping;
  const trades = CSVParser.normalizeToTrades(parsed, mapping);
  assert.ok(trades[7].pnl < 0);
  assert.ok(trades[8].pnl < 0);
  assert.ok(trades[9].pnl < 0);
});

test('Performance CSV: KPI calculations are consistent', function () {
  const parsed = CSVParser.parseCSVText(perfCSV);
  const mapping = CSVParser.autoDetectMapping(parsed.headers).mapping;
  const trades = CSVParser.normalizeToTrades(parsed, mapping);
  const kpis = KPI.calculateAllKPIs(trades);

  assert.strictEqual(kpis.totalTrades, 10);
  assert.strictEqual(kpis.winCount, 7);
  assert.strictEqual(kpis.lossCount, 3);
  assert.ok(Math.abs(kpis.winRate - 70) < 0.01);
  assert.ok(kpis.profitFactor > 1.0, 'Profit factor should be > 1');
  assert.ok(kpis.totalPnL > 0, 'Total P/L should be positive');
});

test('Performance CSV: daily summary has 2 days', function () {
  const parsed = CSVParser.parseCSVText(perfCSV);
  const mapping = CSVParser.autoDetectMapping(parsed.headers).mapping;
  const trades = CSVParser.normalizeToTrades(parsed, mapping);
  const daily = KPI.calculateDailySummary(trades);
  assert.strictEqual(daily.length, 2);
  assert.ok(daily[0].pnl > 0, 'First day should be profitable');
});

test('Performance CSV: day of week summary calculated', function () {
  const parsed = CSVParser.parseCSVText(perfCSV);
  const mapping = CSVParser.autoDetectMapping(parsed.headers).mapping;
  const trades = CSVParser.normalizeToTrades(parsed, mapping);
  const dow = KPI.calculateDayOfWeekSummary(trades);
  assert.ok(dow.length > 0, 'Day of week summary should not be empty');
});

// Fills CSV
const fillsCSV = fs.readFileSync(
  path.join(__dirname, '..', 'sample-data', 'Fills_tradovate.csv'),
  'utf-8'
);

test('Fills CSV: parse successfully', function () {
  const parsed = CSVParser.parseCSVText(fillsCSV);
  assert.ok(parsed.headers.length > 0);
  assert.ok(parsed.rows.length > 0);
  assert.strictEqual(parsed.rows.length, 20);
});

test('Fills CSV: detect some columns but report missing', function () {
  const parsed = CSVParser.parseCSVText(fillsCSV);
  const detection = CSVParser.autoDetectMapping(parsed.headers);
  // Fills CSV doesn't have buyPrice/sellPrice/pnl in the expected format
  assert.ok(detection.mapping.symbol !== undefined || detection.missing.length > 0);
});

// Orders CSV
const ordersCSV = fs.readFileSync(
  path.join(__dirname, '..', 'sample-data', 'Orders_tradovate.csv'),
  'utf-8'
);

test('Orders CSV: parse successfully', function () {
  const parsed = CSVParser.parseCSVText(ordersCSV);
  assert.ok(parsed.headers.length > 0);
  assert.ok(parsed.rows.length > 0);
});

// === Summary ===
console.log('\n─────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
console.log('─────────────────────────────\n');

process.exit(failed > 0 ? 1 : 0);
