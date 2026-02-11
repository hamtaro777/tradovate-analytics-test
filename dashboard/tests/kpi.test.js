/**
 * KPI Calculator Unit Tests
 * 実行: node tests/kpi.test.js
 */
const assert = require('assert');
const KPI = require('../public/js/kpi');
const CSVParser = require('../public/js/csv-parser');

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

console.log('\n=== KPI Calculator Tests ===\n');

// テスト用トレードデータ
const sampleTrades = [
  { id: 1, symbol: 'NQH6', pnl: 100, commission: 0.79, tradeDate: '2026-02-11', dayOfWeek: '水' },
  { id: 2, symbol: 'MESH6', pnl: 23.75, commission: 0.25, tradeDate: '2026-02-11', dayOfWeek: '水' },
  { id: 3, symbol: 'MESH6', pnl: 22.50, commission: 0.25, tradeDate: '2026-02-11', dayOfWeek: '水' },
  { id: 4, symbol: 'MESH6', pnl: 3.75, commission: 0.25, tradeDate: '2026-02-11', dayOfWeek: '水' },
  { id: 5, symbol: 'MESH6', pnl: 11.25, commission: 0.25, tradeDate: '2026-02-12', dayOfWeek: '木' },
  { id: 6, symbol: 'MESH6', pnl: 8.75, commission: 0.25, tradeDate: '2026-02-12', dayOfWeek: '木' },
  { id: 7, symbol: 'MESH6', pnl: 10.00, commission: 0.25, tradeDate: '2026-02-12', dayOfWeek: '木' },
  { id: 8, symbol: 'MESH6', pnl: -15.00, commission: 0.25, tradeDate: '2026-02-12', dayOfWeek: '木' },
  { id: 9, symbol: 'MESH6', pnl: -12.50, commission: 0.25, tradeDate: '2026-02-12', dayOfWeek: '木' },
  { id: 10, symbol: 'MESH6', pnl: -16.25, commission: 0.25, tradeDate: '2026-02-12', dayOfWeek: '木' }
];

// === calculateAllKPIs ===
test('totalTrades is correct', function () {
  const result = KPI.calculateAllKPIs(sampleTrades);
  assert.strictEqual(result.totalTrades, 10);
});

test('winCount is correct', function () {
  const result = KPI.calculateAllKPIs(sampleTrades);
  assert.strictEqual(result.winCount, 7);
});

test('lossCount is correct', function () {
  const result = KPI.calculateAllKPIs(sampleTrades);
  assert.strictEqual(result.lossCount, 3);
});

test('winRate is 70%', function () {
  const result = KPI.calculateAllKPIs(sampleTrades);
  assert.strictEqual(result.winRate, 70);
});

test('totalPnL is correct', function () {
  const result = KPI.calculateAllKPIs(sampleTrades);
  const expected = 100 + 23.75 + 22.50 + 3.75 + 11.25 + 8.75 + 10 - 15 - 12.50 - 16.25;
  assert.ok(Math.abs(result.totalPnL - expected) < 0.01, `Expected ${expected}, got ${result.totalPnL}`);
});

test('avgWin is correct', function () {
  const result = KPI.calculateAllKPIs(sampleTrades);
  const totalWin = 100 + 23.75 + 22.50 + 3.75 + 11.25 + 8.75 + 10;
  const expected = totalWin / 7;
  assert.ok(Math.abs(result.avgWin - expected) < 0.01);
});

test('avgLoss is correct', function () {
  const result = KPI.calculateAllKPIs(sampleTrades);
  const totalLoss = 15 + 12.50 + 16.25;
  const expected = totalLoss / 3;
  assert.ok(Math.abs(result.avgLoss - expected) < 0.01);
});

test('profitFactor is correct', function () {
  const result = KPI.calculateAllKPIs(sampleTrades);
  const totalWin = 100 + 23.75 + 22.50 + 3.75 + 11.25 + 8.75 + 10;
  const totalLoss = 15 + 12.50 + 16.25;
  const expected = totalWin / totalLoss;
  assert.ok(Math.abs(result.profitFactor - expected) < 0.01);
});

