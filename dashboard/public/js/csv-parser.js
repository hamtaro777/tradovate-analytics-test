/**
 * Tradovate CSV Parser
 * CSVファイルを解析し、トレードデータに正規化する
 */
(function (root) {
  'use strict';

  /** 必須カラム定義 */
  var REQUIRED_COLUMNS = {
    symbol: ['symbol', 'Symbol', 'Contract', 'contract', 'Product'],
    buyPrice: ['buyPrice', 'Buy Price', 'Entry Price', 'entryPrice', 'avgPrice'],
    sellPrice: ['sellPrice', 'Sell Price', 'Exit Price', 'exitPrice'],
    pnl: ['pnl', 'P&L', 'PnL', 'Profit/Loss', 'Net P&L'],
    qty: ['qty', 'Qty', 'Quantity', 'quantity', 'filledQty'],
    boughtTimestamp: ['boughtTimestamp', 'Bought Timestamp', 'Buy Time', 'Entry Time', 'Fill Time'],
    soldTimestamp: ['soldTimestamp', 'Sold Timestamp', 'Sell Time', 'Exit Time'],
    duration: ['duration', 'Duration']
  };

  /** オプションカラム */
  var OPTIONAL_COLUMNS = {
    commission: ['commission', 'Commission', 'Fee', 'fee'],
    direction: ['B/S', 'direction', 'Direction', 'Side', 'side', '_action'],
    productDescription: ['Product Description', 'productDescription']
  };

  /**
   * CSV文字列をパースして行の配列にする
   * @param {string} csvText - CSV文字列
   * @returns {{ headers: string[], rows: string[][] }}
   */
  function parseCSVText(csvText) {
    var lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    var headers = parseCSVLine(lines[0]);
    var rows = [];
    for (var i = 1; i < lines.length; i++) {
      var line = lines[i].trim();
      if (line === '') continue;
      rows.push(parseCSVLine(line));
    }
    return { headers: headers, rows: rows };
  }

  /**
   * CSV行をフィールドに分割（ダブルクォート対応）
   * @param {string} line
   * @returns {string[]}
   */
  function parseCSVLine(line) {
    var fields = [];
    var current = '';
    var inQuotes = false;
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (i + 1 < line.length && line[i + 1] === '"') {
            current += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          fields.push(current.trim());
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current.trim());
    return fields;
  }

  /**
   * ヘッダーから自動的にカラムマッピングを検出
   * @param {string[]} headers - CSVヘッダー
   * @returns {{ mapping: Object, missing: string[] }}
   */
  function autoDetectMapping(headers) {
    var mapping = {};
    var missing = [];

    function findColumn(aliases) {
      for (var i = 0; i < aliases.length; i++) {
        var idx = headers.indexOf(aliases[i]);
        if (idx !== -1) return aliases[i];
      }
      return null;
    }

    // 必須カラム
    var keys = Object.keys(REQUIRED_COLUMNS);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      var found = findColumn(REQUIRED_COLUMNS[key]);
      if (found) {
        mapping[key] = found;
      } else {
        missing.push(key);
      }
    }

    // オプションカラム
    var optKeys = Object.keys(OPTIONAL_COLUMNS);
    for (var j = 0; j < optKeys.length; j++) {
      var optKey = optKeys[j];
      var optFound = findColumn(OPTIONAL_COLUMNS[optKey]);
      if (optFound) {
        mapping[optKey] = optFound;
      }
    }

    return { mapping: mapping, missing: missing };
  }

  /**
   * P/L文字列を数値に変換
   * "$100.00" -> 100, "$(15.00)" -> -15, "-15.00" -> -15
   * @param {string} pnlStr
   * @returns {number}
   */
  function parsePnL(pnlStr) {
    if (typeof pnlStr === 'number') return pnlStr;
    var str = String(pnlStr).trim();
    if (str === '' || str === '-') return 0;

    var isNegative = false;
    // $(xx.xx) パターン
    if (str.indexOf('(') !== -1 && str.indexOf(')') !== -1) {
      isNegative = true;
      str = str.replace(/[()]/g, '');
    }
    // マイナス記号
    if (str.charAt(0) === '-') {
      isNegative = true;
      str = str.substring(1);
    }
    // $ と , を除去
    str = str.replace(/[$,]/g, '');
    var val = parseFloat(str);
    if (isNaN(val)) return 0;
    return isNegative ? -val : val;
  }

  /**
   * タイムスタンプ文字列をDateに変換
   * @param {string} ts
   * @returns {Date}
   */
  function parseTimestamp(ts) {
    if (!ts) return new Date(0);
    var str = String(ts).trim();
    // ISO format: 2026-02-11T06:34:46.772Z
    if (str.indexOf('T') !== -1) return new Date(str);
    // MM/DD/YYYY HH:mm:ss format
    var parts = str.split(' ');
    if (parts.length >= 2) {
      var dateParts = parts[0].split('/');
      if (dateParts.length === 3) {
        var month = parseInt(dateParts[0], 10);
        var day = parseInt(dateParts[1], 10);
        var year = parseInt(dateParts[2], 10);
        if (year < 100) year += 2000;
        var timeParts = parts[1].split(':');
        var hours = parseInt(timeParts[0], 10) || 0;
        var minutes = parseInt(timeParts[1], 10) || 0;
        var seconds = parseInt(timeParts[2], 10) || 0;
        return new Date(year, month - 1, day, hours, minutes, seconds);
      }
    }
    return new Date(str);
  }

  /**
   * CSVデータをトレードオブジェクトの配列に変換
   * @param {{ headers: string[], rows: string[][] }} parsed
   * @param {Object} mapping - カラムマッピング
   * @returns {Object[]}
   */
  function normalizeToTrades(parsed, mapping) {
    var trades = [];
    for (var i = 0; i < parsed.rows.length; i++) {
      var row = parsed.rows[i];
      var rowObj = {};
      for (var j = 0; j < parsed.headers.length; j++) {
        rowObj[parsed.headers[j]] = row[j] || '';
      }

      var trade = {
        id: i + 1,
        symbol: rowObj[mapping.symbol] || '',
        qty: parseInt(rowObj[mapping.qty], 10) || 1,
        buyPrice: parseFloat(rowObj[mapping.buyPrice]) || 0,
        sellPrice: parseFloat(rowObj[mapping.sellPrice]) || 0,
        pnl: parsePnL(rowObj[mapping.pnl]),
        boughtTimestamp: parseTimestamp(rowObj[mapping.boughtTimestamp]),
        soldTimestamp: parseTimestamp(rowObj[mapping.soldTimestamp]),
        duration: rowObj[mapping.duration] || '',
        commission: mapping.commission ? parseFloat(rowObj[mapping.commission]) || 0 : 0,
        direction: mapping.direction ? rowObj[mapping.direction] : '',
        productDescription: mapping.productDescription ? rowObj[mapping.productDescription] : '',
        rawRow: rowObj
      };

      // トレード日（約定日ベース）
      var tradeDate = trade.soldTimestamp.getTime() > 0 ? trade.soldTimestamp : trade.boughtTimestamp;
      trade.tradeDate = formatDate(tradeDate);
      trade.dayOfWeek = getDayOfWeek(tradeDate);

      trades.push(trade);
    }
    return trades;
  }

  /**
   * 日付をYYYY-MM-DD形式にフォーマット
   * @param {Date} date
   * @returns {string}
   */
  function formatDate(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, '0');
    var d = String(date.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }

  /**
   * 曜日を取得（日本語）
   * @param {Date} date
   * @returns {string}
   */
  function getDayOfWeek(date) {
    var days = ['日', '月', '火', '水', '木', '金', '土'];
    return days[date.getDay()];
  }

  // Export
  var CSVParser = {
    parseCSVText: parseCSVText,
    parseCSVLine: parseCSVLine,
    autoDetectMapping: autoDetectMapping,
    normalizeToTrades: normalizeToTrades,
    parsePnL: parsePnL,
    parseTimestamp: parseTimestamp,
    formatDate: formatDate,
    getDayOfWeek: getDayOfWeek,
    REQUIRED_COLUMNS: REQUIRED_COLUMNS,
    OPTIONAL_COLUMNS: OPTIONAL_COLUMNS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CSVParser;
  } else {
    root.CSVParser = CSVParser;
  }
})(typeof window !== 'undefined' ? window : global);
