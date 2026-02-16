/**
 * Local Storage Module
 * トレードデータをブラウザのlocalStorageに保存・読み込みする
 */
(function (root) {
  'use strict';

  var STORAGE_KEY = 'tradovate_analytics_data';
  var STORAGE_VERSION = 1;

  /**
   * トレードデータをlocalStorageに保存
   * @param {Object} data - 保存するデータ
   * @param {Array} data.trades - トレード配列
   * @param {string} data.fileName - CSVファイル名
   * @returns {boolean} 保存成功フラグ
   */
  function saveTradeData(data) {
    try {
      var serialized = {
        version: STORAGE_VERSION,
        savedAt: new Date().toISOString(),
        fileName: data.fileName || '',
        trades: data.trades.map(function (t) {
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
        })
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
   * @returns {Object|null} { trades: Array, fileName: string, savedAt: string } or null
   */
  function loadTradeData() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;

      var parsed = JSON.parse(raw);

      if (!parsed || parsed.version !== STORAGE_VERSION || !Array.isArray(parsed.trades)) {
        return null;
      }

      var trades = parsed.trades.map(function (t) {
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
      });

      return {
        trades: trades,
        fileName: parsed.fileName,
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
    _STORAGE_KEY: STORAGE_KEY
  };

  root.TradeStorage = TradeStorage;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TradeStorage;
  }
})(typeof window !== 'undefined' ? window : global);