test('maxWin is correct', function () {
  const result = KPI.calculateAllKPIs(sampleTrades);
  assert.strictEqual(result.maxWin, 100);
});

test('maxLoss is correct', function () {
  const result = KPI.calculateAllKPIs(sampleTrades);
  assert.strictEqual(result.maxLoss, -16.25);
});

test('netPnL subtracts commissions', function () {
  const result = KPI.calculateAllKPIs(sampleTrades);
  const totalComm = 0.79 + 0.25 * 9;
  assert.ok(Math.abs(result.netPnL - (result.totalPnL - totalComm)) < 0.01);
});

// === Empty trades ===
test('empty trades returns zero KPIs', function () {
  const result = KPI.calculateAllKPIs([]);
  assert.strictEqual(result.totalTrades, 0);
  assert.strictEqual(result.winRate, 0);
  assert.strictEqual(result.totalPnL, 0);
});

test('null trades returns zero KPIs', function () {
  const result = KPI.calculateAllKPIs(null);
  assert.strictEqual(result.totalTrades, 0);
});

// === Streaks ===
test('consecutive wins calculated correctly', function () {
  const result = KPI.calculateStreaks(sampleTrades);
  // Trades 1-7 are wins (7 consecutive), then 3 losses
  assert.strictEqual(result.maxWins, 7);
});

test('consecutive losses calculated correctly', function () {
  const result = KPI.calculateStreaks(sampleTrades);
  assert.strictEqual(result.maxLosses, 3);
});

// === Daily Summary ===
test('dailySummary has correct number of dates', function () {
  const result = KPI.calculateDailySummary(sampleTrades);
  assert.strictEqual(result.length, 2);
});

test('dailySummary dates are sorted', function () {
  const result = KPI.calculateDailySummary(sampleTrades);
  assert.strictEqual(result[0].date, '2026-02-11');
  assert.strictEqual(result[1].date, '2026-02-12');
});

test('dailySummary cumulative PnL is correct', function () {
  const result = KPI.calculateDailySummary(sampleTrades);
  const day1PnL = 100 + 23.75 + 22.50 + 3.75;
  const day2PnL = 11.25 + 8.75 + 10 - 15 - 12.50 - 16.25;
  assert.ok(Math.abs(result[0].cumulativePnL - day1PnL) < 0.01);
  assert.ok(Math.abs(result[1].cumulativePnL - (day1PnL + day2PnL)) < 0.01);
});

// === Day of Week Summary ===
test('dayOfWeekSummary has correct days', function () {
  const result = KPI.calculateDayOfWeekSummary(sampleTrades);
  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].day, '水');
  assert.strictEqual(result[1].day, '木');
});

// === Formatters ===
test('formatCurrency positive', function () {
  assert.strictEqual(KPI.formatCurrency(1234.56), '$1,234.56');
});

test('formatCurrency negative', function () {
  assert.strictEqual(KPI.formatCurrency(-500.00), '-$500.00');
});

test('formatCurrency zero', function () {
  assert.strictEqual(KPI.formatCurrency(0), '$0.00');
});

test('formatPercent', function () {
  assert.strictEqual(KPI.formatPercent(70.123), '70.1%');
});

test('formatProfitFactor infinity', function () {
  assert.strictEqual(KPI.formatProfitFactor(Infinity), '\u221e');
});

console.log('\n=== CSV Parser Tests ===\n');

// === parsePnL ===
test('parsePnL positive dollar amount', function () {
  assert.strictEqual(CSVParser.parsePnL('$100.00'), 100);
});

test('parsePnL negative parentheses', function () {
  assert.strictEqual(CSVParser.parsePnL('$(15.00)'), -15);
});

test('parsePnL negative with minus', function () {
  assert.strictEqual(CSVParser.parsePnL('-$16.25'), -16.25);
});

