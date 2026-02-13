/**
 * Tradovate CSV Parser
 * CSVファイルを解析し、トレードデータに正規化する
 * Performance CSV / Orders CSV 両対応
 */
(function (root) {
  'use strict';

  /** 必須カラム定義（Performance CSV用） */
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

  /** Orders CSV 判定用の必須カラム */
  var ORDERS_REQUIRED_HEADERS = ['B/S', 'Status', 'avgPrice', 'Fill Time'];

  /** 先物商品の1ポイントあたり金額（フォールバック用） */
  var CONTRACT_MULTIPLIERS = {
    ES: 50, MES: 5,
    NQ: 20, MNQ: 2,
    YM: 5, MYM: 0.5,
    RTY: 50, M2K: 5,
    CL: 1000, MCL: 100,
    GC: 100, MGC: 10,
    SI: 5000, SIL: 1000,
    HG: 25000, MHG: 2500,
    ZB: 1000, ZN: 1000, ZF: 1000,
    NKD: 5, '6E': 125000, '6J': 12500000
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

  /**
   * CSVタイプを判定する
   * @param {string[]} headers - CSVヘッダー
   * @returns {'orders'|'performance'|'unknown'}
   */
  function detectCSVType(headers) {
    var trimmed = [];
    for (var i = 0; i < headers.length; i++) {
      trimmed.push(headers[i].trim());
    }

    // Orders CSVは B/S, Status, avgPrice, Fill Time を持つ
    var hasAll = true;
    for (var j = 0; j < ORDERS_REQUIRED_HEADERS.length; j++) {
      if (trimmed.indexOf(ORDERS_REQUIRED_HEADERS[j]) === -1) {
        hasAll = false;
        break;
      }
    }
    if (hasAll) return 'orders';

    // Performance CSVは pnl, buyPrice, sellPrice を持つ
    var perfDetect = autoDetectMapping(headers);
    if (perfDetect.missing.length === 0) return 'performance';

    return 'unknown';
  }

  /**
   * Orders CSVからFIFOマッチングでトレードデータを生成
   * @param {{ headers: string[], rows: string[][] }} parsed
   * @returns {Object[]} トレード配列
   */
  function normalizeOrdersToTrades(parsed) {
    var headers = parsed.headers;
    // ヘッダーインデックスマップ（trimして照合）
    var colIdx = {};
    for (var i = 0; i < headers.length; i++) {
      colIdx[headers[i].trim()] = i;
    }

    // Filledの注文のみ抽出
    var filledOrders = [];
    for (var r = 0; r < parsed.rows.length; r++) {
      var row = parsed.rows[r];
      var status = (row[colIdx['Status']] || '').trim();
      if (status !== 'Filled') continue;

      var direction = (row[colIdx['B/S']] || '').trim();
      if (direction !== 'Buy' && direction !== 'Sell') continue;

      var product = (row[colIdx['Product']] || '').trim();
      var contract = (row[colIdx['Contract']] || '').trim();
      var avgPrice = parseFloat(row[colIdx['avgPrice']] || row[colIdx['Avg Fill Price']] || '0') || 0;
      var qty = parseInt(row[colIdx['filledQty']] || row[colIdx['Filled Qty']] || '1', 10) || 1;
      var fillTime = parseTimestamp(row[colIdx['Fill Time']] || '');
      var orderId = (row[colIdx['orderId']] || row[colIdx['Order ID']] || '').trim();
      var notionalStr = row[colIdx['Notional Value']] || '';
      var notional = parsePnL(notionalStr);
      var productDesc = (row[colIdx['Product Description']] || '').trim();

      filledOrders.push({
        direction: direction,
        product: product,
        contract: contract,
        avgPrice: avgPrice,
        qty: qty,
        fillTime: fillTime,
        orderId: orderId,
        notional: notional,
        productDescription: productDesc
      });
    }

    // Fill Time昇順、同時刻はorderId昇順でソート
    filledOrders.sort(function (a, b) {
      var timeDiff = a.fillTime.getTime() - b.fillTime.getTime();
      if (timeDiff !== 0) return timeDiff;
      if (a.orderId < b.orderId) return -1;
      if (a.orderId > b.orderId) return 1;
      return 0;
    });

    // 商品ごとの乗数を Notional Value / avgPrice から推定
    var multipliers = {};
    for (var m = 0; m < filledOrders.length; m++) {
      var fo = filledOrders[m];
      if (!multipliers[fo.product] && fo.notional > 0 && fo.avgPrice > 0) {
        multipliers[fo.product] = Math.round(fo.notional / fo.avgPrice);
      }
    }

    // 商品ごとにFIFOマッチング
    var positions = {}; // product -> { direction: 'Buy'|'Sell', queue: [{price, fillTime, orderId}] }
    var trades = [];
    var tradeId = 0;

    for (var k = 0; k < filledOrders.length; k++) {
      var order = filledOrders[k];
      var prod = order.product;
      var mult = multipliers[prod] || CONTRACT_MULTIPLIERS[prod] || 1;

      if (!positions[prod]) {
        positions[prod] = { direction: order.direction, queue: [] };
      }
      var pos = positions[prod];

      if (pos.queue.length === 0 || pos.direction === order.direction) {
        // 同方向 → ポジション積み増し
        pos.direction = order.direction;
        for (var q = 0; q < order.qty; q++) {
          pos.queue.push({
            price: order.avgPrice,
            fillTime: order.fillTime,
            orderId: order.orderId
          });
        }
      } else {
        // 反対方向 → FIFOでマッチング
        var remaining = order.qty;
        while (remaining > 0 && pos.queue.length > 0) {
          var entry = pos.queue.shift();

          var buyPrice, sellPrice, buyTime, sellTime, tradeDirection;
          if (pos.direction === 'Buy') {
            buyPrice = entry.price;
            sellPrice = order.avgPrice;
            buyTime = entry.fillTime;
            sellTime = order.fillTime;
            tradeDirection = 'Long';
          } else {
            buyPrice = order.avgPrice;
            sellPrice = entry.price;
            buyTime = order.fillTime;
            sellTime = entry.fillTime;
            tradeDirection = 'Short';
          }

          var pnl = (sellPrice - buyPrice) * mult;
          var exitTime = sellTime.getTime() > buyTime.getTime() ? sellTime : buyTime;

          tradeId++;
          trades.push({
            id: tradeId,
            symbol: order.contract || prod,
            qty: 1,
            buyPrice: buyPrice,
            sellPrice: sellPrice,
            pnl: Math.round(pnl * 100) / 100,
            boughtTimestamp: buyTime,
            soldTimestamp: sellTime,
            duration: calculateDuration(buyTime, sellTime),
            commission: 0,
            direction: tradeDirection,
            productDescription: order.productDescription,
            tradeDate: formatDate(exitTime),
            dayOfWeek: getDayOfWeek(exitTime),
            rawRow: {}
          });

          remaining--;
        }

        // 残りがあれば新規ポジション（ドテン）
        if (remaining > 0) {
          pos.direction = order.direction;
          for (var rq = 0; rq < remaining; rq++) {
            pos.queue.push({
              price: order.avgPrice,
              fillTime: order.fillTime,
              orderId: order.orderId
            });
          }
        }
      }
    }

    return trades;
  }

  /**
   * 2つのタイムスタンプからduration文字列を算出
   * @param {Date} startTime
   * @param {Date} endTime
   * @returns {string} "1hr 23min 45sec" 形式
   */
  function calculateDuration(startTime, endTime) {
    var diffMs = Math.abs(endTime.getTime() - startTime.getTime());
    var totalSec = Math.floor(diffMs / 1000);
    var hours = Math.floor(totalSec / 3600);
    var minutes = Math.floor((totalSec % 3600) / 60);
    var seconds = totalSec % 60;

    var parts = [];
    if (hours > 0) parts.push(hours + 'hr');
    if (minutes > 0) parts.push(minutes + 'min');
    if (seconds > 0 || parts.length === 0) parts.push(seconds + 'sec');
    return parts.join(' ');
  }

  // Export
  var CSVParser = {
    parseCSVText: parseCSVText,
    parseCSVLine: parseCSVLine,
    autoDetectMapping: autoDetectMapping,
    normalizeToTrades: normalizeToTrades,
    detectCSVType: detectCSVType,
    normalizeOrdersToTrades: normalizeOrdersToTrades,
    calculateDuration: calculateDuration,
    parsePnL: parsePnL,
    parseTimestamp: parseTimestamp,
    formatDate: formatDate,
    getDayOfWeek: getDayOfWeek,
    REQUIRED_COLUMNS: REQUIRED_COLUMNS,
    OPTIONAL_COLUMNS: OPTIONAL_COLUMNS,
    CONTRACT_MULTIPLIERS: CONTRACT_MULTIPLIERS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CSVParser;
  } else {
    root.CSVParser = CSVParser;
  }
})(typeof window !== 'undefined' ? window : global);
