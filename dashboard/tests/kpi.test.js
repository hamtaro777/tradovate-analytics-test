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
  { id: 1, symbol: 'NQH6', pnl: 100, commission: 4.76, tradeDate: '2026-02-11', dayOfWeek: '水' },
  { id: 2, symbol: 'MESH6', pnl: 23.75, commission: 1.62, tradeDate: '2026-02-11', dayOfWeek: '水' },
  { id: 3, symbol: 'MESH6', pnl: 22.50, commission: 1.62, tradeDate: '2026-02-11', dayOfWeek: '水' },
  { id: 4, symbol: 'MESH6', pnl: 3.75, commission: 1.62, tradeDate: '2026-02-11', dayOfWeek: '水' },
  { id: 5, symbol: 'MESH6', pnl: 11.25, commission: 1.62, tradeDate: '2026-02-12', dayOfWeek: '木' },
  { id: 6, symbol: 'MESH6', pnl: 8.75, commission: 1.62, tradeDate: '2026-02-12', dayOfWeek: '木' },
  { id: 7, symbol: 'MESH6', pnl: 10.00, commission: 1.62, tradeDate: '2026-02-12', dayOfWeek: '木' },
  { id: 8, symbol: 'MESH6', pnl: -15.00, commission: 1.62, tradeDate: '2026-02-12', dayOfWeek: '木' },
  { id: 9, symbol: 'MESH6', pnl: -12.50, commission: 1.62, tradeDate: '2026-02-12', dayOfWeek: '木' },
  { id: 10, symbol: 'MESH6', pnl: -16.25, commission: 1.62, tradeDate: '2026-02-12', dayOfWeek: '木' }
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
  const totalComm = 4.76 + 1.62 * 9;
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

// === detectCSVFormat ===
console.log('\n=== CSV Format Detection Tests ===\n');

test('detectCSVFormat identifies Fills CSV', function () {
  var headers = ['_id', '_orderId', '_contractId', '_timestamp', '_tradeDate', '_action', '_qty', '_price', '_active', '_accountId', 'Fill ID', 'Order ID', 'Timestamp', 'Date', 'Account', 'B/S', 'Quantity', 'Price', '_priceFormat', '_priceFormatType', '_tickSize', 'Contract', 'Product', 'Product Description', 'commission'];
  assert.strictEqual(CSVParser.detectCSVFormat(headers), 'fills');
});

test('detectCSVFormat identifies Performance CSV', function () {
  var headers = ['symbol', '_priceFormat', '_priceFormatType', '_tickSize', 'buyFillId', 'sellFillId', 'qty', 'buyPrice', 'sellPrice', 'pnl', 'boughtTimestamp', 'soldTimestamp', 'duration'];
  assert.strictEqual(CSVParser.detectCSVFormat(headers), 'performance');
});

test('detectCSVFormat returns unknown for unrecognized format', function () {
  var headers = ['col1', 'col2', 'col3'];
  assert.strictEqual(CSVParser.detectCSVFormat(headers), 'unknown');
});

// === detectDirection ===
console.log('\n=== Direction Detection Tests ===\n');

test('detectDirection from B/S column Buy', function () {
  assert.strictEqual(CSVParser.detectDirection({ 'B/S': ' Buy' }), 'Buy');
});

test('detectDirection from B/S column Sell', function () {
  assert.strictEqual(CSVParser.detectDirection({ 'B/S': ' Sell' }), 'Sell');
});

test('detectDirection from _action 0 is Buy', function () {
  assert.strictEqual(CSVParser.detectDirection({ 'B/S': '', '_action': '0' }), 'Buy');
});

test('detectDirection from _action 1 is Sell', function () {
  assert.strictEqual(CSVParser.detectDirection({ 'B/S': '', '_action': '1' }), 'Sell');
});

// === calculateDuration ===
console.log('\n=== Duration Calculation Tests ===\n');

test('calculateDuration 29 seconds', function () {
  var start = new Date(2026, 1, 12, 1, 33, 16);
  var end = new Date(2026, 1, 12, 1, 33, 45);
  assert.strictEqual(CSVParser.calculateDuration(start, end), '29sec');
});

test('calculateDuration 1 minute 27 seconds', function () {
  var start = new Date(2026, 1, 12, 1, 38, 20);
  var end = new Date(2026, 1, 12, 1, 39, 47);
  assert.strictEqual(CSVParser.calculateDuration(start, end), '1min 27sec');
});

