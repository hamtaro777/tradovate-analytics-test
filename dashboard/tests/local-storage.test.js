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
    pnl: 100, commission: 4.76,
    boughtTimestamp: new Date('2026-02-11T09:30:00Z'),
    soldTimestamp: new Date('2026-02-11T10:06:08Z'),
    duration: '36min 8sec', direction: 'Long',
    productDescription: 'E-Mini NASDAQ 100',
    tradeDate: '2026-02-11', dayOfWeek: '水'
  },
  {
    id: 2, symbol: 'MESH6', qty: 1, buyPrice: 5800, sellPrice: 5800.95,
    pnl: 23.75, commission: 1.62,
    boughtTimestamp: new Date('2026-02-11T10:15:00Z'),
    soldTimestamp: new Date('2026-02-11T10:20:00Z'),
    duration: '5min 0sec', direction: 'Long',
    productDescription: 'Micro E-mini S&P 500',
    tradeDate: '2026-02-11', dayOfWeek: '水'
  }
];

// 追加テスト用トレード（別の日のデータ）
var additionalTrades = [
  {
    id: 1, symbol: 'MESH6', qty: 1, buyPrice: 5810, sellPrice: 5812.25,
    pnl: 11.25, commission: 1.62,
    boughtTimestamp: new Date('2026-02-12T09:30:00Z'),
    soldTimestamp: new Date('2026-02-12T09:45:00Z'),
    duration: '15min 0sec', direction: 'Long',
    productDescription: 'Micro E-mini S&P 500',
    tradeDate: '2026-02-12', dayOfWeek: '木'
  },
  {
    id: 2, symbol: 'MESH6', qty: 1, buyPrice: 5815, sellPrice: 5813.25,
    pnl: -8.75, commission: 1.62,
    boughtTimestamp: new Date('2026-02-12T10:00:00Z'),
    soldTimestamp: new Date('2026-02-12T10:10:00Z'),
    duration: '10min 0sec', direction: 'Long',
    productDescription: 'Micro E-mini S&P 500',
    tradeDate: '2026-02-12', dayOfWeek: '木'
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
  TradeStorage.save({ trades: sampleTrades, fileNames: ['test.csv'] });
  assert.strictEqual(TradeStorage.hasSaved(), true);
});

// === save (v2 format) ===
test('save returns true on success', function () {
  resetStore();
  var result = TradeStorage.save({ trades: sampleTrades, fileNames: ['test.csv'] });
  assert.strictEqual(result, true);
});

test('save stores data with correct key', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: ['test.csv'] });
  assert.ok(store[TradeStorage._STORAGE_KEY] !== undefined);
});

test('saved data has version 2', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: ['test.csv'] });
  var data = JSON.parse(store[TradeStorage._STORAGE_KEY]);
  assert.strictEqual(data.version, 2);
});

test('saved data has correct fileNames array', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: ['Performance.csv', 'Fills.csv'] });
  var data = JSON.parse(store[TradeStorage._STORAGE_KEY]);
  assert.deepStrictEqual(data.fileNames, ['Performance.csv', 'Fills.csv']);
});

test('save accepts string for fileNames and converts to array', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: 'single.csv' });
  var data = JSON.parse(store[TradeStorage._STORAGE_KEY]);
  assert.deepStrictEqual(data.fileNames, ['single.csv']);
});

test('saved data has correct number of trades', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: ['test.csv'] });
  var data = JSON.parse(store[TradeStorage._STORAGE_KEY]);
  assert.strictEqual(data.trades.length, 2);
});

test('saved data serializes Date objects as ISO strings', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: ['test.csv'] });
  var data = JSON.parse(store[TradeStorage._STORAGE_KEY]);
  assert.strictEqual(data.trades[0].boughtTimestamp, '2026-02-11T09:30:00.000Z');
  assert.strictEqual(data.trades[0].soldTimestamp, '2026-02-11T10:06:08.000Z');
});

test('saved data includes savedAt timestamp', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: ['test.csv'] });
  var data = JSON.parse(store[TradeStorage._STORAGE_KEY]);
  assert.ok(data.savedAt);
  assert.ok(!isNaN(new Date(data.savedAt).getTime()));
});

// === load (v2 format) ===
test('load returns null when no data', function () {
  resetStore();
  assert.strictEqual(TradeStorage.load(), null);
});

test('load returns correct trade count', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: ['test.csv'] });
  var loaded = TradeStorage.load();
  assert.strictEqual(loaded.trades.length, 2);
});

test('load restores Date objects from ISO strings', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: ['test.csv'] });
  var loaded = TradeStorage.load();
  assert.ok(loaded.trades[0].boughtTimestamp instanceof Date);
  assert.ok(loaded.trades[0].soldTimestamp instanceof Date);
  assert.strictEqual(loaded.trades[0].boughtTimestamp.toISOString(), '2026-02-11T09:30:00.000Z');
});

