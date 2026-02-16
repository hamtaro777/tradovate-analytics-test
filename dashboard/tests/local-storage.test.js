/**
 * Local Storage Module Unit Tests
 * 実行: node tests/local-storage.test.js
 */
const assert = require('assert');

// localStorageのモック
var store = {};
global.localStorage = {
  getItem: function (key) { return store[key] || null; },
  setItem: function (key, val) { store[key] = String(val); },
  removeItem: function (key) { delete store[key]; },
  clear: function () { store = {}; }
};

const TradeStorage = require('../public/js/local-storage');

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

function resetStore() {
  store = {};
}

// テスト用トレードデータ
var sampleTrades = [
  {
    id: 1, symbol: 'NQH6', qty: 1, buyPrice: 21000, sellPrice: 21005,
    pnl: 100, commission: 0.79,
    boughtTimestamp: new Date('2026-02-11T09:30:00Z'),
    soldTimestamp: new Date('2026-02-11T10:06:08Z'),
    duration: '36min 8sec', direction: 'Long',
    productDescription: 'E-Mini NASDAQ 100',
    tradeDate: '2026-02-11', dayOfWeek: '水'
  },
  {
    id: 2, symbol: 'MESH6', qty: 1, buyPrice: 5800, sellPrice: 5800.95,
    pnl: 23.75, commission: 0.25,
    boughtTimestamp: new Date('2026-02-11T10:15:00Z'),
    soldTimestamp: new Date('2026-02-11T10:20:00Z'),
    duration: '5min 0sec', direction: 'Long',
    productDescription: 'Micro E-mini S&P 500',
    tradeDate: '2026-02-11', dayOfWeek: '水'
  }
];

console.log('\n=== Local Storage Module Tests ===\n');

// === hasSaved ===
test('hasSaved returns false when no data', function () {
  resetStore();
  assert.strictEqual(TradeStorage.hasSaved(), false);
});

test('hasSaved returns true after saving', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileName: 'test.csv' });
  assert.strictEqual(TradeStorage.hasSaved(), true);
});

// === save ===
test('save returns true on success', function () {
  resetStore();
  var result = TradeStorage.save({ trades: sampleTrades, fileName: 'test.csv' });
  assert.strictEqual(result, true);
});

test('save stores data with correct key', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileName: 'test.csv' });
  assert.ok(store[TradeStorage._STORAGE_KEY] !== undefined);
});

test('saved data has correct version', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileName: 'test.csv' });
  var data = JSON.parse(store[TradeStorage._STORAGE_KEY]);
  assert.strictEqual(data.version, 1);
});

test('saved data has correct fileName', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileName: 'Performance.csv' });
  var data = JSON.parse(store[TradeStorage._STORAGE_KEY]);
  assert.strictEqual(data.fileName, 'Performance.csv');
});

test('saved data has correct number of trades', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileName: 'test.csv' });
  var data = JSON.parse(store[TradeStorage._STORAGE_KEY]);
  assert.strictEqual(data.trades.length, 2);
});

test('saved data serializes Date objects as ISO strings', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileName: 'test.csv' });
  var data = JSON.parse(store[TradeStorage._STORAGE_KEY]);
  assert.strictEqual(data.trades[0].boughtTimestamp, '2026-02-11T09:30:00.000Z');
  assert.strictEqual(data.trades[0].soldTimestamp, '2026-02-11T10:06:08.000Z');
});

test('saved data includes savedAt timestamp', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileName: 'test.csv' });
  var data = JSON.parse(store[TradeStorage._STORAGE_KEY]);
  assert.ok(data.savedAt);
  assert.ok(!isNaN(new Date(data.savedAt).getTime()));
});

// === load ===
test('load returns null when no data', function () {
  resetStore();
  assert.strictEqual(TradeStorage.load(), null);
});

test('load returns correct trade count', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileName: 'test.csv' });
  var loaded = TradeStorage.load();
  assert.strictEqual(loaded.trades.length, 2);
});

test('load restores Date objects from ISO strings', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileName: 'test.csv' });
  var loaded = TradeStorage.load();
  assert.ok(loaded.trades[0].boughtTimestamp instanceof Date);
  assert.ok(loaded.trades[0].soldTimestamp instanceof Date);
  assert.strictEqual(loaded.trades[0].boughtTimestamp.toISOString(), '2026-02-11T09:30:00.000Z');
});

test('load restores fileName', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileName: 'Performance.csv' });
  var loaded = TradeStorage.load();
  assert.strictEqual(loaded.fileName, 'Performance.csv');
});

test('load restores all trade fields', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileName: 'test.csv' });
  var loaded = TradeStorage.load();
  var t = loaded.trades[0];
  assert.strictEqual(t.id, 1);
  assert.strictEqual(t.symbol, 'NQH6');
  assert.strictEqual(t.qty, 1);
  assert.strictEqual(t.buyPrice, 21000);
  assert.strictEqual(t.sellPrice, 21005);
  assert.strictEqual(t.pnl, 100);
  assert.strictEqual(t.commission, 0.79);
  assert.strictEqual(t.duration, '36min 8sec');
  assert.strictEqual(t.direction, 'Long');
  assert.strictEqual(t.productDescription, 'E-Mini NASDAQ 100');
  assert.strictEqual(t.tradeDate, '2026-02-11');
  assert.strictEqual(t.dayOfWeek, '水');
});

test('load returns null for corrupted data', function () {
  resetStore();
  store[TradeStorage._STORAGE_KEY] = 'not valid json{{{';
  assert.strictEqual(TradeStorage.load(), null);
});

test('load returns null for wrong version', function () {
  resetStore();
  store[TradeStorage._STORAGE_KEY] = JSON.stringify({ version: 999, trades: [] });
  assert.strictEqual(TradeStorage.load(), null);
});

test('load returns null for missing trades array', function () {
  resetStore();
  store[TradeStorage._STORAGE_KEY] = JSON.stringify({ version: 1 });
  assert.strictEqual(TradeStorage.load(), null);
});

// === clear ===
test('clear removes saved data', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileName: 'test.csv' });
  assert.strictEqual(TradeStorage.hasSaved(), true);
  TradeStorage.clear();
  assert.strictEqual(TradeStorage.hasSaved(), false);
});

test('clear returns true on success', function () {
  resetStore();
  assert.strictEqual(TradeStorage.clear(), true);
});

// === round-trip ===
test('save then load preserves data integrity', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileName: 'roundtrip.csv' });
  var loaded = TradeStorage.load();
  assert.strictEqual(loaded.trades.length, sampleTrades.length);
  for (var i = 0; i < sampleTrades.length; i++) {
    assert.strictEqual(loaded.trades[i].pnl, sampleTrades[i].pnl);
    assert.strictEqual(loaded.trades[i].symbol, sampleTrades[i].symbol);
  }
});

test('empty trades array saves and loads correctly', function () {
  resetStore();
  TradeStorage.save({ trades: [], fileName: 'empty.csv' });
  var loaded = TradeStorage.load();
  assert.ok(loaded);
  assert.strictEqual(loaded.trades.length, 0);
});

// === Summary ===
console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