test('calculateDuration 1 hour 5 minutes', function () {
  var start = new Date(2026, 1, 12, 1, 0, 0);
  var end = new Date(2026, 1, 12, 2, 5, 0);
  assert.strictEqual(CSVParser.calculateDuration(start, end), '1hr 5min');
});

test('calculateDuration 0 seconds', function () {
  var start = new Date(2026, 1, 12, 1, 0, 0);
  assert.strictEqual(CSVParser.calculateDuration(start, start), '0sec');
});

// === PRODUCT_MULTIPLIERS ===
console.log('\n=== Product Multiplier Tests ===\n');

test('NQ multiplier is 20', function () {
  assert.strictEqual(CSVParser.PRODUCT_MULTIPLIERS['NQ'], 20);
});

test('MES multiplier is 5', function () {
  assert.strictEqual(CSVParser.PRODUCT_MULTIPLIERS['MES'], 5);
});

test('ES multiplier is 50', function () {
  assert.strictEqual(CSVParser.PRODUCT_MULTIPLIERS['ES'], 50);
});

// === Commission Calculation ===
console.log('\n=== Commission Calculation Tests ===\n');

test('extractProductCode strips month and year from NQH6', function () {
  assert.strictEqual(CSVParser.extractProductCode('NQH6'), 'NQ');
});

test('extractProductCode strips month and year from MESH6', function () {
  assert.strictEqual(CSVParser.extractProductCode('MESH6'), 'MES');
});

test('extractProductCode strips month and year from M2KZ25', function () {
  assert.strictEqual(CSVParser.extractProductCode('M2KZ25'), 'M2K');
});

test('extractProductCode strips month and year from ESZ5', function () {
  assert.strictEqual(CSVParser.extractProductCode('ESZ5'), 'ES');
});

test('extractProductCode returns empty string for empty input', function () {
  assert.strictEqual(CSVParser.extractProductCode(''), '');
});

test('calculateCommission returns round-trip for NQ qty 1', function () {
  // NQ: $2.38 per side × 2 = $4.76
  assert.ok(Math.abs(CSVParser.calculateCommission('NQ', 1) - 4.76) < 0.01);
});

test('calculateCommission returns round-trip for MES qty 1', function () {
  // MES: $0.81 per side × 2 = $1.62
  assert.ok(Math.abs(CSVParser.calculateCommission('MES', 1) - 1.62) < 0.01);
});

test('calculateCommission scales by qty', function () {
  // NQ: $2.38 × 2 × 3 = $14.28
  assert.ok(Math.abs(CSVParser.calculateCommission('NQ', 3) - 14.28) < 0.01);
});

test('calculateCommission returns 0 for unknown product', function () {
  assert.strictEqual(CSVParser.calculateCommission('UNKNOWN', 1), 0);
});

// === normalizeFillsToTrades ===
console.log('\n=== Fills to Trades Normalization Tests ===\n');

test('normalizeFillsToTrades creates correct number of trades from simple fills', function () {
  var csvText = '_id,_orderId,_contractId,_timestamp,_tradeDate,_action,_qty,_price,_active,_accountId,Fill ID,Order ID,Timestamp,Date,Account,B/S,Quantity,Price,_priceFormat,_priceFormatType,_tickSize,Contract,Product,Product Description,commission\n' +
    '1,1,100,2026-02-11 16:33:16.562Z,2026-02-11,0,1,6961.25,true,1,1,1,02/12/2026 01:33:16,2/12/26,ACC, Buy,1,6961.25,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25\n' +
    '2,2,100,2026-02-11 16:33:46.071Z,2026-02-11,1,1,6966.0,true,1,2,2,02/12/2026 01:33:46,2/12/26,ACC, Sell,1,6966.00,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25';
  var parsed = CSVParser.parseCSVText(csvText);
  var trades = CSVParser.normalizeFillsToTrades(parsed);
  assert.strictEqual(trades.length, 1);
});

test('normalizeFillsToTrades calculates PnL correctly for MES', function () {
  var csvText = '_id,_orderId,_contractId,_timestamp,_tradeDate,_action,_qty,_price,_active,_accountId,Fill ID,Order ID,Timestamp,Date,Account,B/S,Quantity,Price,_priceFormat,_priceFormatType,_tickSize,Contract,Product,Product Description,commission\n' +
    '1,1,100,2026-02-11 16:33:16.562Z,2026-02-11,0,1,6961.25,true,1,1,1,02/12/2026 01:33:16,2/12/26,ACC, Buy,1,6961.25,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25\n' +
    '2,2,100,2026-02-11 16:33:46.071Z,2026-02-11,1,1,6966.0,true,1,2,2,02/12/2026 01:33:46,2/12/26,ACC, Sell,1,6966.00,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25';
  var parsed = CSVParser.parseCSVText(csvText);
  var trades = CSVParser.normalizeFillsToTrades(parsed);
  // (6966.00 - 6961.25) * 5 = $23.75
  assert.ok(Math.abs(trades[0].pnl - 23.75) < 0.01, 'Expected $23.75, got $' + trades[0].pnl);
});

