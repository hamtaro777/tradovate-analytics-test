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
  // NQ: $2.38 per side × 2 = $4.76
  assert.ok(Math.abs(trades[0].commission - 4.76) < 0.01, 'NQH6 commission should be $4.76, got $' + trades[0].commission);
});

test('Performance CSV: MES trade commission calculated from rate table', function () {
  const parsed = CSVParser.parseCSVText(perfCSV);
  const mapping = CSVParser.autoDetectMapping(parsed.headers).mapping;
  const trades = CSVParser.normalizeToTrades(parsed, mapping);
  // Second trade is MESH6: $0.81 per side × 2 = $1.62
  assert.ok(Math.abs(trades[1].commission - 1.62) < 0.01, 'MESH6 commission should be $1.62, got $' + trades[1].commission);
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

test('Fills CSV: detected as fills format', function () {
  const parsed = CSVParser.parseCSVText(fillsCSV);
  assert.strictEqual(CSVParser.detectCSVFormat(parsed.headers), 'fills');
});

test('Fills CSV: normalizeFillsToTrades produces 10 trades', function () {
  const parsed = CSVParser.parseCSVText(fillsCSV);
  const trades = CSVParser.normalizeFillsToTrades(parsed);
  assert.strictEqual(trades.length, 10, 'Expected 10 trades, got ' + trades.length);
});

test('Fills CSV: NQH6 trade has $100 profit', function () {
  const parsed = CSVParser.parseCSVText(fillsCSV);
  const trades = CSVParser.normalizeFillsToTrades(parsed);
  const nqTrade = trades.find(function (t) { return t.symbol === 'NQH6'; });
  assert.ok(nqTrade, 'NQH6 trade should exist');
  assert.ok(Math.abs(nqTrade.pnl - 100) < 0.01, 'NQH6 P&L should be $100, got $' + nqTrade.pnl);
});

test('Fills CSV: NQH6 trade commission calculated from rate table', function () {
  const parsed = CSVParser.parseCSVText(fillsCSV);
  const trades = CSVParser.normalizeFillsToTrades(parsed);
  const nqTrade = trades.find(function (t) { return t.symbol === 'NQH6'; });
  // NQ: $2.38 per side × 2 = $4.76
  assert.ok(Math.abs(nqTrade.commission - 4.76) < 0.01, 'NQH6 commission should be $4.76, got $' + nqTrade.commission);
});

test('Fills CSV: MESH6 first trade is $23.75 profit', function () {
  const parsed = CSVParser.parseCSVText(fillsCSV);
  const trades = CSVParser.normalizeFillsToTrades(parsed);
  const mesTrades = trades.filter(function (t) { return t.symbol === 'MESH6'; });
  // Sort by boughtTimestamp to get consistent order
  mesTrades.sort(function (a, b) { return a.boughtTimestamp.getTime() - b.boughtTimestamp.getTime(); });
  assert.ok(Math.abs(mesTrades[0].pnl - 23.75) < 0.01, 'First MES trade P&L should be $23.75, got $' + mesTrades[0].pnl);
});

test('Fills CSV: last 3 MESH6 trades are losses', function () {
  const parsed = CSVParser.parseCSVText(fillsCSV);
  const trades = CSVParser.normalizeFillsToTrades(parsed);
  const mesTrades = trades.filter(function (t) { return t.symbol === 'MESH6'; });
  mesTrades.sort(function (a, b) { return a.soldTimestamp.getTime() - b.soldTimestamp.getTime(); });
  const lastThree = mesTrades.slice(-3);
  assert.ok(lastThree[0].pnl < 0, 'Trade should be a loss: ' + lastThree[0].pnl);
  assert.ok(lastThree[1].pnl < 0, 'Trade should be a loss: ' + lastThree[1].pnl);
  assert.ok(lastThree[2].pnl < 0, 'Trade should be a loss: ' + lastThree[2].pnl);
});

test('Fills CSV: total P&L matches Performance CSV total', function () {
  const parsed = CSVParser.parseCSVText(fillsCSV);
  const trades = CSVParser.normalizeFillsToTrades(parsed);
  const totalPnL = trades.reduce(function (sum, t) { return sum + t.pnl; }, 0);
  // Performance CSV total: 100 + 23.75 + 22.50 + 3.75 + 11.25 + 8.75 + 10 - 15 - 12.50 - 16.25 = 136.25
  const expectedTotal = 136.25;
  assert.ok(Math.abs(totalPnL - expectedTotal) < 0.01, 'Total P&L should be $' + expectedTotal + ', got $' + totalPnL);
});

test('Fills CSV: total commission calculated from rate table', function () {
  const parsed = CSVParser.parseCSVText(fillsCSV);
  const trades = CSVParser.normalizeFillsToTrades(parsed);
  const totalComm = trades.reduce(function (sum, t) { return sum + t.commission; }, 0);
  // NQ: $4.76 × 1 trade + MES: $1.62 × 9 trades = $19.34
  const expectedComm = 4.76 + 1.62 * 9;
  assert.ok(Math.abs(totalComm - expectedComm) < 0.01, 'Total commission should be $' + expectedComm.toFixed(2) + ', got $' + totalComm.toFixed(2));
});

test('Fills CSV: KPI calculations from Fills match expected values', function () {
  const parsed = CSVParser.parseCSVText(fillsCSV);
  const trades = CSVParser.normalizeFillsToTrades(parsed);
  const kpis = KPI.calculateAllKPIs(trades);

  assert.strictEqual(kpis.totalTrades, 10);
  assert.strictEqual(kpis.winCount, 7);
  assert.strictEqual(kpis.lossCount, 3);
  assert.ok(Math.abs(kpis.winRate - 70) < 0.01, 'Win rate should be 70%, got ' + kpis.winRate);
  assert.ok(kpis.profitFactor > 1.0, 'Profit factor should be > 1');
  assert.ok(kpis.totalPnL > 0, 'Total P&L should be positive');
  // Net P&L = totalPnL - totalCommission
  assert.ok(Math.abs(kpis.netPnL - (kpis.totalPnL - kpis.totalCommission)) < 0.01);
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