test('load restores fileNames array', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: ['Performance.csv', 'Fills.csv'] });
  var loaded = TradeStorage.load();
  assert.deepStrictEqual(loaded.fileNames, ['Performance.csv', 'Fills.csv']);
});

test('load restores all trade fields', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: ['test.csv'] });
  var loaded = TradeStorage.load();
  var t = loaded.trades[0];
  assert.strictEqual(t.id, 1);
  assert.strictEqual(t.symbol, 'NQH6');
  assert.strictEqual(t.qty, 1);
  assert.strictEqual(t.buyPrice, 21000);
  assert.strictEqual(t.sellPrice, 21005);
  assert.strictEqual(t.pnl, 100);
  assert.strictEqual(t.commission, 4.76);
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

test('load returns null for unsupported version', function () {
  resetStore();
  store[TradeStorage._STORAGE_KEY] = JSON.stringify({ version: 999, trades: [] });
  assert.strictEqual(TradeStorage.load(), null);
});

test('load returns null for missing trades array', function () {
  resetStore();
  store[TradeStorage._STORAGE_KEY] = JSON.stringify({ version: 2 });
  assert.strictEqual(TradeStorage.load(), null);
});

// === v1 → v2 マイグレーション ===
test('load migrates v1 format (fileName → fileNames)', function () {
  resetStore();
  store[TradeStorage._STORAGE_KEY] = JSON.stringify({
    version: 1,
    savedAt: '2026-02-15T12:00:00.000Z',
    fileName: 'old-format.csv',
    trades: [{
      id: 1, symbol: 'NQH6', qty: 1, buyPrice: 21000, sellPrice: 21005,
      pnl: 100, commission: 4.76,
      boughtTimestamp: '2026-02-11T09:30:00.000Z',
      soldTimestamp: '2026-02-11T10:06:08.000Z',
      duration: '36min 8sec', direction: 'Long',
      productDescription: 'E-Mini NASDAQ 100',
      tradeDate: '2026-02-11', dayOfWeek: '水'
    }]
  });
  var loaded = TradeStorage.load();
  assert.ok(loaded);
  assert.deepStrictEqual(loaded.fileNames, ['old-format.csv']);
  assert.strictEqual(loaded.trades.length, 1);
  assert.strictEqual(loaded.trades[0].symbol, 'NQH6');
});

test('v1 migration handles empty fileName', function () {
  resetStore();
  store[TradeStorage._STORAGE_KEY] = JSON.stringify({
    version: 1,
    savedAt: '2026-02-15T12:00:00.000Z',
    fileName: '',
    trades: []
  });
  var loaded = TradeStorage.load();
  assert.ok(loaded);
  assert.deepStrictEqual(loaded.fileNames, []);
});

// === clear ===
test('clear removes saved data', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: ['test.csv'] });
  assert.strictEqual(TradeStorage.hasSaved(), true);
  TradeStorage.clear();
  assert.strictEqual(TradeStorage.hasSaved(), false);
});

test('clear returns true on success', function () {
  resetStore();
  assert.strictEqual(TradeStorage.clear(), true);
});

// === fingerprint ===
console.log('\n--- Fingerprint Tests ---\n');

test('fingerprint generates consistent key for same trade', function () {
  var fp1 = TradeStorage.fingerprint(sampleTrades[0]);
  var fp2 = TradeStorage.fingerprint(sampleTrades[0]);
  assert.strictEqual(fp1, fp2);
});

test('fingerprint differs for different trades', function () {
  var fp1 = TradeStorage.fingerprint(sampleTrades[0]);
  var fp2 = TradeStorage.fingerprint(sampleTrades[1]);
  assert.notStrictEqual(fp1, fp2);
});

test('fingerprint includes all key fields', function () {
  var fp = TradeStorage.fingerprint(sampleTrades[0]);
  assert.ok(fp.indexOf('NQH6') !== -1);
  assert.ok(fp.indexOf('100') !== -1);
  assert.ok(fp.indexOf('21000') !== -1);
  assert.ok(fp.indexOf('21005') !== -1);
});

test('fingerprint works with ISO string timestamps', function () {
  var trade = {
    symbol: 'NQH6', qty: 1, buyPrice: 21000, sellPrice: 21005, pnl: 100,
    boughtTimestamp: '2026-02-11T09:30:00.000Z',
    soldTimestamp: '2026-02-11T10:06:08.000Z'
  };
  var fp = TradeStorage.fingerprint(trade);
  assert.ok(fp.length > 0);
});

test('fingerprint distinguishes trades with different qty', function () {
  var trade1 = { symbol: 'NQH6', qty: 1, buyPrice: 21000, sellPrice: 21005, pnl: 100,
    boughtTimestamp: new Date('2026-02-11T09:30:00Z'), soldTimestamp: new Date('2026-02-11T10:06:08Z') };
  var trade2 = { symbol: 'NQH6', qty: 2, buyPrice: 21000, sellPrice: 21005, pnl: 100,
    boughtTimestamp: new Date('2026-02-11T09:30:00Z'), soldTimestamp: new Date('2026-02-11T10:06:08Z') };
  assert.notStrictEqual(TradeStorage.fingerprint(trade1), TradeStorage.fingerprint(trade2));
});