test('normalizeFillsToTrades calculates PnL correctly for NQ', function () {
  var csvText = '_id,_orderId,_contractId,_timestamp,_tradeDate,_action,_qty,_price,_active,_accountId,Fill ID,Order ID,Timestamp,Date,Account,B/S,Quantity,Price,_priceFormat,_priceFormatType,_tickSize,Contract,Product,Product Description,commission\n' +
    '1,1,200,2026-02-11 06:34:46.772Z,2026-02-11,1,1,25271.0,true,1,1,1,02/11/2026 15:34:46,2/11/26,ACC, Sell,1,25271.00,-2,0,0.25,NQH6,NQ,E-Mini NASDAQ 100,0.79\n' +
    '2,2,200,2026-02-11 07:10:55.153Z,2026-02-11,0,1,25266.0,true,1,2,2,02/11/2026 16:10:55,2/11/26,ACC, Buy,1,25266.00,-2,0,0.25,NQH6,NQ,E-Mini NASDAQ 100,0.79';
  var parsed = CSVParser.parseCSVText(csvText);
  var trades = CSVParser.normalizeFillsToTrades(parsed);
  assert.strictEqual(trades.length, 1);
  // Short trade: sell first at 25271, buy back at 25266 → P&L = (25271 - 25266) * 20 = $100
  assert.ok(Math.abs(trades[0].pnl - 100) < 0.01, 'Expected $100, got $' + trades[0].pnl);
});

test('normalizeFillsToTrades calculates commission from product code', function () {
  var csvText = '_id,_orderId,_contractId,_timestamp,_tradeDate,_action,_qty,_price,_active,_accountId,Fill ID,Order ID,Timestamp,Date,Account,B/S,Quantity,Price,_priceFormat,_priceFormatType,_tickSize,Contract,Product,Product Description,commission\n' +
    '1,1,200,2026-02-11 06:34:46.772Z,2026-02-11,1,1,25271.0,true,1,1,1,02/11/2026 15:34:46,2/11/26,ACC, Sell,1,25271.00,-2,0,0.25,NQH6,NQ,E-Mini NASDAQ 100,0.79\n' +
    '2,2,200,2026-02-11 07:10:55.153Z,2026-02-11,0,1,25266.0,true,1,2,2,02/11/2026 16:10:55,2/11/26,ACC, Buy,1,25266.00,-2,0,0.25,NQH6,NQ,E-Mini NASDAQ 100,0.79';
  var parsed = CSVParser.parseCSVText(csvText);
  var trades = CSVParser.normalizeFillsToTrades(parsed);
  // NQ: $2.38 per side × 2 = $4.76
  assert.ok(Math.abs(trades[0].commission - 4.76) < 0.01, 'Expected $4.76, got $' + trades[0].commission);
});

test('normalizeFillsToTrades handles loss trade correctly', function () {
  var csvText = '_id,_orderId,_contractId,_timestamp,_tradeDate,_action,_qty,_price,_active,_accountId,Fill ID,Order ID,Timestamp,Date,Account,B/S,Quantity,Price,_priceFormat,_priceFormatType,_tickSize,Contract,Product,Product Description,commission\n' +
    '1,1,100,2026-02-11 16:42:55.262Z,2026-02-11,0,1,6971.25,true,1,1,1,02/12/2026 01:42:55,2/12/26,ACC, Buy,1,6971.25,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25\n' +
    '2,2,100,2026-02-11 16:46:35.462Z,2026-02-11,1,1,6968.25,true,1,2,2,02/12/2026 01:46:35,2/12/26,ACC, Sell,1,6968.25,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25';
  var parsed = CSVParser.parseCSVText(csvText);
  var trades = CSVParser.normalizeFillsToTrades(parsed);
  // (6968.25 - 6971.25) * 5 = -$15.00
  assert.ok(Math.abs(trades[0].pnl - (-15.00)) < 0.01, 'Expected -$15.00, got $' + trades[0].pnl);
});

