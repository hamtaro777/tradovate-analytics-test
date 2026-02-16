/**
 * Local Storage Module
 * トレードデータをブラウザのlocalStorageに保存・読み込みする
 * マージ・重複防止機能付き
 */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'tradovate_analytics_data';
  var STORAGE_VERSION = 2;

  /**
   * トレードのフィンガープリントを生成（重複判定用）
   * symbol + soldTimestamp + pnl + buyPrice + sellPrice の組み合わせで一意性を判定
   * @param {Object} trade
   * @returns {string}
   */
  function tradeFingerprint(trade) {
    var sold = trade.soldTimestamp instanceof Date
      ? trade.soldTimestamp.toISOString()
      : String(trade.soldTimestamp || '');
    var bought = trade.boughtTimestamp instanceof Date
      ? trade.boughtTimestamp.toISOString()
      : String(trade.boughtTimestamp || '');
    return [
      trade.symbol || '',
      bought,
      sold,
      String(trade.pnl || 0),
      String(trade.buyPrice || 0),
      String(trade.sellPrice || 0),
      String(trade.qty || 1)
    ].join('|');
  }

  /**
   * 既存トレードに新規トレードをマージ（重複を除外）
   * @param {Array} existing - 既存のトレード配列
   * @param {Array} newTrades - 新しいトレード配列
   * @returns {{ merged: Array, added: number, skipped: number }}
   */
  function mergeTrades(existing, newTrades) {
    var fingerprints = {};
    for (var i = 0; i < existing.length; i++) {
      fingerprints[tradeFingerprint(existing[i])] = true;
    }

    var merged = existing.slice();
    var added = 0;
    var skipped = 0;

    for (var j = 0; j < newTrades.length; j++) {
      var fp = tradeFingerprint(newTrades[j]);
      if (fingerprints[fp]) {
        skipped++;
      } else {
        fingerprints[fp] = true;
        merged.push(newTrades[j]);
        added++;
      }
    }

    // soldTimestamp で時系列ソート
    merged.sort(function (a, b) {
      var tA = a.soldTimestamp instanceof Date ? a.soldTimestamp.getTime() : new Date(a.soldTimestamp).getTime();
      var tB = b.soldTimestamp instanceof Date ? b.soldTimestamp.getTime() : new Date(b.soldTimestamp).getTime();
      return tA - tB;
    });

    // IDを振り直し
    for (var k = 0; k < merged.length; k++) {
      merged[k].id = k + 1;
    }

    return { merged: merged, added: added, skipped: skipped };
  }

  /**
   * トレードを直列化して保存用オブジェクトに変換
   * @param {Object} trade
   * @returns {Object}
   */
  function serializeTrade(t) {
    return {
      id: t.id,
      symbol: t.symbol,
      qty: t.qty,
      buyPrice: t.buyPrice,
      sellPrice: t.sellPrice,
      pnl: t.pnl,
      commission: t.commission,
      boughtTimestamp: t.boughtTimestamp instanceof Date ? t.boughtTimestamp.toISOString() : t.boughtTimestamp,
      soldTimestamp: t.soldTimestamp instanceof Date ? t.soldTimestamp.toISOString() : t.soldTimestamp,
      duration: t.duration,
      direction: t.direction,
      productDescription: t.productDescription,
      tradeDate: t.tradeDate,
      dayOfWeek: t.dayOfWeek
    };
  }

  /**
   * 保存用オブジェクトからトレードオブジェクトを復元
   * @param {Object} t
   * @returns {Object}
   */
  function deserializeTrade(t) {
    return {
      id: t.id,
      symbol: t.symbol,
      qty: t.qty,
      buyPrice: t.buyPrice,
      sellPrice: t.sellPrice,
      pnl: t.pnl,
      commission: t.commission,
      boughtTimestamp: new Date(t.boughtTimestamp),
      soldTimestamp: new Date(t.soldTimestamp),
      duration: t.duration,
      direction: t.direction,
      productDescription: t.productDescription,
      tradeDate: t.tradeDate,
      dayOfWeek: t.dayOfWeek
    };
  }

  /**
   * トレードデータをlocalStorageに保存
   * @param {Object} data - 保存するデータ
   * @param {Array} data.trades - トレード配列
   * @param {string|string[]} data.fileNames - CSVファイル名（配列または単一文字列）
   * @returns {boolean} 保存成功フラグ
   */
  function saveTradeData(data) {
    try {
      var fileNames = data.fileNames || [];
      if (typeof fileNames === 'string') {
        fileNames = [fileNames];
      }

      var serialized = {
        version: STORAGE_VERSION,
        savedAt: new Date().toISOString(),
        fileNames: fileNames,
        trades: data.trades.map(serializeTrade)
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
      return true;
    } catch (e) {
      if (e.name === 'QuotaExceededError' || e.code === 22) {
        console.warn('localStorage quota exceeded. Data not saved.');
      } else {
        console.error('Failed to save trade data:', e);
      }
      return false;
    }
  }

  /**
   * localStorageからトレードデータを読み込み
   * @returns {Object|null} { trades: Array, fileNames: string[], savedAt: string } or null
   */
  function loadTradeData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      var parsed = JSON.parse(raw);

      if (!parsed || !Array.isArray(parsed.trades)) {
        return null;
      }

      // v1 → v2 マイグレーション
      var fileNames;
      if (parsed.version === 1) {
        fileNames = parsed.fileName ? [parsed.fileName] : [];
      } else if (parsed.version === STORAGE_VERSION) {
        fileNames = parsed.fileNames || [];
      } else {
        return null;
      }

      var trades = parsed.trades.map(deserializeTrade);

      return {
        trades: trades,
        fileNames: fileNames,
        savedAt: parsed.savedAt
      };
    } catch (e) {
      console.error('Failed to load trade data:', e);
      return null;
    }
  }

  /**
   * 保存済みデータを削除
   * @returns {boolean}
   */
  function clearTradeData() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      return true;
    } catch (e) {
      console.error('Failed to clear trade data:', e);
      return false;
    }
  }

  /**
   * 保存済みデータが存在するかチェック
   * @returns {boolean}
   */
  function hasSavedData() {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch (e) {
      return false;
    }
  }

  var TradeStorage = {
    save: saveTradeData,
    load: loadTradeData,
    clear: clearTradeData,
    hasSaved: hasSavedData,
    merge: mergeTrades,
    fingerprint: tradeFingerprint,
    _STORAGE_KEY: STORAGE_KEY
  };

  root.TradeStorage = TradeStorage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TradeStorage;
  }
})(typeof window !== 'undefined' ? window : global);