// === merge ===
console.log('\n--- Merge Tests ---\n');

test('merge combines two disjoint trade arrays', function () {
  var result = TradeStorage.merge(sampleTrades, additionalTrades);
  assert.strictEqual(result.merged.length, 4);
  assert.strictEqual(result.added, 2);
  assert.strictEqual(result.skipped, 0);
});

test('merge skips duplicate trades', function () {
  var result = TradeStorage.merge(sampleTrades, sampleTrades);
  assert.strictEqual(result.merged.length, 2);
  assert.strictEqual(result.added, 0);
  assert.strictEqual(result.skipped, 2);
});

test('merge handles partial overlap', function () {
  var mixed = [sampleTrades[0], additionalTrades[0]];
  var result = TradeStorage.merge(sampleTrades, mixed);
  // sampleTrades[0] is duplicate, additionalTrades[0] is new
  assert.strictEqual(result.merged.length, 3);
  assert.strictEqual(result.added, 1);
  assert.strictEqual(result.skipped, 1);
});

test('merge reassigns IDs sequentially', function () {
  var result = TradeStorage.merge(sampleTrades, additionalTrades);
  for (var i = 0; i < result.merged.length; i++) {
    assert.strictEqual(result.merged[i].id, i + 1);
  }
});

test('merge sorts by soldTimestamp', function () {
  // additionalTrades are on 2/12, sampleTrades are on 2/11
  var result = TradeStorage.merge(additionalTrades, sampleTrades);
  // After merge, sampleTrades (2/11) should come before additionalTrades (2/12)
  assert.strictEqual(result.merged[0].symbol, 'NQH6');
  assert.strictEqual(result.merged[result.merged.length - 1].tradeDate, '2026-02-12');
});

test('merge with empty existing array returns newTrades', function () {
  var result = TradeStorage.merge([], sampleTrades);
  assert.strictEqual(result.merged.length, 2);
  assert.strictEqual(result.added, 2);
  assert.strictEqual(result.skipped, 0);
});

test('merge with empty new array returns existing', function () {
  var result = TradeStorage.merge(sampleTrades, []);
  assert.strictEqual(result.merged.length, 2);
  assert.strictEqual(result.added, 0);
  assert.strictEqual(result.skipped, 0);
});

test('merge does not modify original arrays', function () {
  var origLen = sampleTrades.length;
  var origId = sampleTrades[0].id;
  TradeStorage.merge(sampleTrades, additionalTrades);
  assert.strictEqual(sampleTrades.length, origLen);
  assert.strictEqual(sampleTrades[0].id, origId);
});

// === round-trip with merge ===
console.log('\n--- Round-trip & Integration Tests ---\n');

test('save then load preserves data integrity', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: ['roundtrip.csv'] });
  var loaded = TradeStorage.load();
  assert.strictEqual(loaded.trades.length, sampleTrades.length);
  for (var i = 0; i < sampleTrades.length; i++) {
    assert.strictEqual(loaded.trades[i].pnl, sampleTrades[i].pnl);
    assert.strictEqual(loaded.trades[i].symbol, sampleTrades[i].symbol);
  }
});

test('empty trades array saves and loads correctly', function () {
  resetStore();
  TradeStorage.save({ trades: [], fileNames: ['empty.csv'] });
  var loaded = TradeStorage.load();
  assert.ok(loaded);
  assert.strictEqual(loaded.trades.length, 0);
});

test('save, load, merge, save again - full workflow', function () {
  resetStore();
  // Save initial data
  TradeStorage.save({ trades: sampleTrades, fileNames: ['day1.csv'] });
  // Load and merge with new data
  var loaded = TradeStorage.load();
  var result = TradeStorage.merge(loaded.trades, additionalTrades);
  assert.strictEqual(result.merged.length, 4);
  // Save merged data
  var fileNames = loaded.fileNames.slice();
  fileNames.push('day2.csv');
  TradeStorage.save({ trades: result.merged, fileNames: fileNames });
  // Load again and verify
  var loaded2 = TradeStorage.load();
  assert.strictEqual(loaded2.trades.length, 4);
  assert.deepStrictEqual(loaded2.fileNames, ['day1.csv', 'day2.csv']);
});

test('re-uploading same file adds no duplicates', function () {
  resetStore();
  TradeStorage.save({ trades: sampleTrades, fileNames: ['trades.csv'] });
  var loaded = TradeStorage.load();
  var result = TradeStorage.merge(loaded.trades, sampleTrades);
  assert.strictEqual(result.merged.length, 2);
  assert.strictEqual(result.added, 0);
  assert.strictEqual(result.skipped, 2);
});

// === Summary ===
console.log('\n' + passed + ' passed, ' + failed + ' failed\n');
if (failed > 0) process.exit(1);