test('normalizeFillsToTrades FIFO matches multiple fills correctly', function () {
  var csvText = '_id,_orderId,_contractId,_timestamp,_tradeDate,_action,_qty,_price,_active,_accountId,Fill ID,Order ID,Timestamp,Date,Account,B/S,Quantity,Price,_priceFormat,_priceFormatType,_tickSize,Contract,Product,Product Description,commission\n' +
    '1,1,100,2026-02-11 16:33:16.562Z,2026-02-11,0,1,6961.25,true,1,1,1,02/12/2026 01:33:16,2/12/26,ACC, Buy,1,6961.25,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25\n' +
    '2,2,100,2026-02-11 16:33:16.631Z,2026-02-11,0,1,6961.50,true,1,2,2,02/12/2026 01:33:16,2/12/26,ACC, Buy,1,6961.50,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25\n' +
    '3,3,100,2026-02-11 16:33:46.071Z,2026-02-11,1,1,6966.0,true,1,3,3,02/12/2026 01:33:46,2/12/26,ACC, Sell,1,6966.00,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25\n' +
    '4,4,100,2026-02-11 16:33:46.072Z,2026-02-11,1,1,6966.0,true,1,4,4,02/12/2026 01:33:46,2/12/26,ACC, Sell,1,6966.00,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25';
  var parsed = CSVParser.parseCSVText(csvText);
  var trades = CSVParser.normalizeFillsToTrades(parsed);
  assert.strictEqual(trades.length, 2);
  // FIFO: first buy (6961.25) matched with first sell (6966.00) → $23.75
  assert.ok(Math.abs(trades[0].pnl - 23.75) < 0.01, 'Trade 1: Expected $23.75, got $' + trades[0].pnl);
  // FIFO: second buy (6961.50) matched with second sell (6966.00) → $22.50
  assert.ok(Math.abs(trades[1].pnl - 22.50) < 0.01, 'Trade 2: Expected $22.50, got $' + trades[1].pnl);
});

// === CME Trading Date Tests ===
console.log('\n=== CME Trading Date Tests ===\n');

test('getCTOffset returns -6 for CST (February)', function () {
  var d = new Date(Date.UTC(2026, 1, 11, 16, 0, 0)); // Feb 11, 2026
  assert.strictEqual(CSVParser.getCTOffset(d), -6);
});

test('getCTOffset returns -5 for CDT (July)', function () {
  var d = new Date(Date.UTC(2026, 6, 15, 16, 0, 0)); // Jul 15, 2026
  assert.strictEqual(CSVParser.getCTOffset(d), -5);
});

test('getCTOffset DST boundary: just before DST start is CST', function () {
  // 2026 DST starts Mar 8 at 2:00AM CST = 8:00AM UTC
  var d = new Date(Date.UTC(2026, 2, 8, 7, 59, 59)); // 1 sec before DST
  assert.strictEqual(CSVParser.getCTOffset(d), -6);
});

test('getCTOffset DST boundary: at DST start is CDT', function () {
  var d = new Date(Date.UTC(2026, 2, 8, 8, 0, 0)); // exactly DST start
  assert.strictEqual(CSVParser.getCTOffset(d), -5);
});

test('getCTOffset DST boundary: just before DST end is CDT', function () {
  // 2026 DST ends Nov 1 at 2:00AM CDT = 7:00AM UTC
  var d = new Date(Date.UTC(2026, 10, 1, 6, 59, 59)); // 1 sec before end
  assert.strictEqual(CSVParser.getCTOffset(d), -5);
});

test('getCTOffset DST boundary: at DST end is CST', function () {
  var d = new Date(Date.UTC(2026, 10, 1, 7, 0, 0)); // exactly DST end
  assert.strictEqual(CSVParser.getCTOffset(d), -6);
});

test('getCMETradingDate before 5PM CT returns same day (CST)', function () {
  // Feb 11, 2026 10:00 AM CST = 16:00 UTC
  var d = new Date(Date.UTC(2026, 1, 11, 16, 0, 0));
  assert.strictEqual(CSVParser.getCMETradingDate(d), '2026-02-11');
});

test('getCMETradingDate at exactly 5PM CT returns next day (CST)', function () {
  // Feb 11, 2026 5:00 PM CST = 23:00 UTC
  var d = new Date(Date.UTC(2026, 1, 11, 23, 0, 0));
  assert.strictEqual(CSVParser.getCMETradingDate(d), '2026-02-12');
});

test('getCMETradingDate just before 5PM CT returns same day (CST)', function () {
  // Feb 11, 2026 4:59 PM CST = 22:59 UTC
  var d = new Date(Date.UTC(2026, 1, 11, 22, 59, 59));
  assert.strictEqual(CSVParser.getCMETradingDate(d), '2026-02-11');
});