test('parsePnL plain number', function () {
  assert.strictEqual(CSVParser.parsePnL('23.75'), 23.75);
});

test('parsePnL with commas', function () {
  assert.strictEqual(CSVParser.parsePnL('$1,234.56'), 1234.56);
});

test('parsePnL empty string', function () {
  assert.strictEqual(CSVParser.parsePnL(''), 0);
});

// === parseCSVLine ===
test('parseCSVLine simple', function () {
  const result = CSVParser.parseCSVLine('a,b,c');
  assert.deepStrictEqual(result, ['a', 'b', 'c']);
});

test('parseCSVLine with quotes', function () {
  const result = CSVParser.parseCSVLine('"hello, world",b,c');
  assert.deepStrictEqual(result, ['hello, world', 'b', 'c']);
});

test('parseCSVLine with escaped quotes', function () {
  const result = CSVParser.parseCSVLine('"he said ""hi""",b');
  assert.deepStrictEqual(result, ['he said "hi"', 'b']);
});

// === autoDetectMapping ===
test('autoDetectMapping detects Performance CSV columns', function () {
  const headers = ['symbol', '_priceFormat', '_priceFormatType', '_tickSize', 'buyFillId', 'sellFillId', 'qty', 'buyPrice', 'sellPrice', 'pnl', 'boughtTimestamp', 'soldTimestamp', 'duration'];
  const result = CSVParser.autoDetectMapping(headers);
  assert.strictEqual(result.missing.length, 0);
  assert.strictEqual(result.mapping.symbol, 'symbol');
  assert.strictEqual(result.mapping.pnl, 'pnl');
});

test('autoDetectMapping reports missing columns', function () {
  const headers = ['symbol', 'qty', 'pnl'];
  const result = CSVParser.autoDetectMapping(headers);
  assert.ok(result.missing.length > 0);
  assert.ok(result.missing.indexOf('buyPrice') !== -1);
});

// === parseTimestamp ===
test('parseTimestamp ISO format', function () {
  const d = CSVParser.parseTimestamp('2026-02-11T06:34:46.772Z');
  assert.strictEqual(d.getFullYear(), 2026);
});

test('parseTimestamp MM/DD/YYYY HH:mm:ss format', function () {
  const d = CSVParser.parseTimestamp('02/11/2026 15:34:46');
  assert.strictEqual(d.getFullYear(), 2026);
  assert.strictEqual(d.getMonth(), 1); // February = 1
  assert.strictEqual(d.getDate(), 11);
});

// === formatDate ===
test('formatDate returns YYYY-MM-DD', function () {
  const d = new Date(2026, 1, 11);
  assert.strictEqual(CSVParser.formatDate(d), '2026-02-11');
});

// === getDayOfWeek ===
test('getDayOfWeek returns Japanese day', function () {
  const d = new Date(2026, 1, 11); // Wednesday
  assert.strictEqual(CSVParser.getDayOfWeek(d), '水');
});

// === normalizeToTrades ===
test('normalizeToTrades processes Performance CSV correctly', function () {
  const csvText = 'symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration\nNQH6,-2,0,0.25,1,2,1,25266.00,25271.00,$100.00,02/11/2026 16:10:55,02/11/2026 15:34:46,36min 8sec';
  const parsed = CSVParser.parseCSVText(csvText);
  const mapping = CSVParser.autoDetectMapping(parsed.headers).mapping;
  const trades = CSVParser.normalizeToTrades(parsed, mapping);
  assert.strictEqual(trades.length, 1);
  assert.strictEqual(trades[0].symbol, 'NQH6');
  assert.strictEqual(trades[0].pnl, 100);
  assert.strictEqual(trades[0].buyPrice, 25266);
  assert.strictEqual(trades[0].sellPrice, 25271);
});

// === Summary ===
console.log('\n─────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
console.log('─────────────────────────────\n');

process.exit(failed > 0 ? 1 : 0);
