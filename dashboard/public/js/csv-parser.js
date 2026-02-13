/**
 * Tradovate CSV Parser
 * CSVファイルを解析し、トレードデータに正規化する
 * Fills CSVからのFIFOマッチングによるトレード成形に対応
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

  /**
   * 先物商品のポイント単価（1ポイントあたりのドル価値）
   * Product列の値をキーとする
   */
  var PRODUCT_MULTIPLIERS = {
    'NQ': 20,       // E-mini NASDAQ 100
    'ES': 50,       // E-mini S&P 500
    'YM': 5,        // E-mini Dow
    'RTY': 50,      // E-mini Russell 2000
    'MES': 5,       // Micro E-mini S&P 500
    'MNQ': 2,       // Micro E-mini NASDAQ 100
    'MYM': 0.50,    // Micro E-mini Dow
    'M2K': 5,       // Micro E-mini Russell 2000
    'GC': 100,      // Gold
    'MGC': 10,      // Micro Gold
    'SI': 5000,     // Silver
    'SIL': 1000,    // Micro Silver (1000 oz)
    'CL': 1000,     // Crude Oil
    'MCL': 100,     // Micro Crude Oil
    'ZB': 1000,     // 30-Year Treasury Bond
    'ZN': 1000,     // 10-Year Treasury Note
    'ZF': 1000,     // 5-Year Treasury Note
    '6E': 125000,   // Euro FX
    '6J': 12500000, // Japanese Yen
    '6B': 62500     // British Pound
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
   * CSVフォーマットを自動検出
   * @param {string[]} headers - CSVヘッダー
   * @returns {string} 'fills' | 'performance' | 'unknown'
   */
  function detectCSVFormat(headers) {
    // Fills CSV: Fill ID, B/S, commission が存在
    var hasFillId = headers.indexOf('Fill ID') !== -1 || headers.indexOf('_id') !== -1;
    var hasBS = headers.indexOf('B/S') !== -1 || headers.indexOf('_action') !== -1;
    var hasCommission = headers.indexOf('commission') !== -1;
    var hasContract = headers.indexOf('Contract') !== -1;

    if (hasFillId && hasBS && hasCommission && hasContract) {
      return 'fills';
    }

    // Performance CSV: buyPrice, sellPrice, pnl が存在
    var hasBuyPrice = headers.indexOf('buyPrice') !== -1;
    var hasSellPrice = headers.indexOf('sellPrice') !== -1;
    var hasPnL = headers.indexOf('pnl') !== -1;
    if (hasBuyPrice && hasSellPrice && hasPnL) {
      return 'performance';
    }

    return 'unknown';
  }

  /**
   * Fills CSVデータをFIFOマッチングでトレードオブジェクトの配列に変換
   * @param {{ headers: string[], rows: string[][] }} parsed - パース済みCSVデータ
   * @returns {Object[]} トレード配列
   */
  function normalizeFillsToTrades(parsed) {
    // 行をオブジェクトに変換
    var fills = [];
    for (var i = 0; i < parsed.rows.length; i++) {
      var row = parsed.rows[i];
      var obj = {};
      for (var j = 0; j < parsed.headers.length; j++) {
        obj[parsed.headers[j]] = row[j] || '';
      }
      fills.push(obj);
    }

    // contractIdでグループ化
    var groups = {};
    for (var k = 0; k < fills.length; k++) {
      var fill = fills[k];
      var contractId = fill['_contractId'] || fill['Contract'];
      if (!groups[contractId]) {
        groups[contractId] = [];
      }
      groups[contractId].push(fill);
    }

    var trades = [];
    var tradeId = 1;

    var contractIds = Object.keys(groups);
    for (var ci = 0; ci < contractIds.length; ci++) {
      var contractFills = groups[contractIds[ci]];

      // タイムスタンプ順にソート
      contractFills.sort(function (a, b) {
        var tsA = a['_timestamp'] || a['Timestamp'] || '';
        var tsB = b['_timestamp'] || b['Timestamp'] || '';
        if (tsA < tsB) return -1;
        if (tsA > tsB) return 1;
        // 同一タイムスタンプの場合は_idでソート
        var idA = a['_id'] || a['Fill ID'] || '';
        var idB = b['_id'] || b['Fill ID'] || '';
        if (idA < idB) return -1;
        if (idA > idB) return 1;
        return 0;
      });

      // FIFOマッチング
      var buyQueue = [];
      var sellQueue = [];

      for (var fi = 0; fi < contractFills.length; fi++) {
        var f = contractFills[fi];
        var direction = detectDirection(f);
        var qty = parseInt(f['_qty'] || f['Quantity'], 10) || 1;
        var price = parseFloat(f['_price'] || f['Price']) || 0;
        var timestamp = parseTimestamp(f['_timestamp'] || f['Timestamp']);
        var commission = parseFloat(f['commission']) || 0;
        var symbol = f['Contract'] || '';
        var product = f['Product'] || '';
        var productDesc = f['Product Description'] || '';
        var tickSize = parseFloat(f['_tickSize']) || 0.25;

        // 数量分だけ個別のFillとして処理
        for (var q = 0; q < qty; q++) {
          var fillEntry = {
            direction: direction,
            price: price,
            timestamp: timestamp,
            commission: commission / qty, // 数量で按分
            symbol: symbol,
            product: product,
            productDescription: productDesc,
            tickSize: tickSize,
            rawRow: f
          };

          if (direction === 'Buy') {
            // 売りキューがあればマッチ（ショートポジションのクローズ）
            if (sellQueue.length > 0) {
              var matchedSell = sellQueue.shift();
              // Buy=fillEntry, Sell=matchedSell
              var trade = createTradeFromMatch(fillEntry, matchedSell, tradeId, product, tickSize);
              trades.push(trade);
              tradeId++;
            } else {
              buyQueue.push(fillEntry);
            }
          } else {
            // 買いキューがあればマッチ（ロングポジションのクローズ）
            if (buyQueue.length > 0) {
              var matchedBuy = buyQueue.shift();
              // Buy=matchedBuy, Sell=fillEntry
              var trade2 = createTradeFromMatch(matchedBuy, fillEntry, tradeId, product, tickSize);
              trades.push(trade2);
              tradeId++;
            } else {
              sellQueue.push(fillEntry);
            }
          }
        }
      }
    }

    // 約定時刻（soldTimestamp）でソート
    trades.sort(function (a, b) {
      return a.soldTimestamp.getTime() - b.soldTimestamp.getTime();
    });

    // IDを振り直し
    for (var ti = 0; ti < trades.length; ti++) {
      trades[ti].id = ti + 1;
    }

    return trades;
  }

  /**
   * Fill行から売買方向を検出
   * @param {Object} fill - Fill行オブジェクト
   * @returns {string} 'Buy' | 'Sell'
   */
  function detectDirection(fill) {
    var bs = (fill['B/S'] || '').trim();
    if (bs === 'Buy') return 'Buy';
    if (bs === 'Sell') return 'Sell';

    var action = fill['_action'];
    if (action === '0') return 'Buy';
    if (action === '1') return 'Sell';

    return 'Buy';
  }

  /**
   * マッチしたBuyとSellからトレードオブジェクトを生成
   * @param {Object} buyFill - 買いFill
   * @param {Object} sellFill - 売りFill
   * @param {number} id - トレードID
   * @param {string} product - 商品コード
   * @param {number} tickSize - ティックサイズ
   * @returns {Object} トレードオブジェクト
   */
  function createTradeFromMatch(buyFill, sellFill, id, product, tickSize) {
    var multiplier = PRODUCT_MULTIPLIERS[product] || 1;
    var priceDiff = sellFill.price - buyFill.price;
    var pnl = priceDiff * multiplier;

    // 浮動小数点の丸め（小数点2桁）
    pnl = Math.round(pnl * 100) / 100;

    var commission = buyFill.commission + sellFill.commission;
    commission = Math.round(commission * 100) / 100;

    var boughtTs = buyFill.timestamp;
    var soldTs = sellFill.timestamp;
    var duration = calculateDuration(boughtTs, soldTs);

    var tradeDate = soldTs.getTime() > 0 ? soldTs : boughtTs;

    return {
      id: id,
      symbol: buyFill.symbol,
      qty: 1,
      buyPrice: buyFill.price,
      sellPrice: sellFill.price,
      pnl: pnl,
      boughtTimestamp: boughtTs,
      soldTimestamp: soldTs,
      duration: duration,
      commission: commission,
      direction: buyFill.timestamp <= sellFill.timestamp ? 'Long' : 'Short',
      productDescription: buyFill.productDescription || sellFill.productDescription,
      tradeDate: formatDate(tradeDate),
      dayOfWeek: getDayOfWeek(tradeDate),
      rawRow: { buy: buyFill.rawRow, sell: sellFill.rawRow }
    };
  }

  /**
   * 2つのタイムスタンプ間の時間差を人間が読める形式にフォーマット
   * @param {Date} start - 開始時刻
   * @param {Date} end - 終了時刻
   * @returns {string} "Xhr Ymin Zsec" 形式
   */
  function calculateDuration(start, end) {
    var diffMs = Math.abs(end.getTime() - start.getTime());
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
    normalizeFillsToTrades: normalizeFillsToTrades,
    detectCSVFormat: detectCSVFormat,
    detectDirection: detectDirection,
    calculateDuration: calculateDuration,
    parsePnL: parsePnL,
    parseTimestamp: parseTimestamp,
    formatDate: formatDate,
    getDayOfWeek: getDayOfWeek,
    REQUIRED_COLUMNS: REQUIRED_COLUMNS,
    OPTIONAL_COLUMNS: OPTIONAL_COLUMNS,
    PRODUCT_MULTIPLIERS: PRODUCT_MULTIPLIERS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CSVParser;
  } else {
    root.CSVParser = CSVParser;
  }
})(typeof window !== 'undefined' ? window : global);