test('getCMETradingDate after 5PM CT returns next day (CST)', function () {
  // Feb 11, 2026 5:30 PM CST = 23:30 UTC
  var d = new Date(Date.UTC(2026, 1, 11, 23, 30, 0));
  assert.strictEqual(CSVParser.getCMETradingDate(d), '2026-02-12');
});

test('getCMETradingDate before 5PM CDT returns same day (summer)', function () {
  // Jul 15, 2026 10:00 AM CDT = 15:00 UTC
  var d = new Date(Date.UTC(2026, 6, 15, 15, 0, 0));
  assert.strictEqual(CSVParser.getCMETradingDate(d), '2026-07-15');
});

test('getCMETradingDate at 5PM CDT returns next day (summer)', function () {
  // Jul 15, 2026 5:00 PM CDT = 22:00 UTC
  var d = new Date(Date.UTC(2026, 6, 15, 22, 0, 0));
  assert.strictEqual(CSVParser.getCMETradingDate(d), '2026-07-16');
});

test('getCMETradingDate late night CT maps to current day', function () {
  // Feb 12, 2026 2:00 AM CST = 08:00 UTC
  var d = new Date(Date.UTC(2026, 1, 12, 8, 0, 0));
  assert.strictEqual(CSVParser.getCMETradingDate(d), '2026-02-12');
});

test('getDayOfWeekFromDateStr returns correct day for Wednesday', function () {
  assert.strictEqual(CSVParser.getDayOfWeekFromDateStr('2026-02-11'), '水');
});

test('getDayOfWeekFromDateStr returns correct day for Thursday', function () {
  assert.strictEqual(CSVParser.getDayOfWeekFromDateStr('2026-02-12'), '木');
});

test('normalizeFillsToTrades assigns CME trading date for daytime trade', function () {
  // _timestamp: 2026-02-11 16:33:46.071Z = UTC 16:33 = CST 10:33 AM → trading date Feb 11
  var csvText = '_id,_orderId,_contractId,_timestamp,_tradeDate,_action,_qty,_price,_active,_accountId,Fill ID,Order ID,Timestamp,Date,Account,B/S,Quantity,Price,_priceFormat,_priceFormatType,_tickSize,Contract,Product,Product Description,commission\n' +
    '1,1,100,2026-02-11 16:33:16.562Z,2026-02-11,0,1,6961.25,true,1,1,1,02/12/2026 01:33:16,2/12/26,ACC, Buy,1,6961.25,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25\n' +
    '2,2,100,2026-02-11 16:33:46.071Z,2026-02-11,1,1,6966.0,true,1,2,2,02/12/2026 01:33:46,2/12/26,ACC, Sell,1,6966.00,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25';
  var parsed = CSVParser.parseCSVText(csvText);
  var trades = CSVParser.normalizeFillsToTrades(parsed);
  assert.strictEqual(trades[0].tradeDate, '2026-02-11');
  assert.strictEqual(trades[0].dayOfWeek, '水');
});

test('normalizeFillsToTrades assigns next CME trading day for after 5PM CT', function () {
  // Sell at 2026-02-11 23:30:00Z = CST 5:30 PM → trading date Feb 12
  var csvText = '_id,_orderId,_contractId,_timestamp,_tradeDate,_action,_qty,_price,_active,_accountId,Fill ID,Order ID,Timestamp,Date,Account,B/S,Quantity,Price,_priceFormat,_priceFormatType,_tickSize,Contract,Product,Product Description,commission\n' +
    '1,1,100,2026-02-11 22:00:00.000Z,2026-02-11,0,1,6961.25,true,1,1,1,02/12/2026 07:00:00,2/12/26,ACC, Buy,1,6961.25,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25\n' +
    '2,2,100,2026-02-11 23:30:00.000Z,2026-02-11,1,1,6966.0,true,1,2,2,02/12/2026 08:30:00,2/12/26,ACC, Sell,1,6966.00,-2,0,0.25,MESH6,MES,Micro E-mini S&P 500,0.25';
  var parsed = CSVParser.parseCSVText(csvText);
  var trades = CSVParser.normalizeFillsToTrades(parsed);
  assert.strictEqual(trades[0].tradeDate, '2026-02-12');
  assert.strictEqual(trades[0].dayOfWeek, '木');
});

// === Summary ===
console.log('\n─────────────────────────────');
console.log('Results: ' + passed + ' passed, ' + failed + ' failed');
console.log('─────────────────────────────\n');

process.exit(failed > 0 ? 1 : 0);
