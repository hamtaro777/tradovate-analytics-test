/**
 * KPI Calculator - トレードデータからKPIを算出する純粋関数群
 */
(function (root) {
  'use strict';

  /**
   * 全KPIを算出
   * @param {Object[]} trades - トレード配列
   * @returns {Object} KPI結果
   */
  function calculateAllKPIs(trades) {
    if (!trades || trades.length === 0) {
      return getEmptyKPIs();
    }

    var totalTrades = trades.length;
    var wins = [];
    var losses = [];
    var totalPnL = 0;
    var totalCommission = 0;

    for (var i = 0; i < trades.length; i++) {
      var pnl = trades[i].pnl;
      totalPnL += pnl;
      totalCommission += trades[i].commission || 0;

      if (pnl > 0) {
        wins.push(pnl);
      } else if (pnl < 0) {
        losses.push(pnl);
      }
      // pnl === 0 は勝ちにも負けにもカウントしない
    }

    var winCount = wins.length;
    var lossCount = losses.length;
    var winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

    var totalWin = sum(wins);
    var totalLoss = Math.abs(sum(losses));
    var avgWin = winCount > 0 ? totalWin / winCount : 0;
    var avgLoss = lossCount > 0 ? totalLoss / lossCount : 0;
    var profitFactor = totalLoss > 0 ? totalWin / totalLoss : totalWin > 0 ? Infinity : 0;

    var maxWin = wins.length > 0 ? Math.max.apply(null, wins) : 0;
    var maxLoss = losses.length > 0 ? Math.min.apply(null, losses) : 0;

    // 連続勝敗
    var streaks = calculateStreaks(trades);

    // ネットP/L（手数料込み）
    var netPnL = totalPnL - totalCommission;

    return {
      totalTrades: totalTrades,
      winCount: winCount,
      lossCount: lossCount,
      evenCount: totalTrades - winCount - lossCount,
      winRate: winRate,
      totalPnL: totalPnL,
      netPnL: netPnL,
      totalCommission: totalCommission,
      avgWin: avgWin,
      avgLoss: avgLoss,
      profitFactor: profitFactor,
      maxWin: maxWin,
      maxLoss: maxLoss,
      maxConsecutiveWins: streaks.maxWins,
      maxConsecutiveLosses: streaks.maxLosses,
      avgPnL: totalTrades > 0 ? totalPnL / totalTrades : 0
    };
  }

  /**
   * 空のKPIオブジェクト
   */
  function getEmptyKPIs() {
    return {
      totalTrades: 0, winCount: 0, lossCount: 0, evenCount: 0,
      winRate: 0, totalPnL: 0, netPnL: 0, totalCommission: 0,
      avgWin: 0, avgLoss: 0, profitFactor: 0,
      maxWin: 0, maxLoss: 0,
      maxConsecutiveWins: 0, maxConsecutiveLosses: 0, avgPnL: 0
    };
  }

  /**
   * 連続勝敗数を計算
   * @param {Object[]} trades
   * @returns {{ maxWins: number, maxLosses: number }}
   */
  function calculateStreaks(trades) {
    var maxWins = 0, maxLosses = 0;
    var currentWins = 0, currentLosses = 0;

    for (var i = 0; i < trades.length; i++) {
      if (trades[i].pnl > 0) {
        currentWins++;
        currentLosses = 0;
        if (currentWins > maxWins) maxWins = currentWins;
      } else if (trades[i].pnl < 0) {
        currentLosses++;
        currentWins = 0;
        if (currentLosses > maxLosses) maxLosses = currentLosses;
      } else {
        currentWins = 0;
        currentLosses = 0;
      }
    }
    return { maxWins: maxWins, maxLosses: maxLosses };
  }

  /**
   * 日次サマリーを算出
   * @param {Object[]} trades
   * @returns {Object[]} 日次サマリー配列（日付昇順）
   */
  function calculateDailySummary(trades) {
    var dateMap = {};

    for (var i = 0; i < trades.length; i++) {
      var date = trades[i].tradeDate;
      if (!dateMap[date]) {
        dateMap[date] = { date: date, trades: [], pnl: 0, commission: 0 };
      }
      dateMap[date].trades.push(trades[i]);
      dateMap[date].pnl += trades[i].pnl;
      dateMap[date].commission += trades[i].commission || 0;
    }

    var dates = Object.keys(dateMap).sort();
    var result = [];
    var cumPnL = 0;

    for (var j = 0; j < dates.length; j++) {
      var day = dateMap[dates[j]];
      cumPnL += day.pnl;
      var dayKPIs = calculateAllKPIs(day.trades);
      result.push({
        date: day.date,
        pnl: day.pnl,
        cumulativePnL: cumPnL,
        tradeCount: day.trades.length,
        winRate: dayKPIs.winRate,
        commission: day.commission,
        netPnL: day.pnl - day.commission
      });
    }

    return result;
  }

  /**
   * 曜日別サマリーを算出
   * @param {Object[]} trades
   * @returns {Object[]} 曜日別サマリー（月〜金の順）
   */
  function calculateDayOfWeekSummary(trades) {
    var dayOrder = ['月', '火', '水', '木', '金', '土', '日'];
    var dayMap = {};

    for (var i = 0; i < dayOrder.length; i++) {
      dayMap[dayOrder[i]] = { day: dayOrder[i], pnl: 0, tradeCount: 0, wins: 0, losses: 0 };
    }

    for (var j = 0; j < trades.length; j++) {
      var dow = trades[j].dayOfWeek;
      if (dayMap[dow]) {
        dayMap[dow].pnl += trades[j].pnl;
        dayMap[dow].tradeCount++;
        if (trades[j].pnl > 0) dayMap[dow].wins++;
        if (trades[j].pnl < 0) dayMap[dow].losses++;
      }
    }

    var result = [];
    for (var k = 0; k < dayOrder.length; k++) {
      if (dayMap[dayOrder[k]].tradeCount > 0) {
        var d = dayMap[dayOrder[k]];
        d.winRate = d.tradeCount > 0 ? (d.wins / d.tradeCount) * 100 : 0;
        d.avgPnL = d.tradeCount > 0 ? d.pnl / d.tradeCount : 0;
        result.push(d);
      }
    }

    return result;
  }

  /**
   * 配列の合計
   * @param {number[]} arr
   * @returns {number}
   */
  function sum(arr) {
    var total = 0;
    for (var i = 0; i < arr.length; i++) {
      total += arr[i];
    }
    return total;
  }

  /**
   * 通貨フォーマット（USD）
   * @param {number} value
   * @returns {string}
   */
  function formatCurrency(value) {
    if (value === Infinity) return '∞';
    var isNegative = value < 0;
    var abs = Math.abs(value);
    var formatted = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (isNegative ? '-$' : '$') + formatted;
  }

  /**
   * パーセントフォーマット
   * @param {number} value
   * @returns {string}
   */
  function formatPercent(value) {
    return value.toFixed(1) + '%';
  }

  /**
   * Profit Factorフォーマット
   * @param {number} value
   * @returns {string}
   */
  function formatProfitFactor(value) {
    if (value === Infinity) return '∞';
    return value.toFixed(2);
  }

  /**
   * 曜日の日本語→英語マッピング
   */
  var DAY_NAME_MAP = {
    '日': 'Sunday', '月': 'Monday', '火': 'Tuesday',
    '水': 'Wednesday', '木': 'Thursday', '金': 'Friday', '土': 'Saturday'
  };

  /**
   * Duration文字列を秒数に変換
   * "1hr 5min 30sec" → 3930, "36min 8sec" → 2168, "29sec" → 29
   * @param {string} durationStr
   * @returns {number} 秒数（パース不能なら0）
   */
  function parseDurationToSeconds(durationStr) {
    if (!durationStr || typeof durationStr !== 'string') return 0;
    var totalSec = 0;
    var hrMatch = durationStr.match(/(\d+)\s*hr/);
    var minMatch = durationStr.match(/(\d+)\s*min/);
    var secMatch = durationStr.match(/(\d+)\s*sec/);
    if (hrMatch) totalSec += parseInt(hrMatch[1], 10) * 3600;
    if (minMatch) totalSec += parseInt(minMatch[1], 10) * 60;
    if (secMatch) totalSec += parseInt(secMatch[1], 10);
    return totalSec;
  }

  /**
   * 秒数をフォーマット済み文字列に変換
   * @param {number} totalSeconds
   * @returns {string} "X min Y sec" or "X hr Y min Z sec"
   */
  function formatDurationFromSeconds(totalSeconds) {
    if (!totalSeconds || totalSeconds <= 0) return '0 sec';
    totalSeconds = Math.round(totalSeconds);
    var hours = Math.floor(totalSeconds / 3600);
    var minutes = Math.floor((totalSeconds % 3600) / 60);
    var seconds = totalSeconds % 60;
    var parts = [];
    if (hours > 0) parts.push(hours + ' hr');
    if (minutes > 0) parts.push(minutes + ' min');
    if (seconds > 0 || parts.length === 0) parts.push(seconds + ' sec');
    return parts.join(' ');
  }

  /**
   * 拡張KPIを算出（画像に表示される追加項目）
   * @param {Object[]} trades - トレード配列
   * @returns {Object} 拡張KPI結果
   */
  function calculateExtendedKPIs(trades) {
    if (!trades || trades.length === 0) {
      return getEmptyExtendedKPIs();
    }

    // --- Most Active / Most Profitable / Least Profitable Day ---
    var dowStats = {};
    var activeDays = {}; // 日付ごとにトレードがあるかカウント

    for (var i = 0; i < trades.length; i++) {
      var t = trades[i];
      var dow = t.dayOfWeek;

      if (!dowStats[dow]) {
        dowStats[dow] = { pnl: 0, tradeCount: 0, dates: {} };
      }
      dowStats[dow].pnl += t.pnl;
      dowStats[dow].tradeCount++;
      dowStats[dow].dates[t.tradeDate] = true;

      // 全体のアクティブ日数
      activeDays[t.tradeDate] = true;
    }

    var totalActiveDays = Object.keys(activeDays).length;
    var totalTrades = trades.length;

    // Most Active Day
    var mostActiveDay = null;
    var mostActiveDayCount = 0;
    var mostActiveDayDates = 0;
    var dowKeys = Object.keys(dowStats);
    for (var d = 0; d < dowKeys.length; d++) {
      var stat = dowStats[dowKeys[d]];
      if (stat.tradeCount > mostActiveDayCount) {
        mostActiveDayCount = stat.tradeCount;
        mostActiveDay = dowKeys[d];
        mostActiveDayDates = Object.keys(stat.dates).length;
      }
    }

    // Most Profitable Day
    var mostProfitableDay = null;
    var mostProfitablePnL = -Infinity;
    for (var p = 0; p < dowKeys.length; p++) {
      if (dowStats[dowKeys[p]].pnl > mostProfitablePnL) {
        mostProfitablePnL = dowStats[dowKeys[p]].pnl;
        mostProfitableDay = dowKeys[p];
      }
    }

    // Least Profitable Day
    var leastProfitableDay = null;
    var leastProfitablePnL = Infinity;
    for (var lp = 0; lp < dowKeys.length; lp++) {
      if (dowStats[dowKeys[lp]].pnl < leastProfitablePnL) {
        leastProfitablePnL = dowStats[dowKeys[lp]].pnl;
        leastProfitableDay = dowKeys[lp];
      }
    }

    // --- Total Lots Traded ---
    var totalLots = 0;
    for (var li = 0; li < trades.length; li++) {
      totalLots += trades[li].qty || 1;
    }

    // --- Average Durations ---
    var allDurations = [];
    var winDurations = [];
    var lossDurations = [];
    for (var di = 0; di < trades.length; di++) {
      var dur = parseDurationToSeconds(trades[di].duration);
      if (dur > 0) {
        allDurations.push(dur);
        if (trades[di].pnl > 0) {
          winDurations.push(dur);
        } else if (trades[di].pnl < 0) {
          lossDurations.push(dur);
        }
      }
    }
    var avgDuration = allDurations.length > 0 ? sum(allDurations) / allDurations.length : 0;
    var avgWinDuration = winDurations.length > 0 ? sum(winDurations) / winDurations.length : 0;
    var avgLossDuration = lossDurations.length > 0 ? sum(lossDurations) / lossDurations.length : 0;

    // --- Trade Direction ---
    var longCount = 0;
    var shortCount = 0;
    for (var ti = 0; ti < trades.length; ti++) {
      var dir = (trades[ti].direction || '').toLowerCase();
      if (dir === 'long' || dir === 'buy') {
        longCount++;
      } else if (dir === 'short' || dir === 'sell') {
        shortCount++;
      }
    }
    var longPercent = totalTrades > 0 ? (longCount / totalTrades) * 100 : 0;

    // --- Best / Worst Trade ---
    var bestTrade = trades[0];
    var worstTrade = trades[0];
    for (var bt = 1; bt < trades.length; bt++) {
      if (trades[bt].pnl > bestTrade.pnl) bestTrade = trades[bt];
      if (trades[bt].pnl < worstTrade.pnl) worstTrade = trades[bt];
    }

    return {
      mostActiveDay: mostActiveDay ? (DAY_NAME_MAP[mostActiveDay] || mostActiveDay) : '-',
      mostActiveDayCount: mostActiveDayCount,
      mostActiveDayDates: mostActiveDayDates,
      totalActiveDays: totalActiveDays,
      avgTradesPerDay: totalActiveDays > 0 ? totalTrades / totalActiveDays : 0,
      mostProfitableDay: mostProfitableDay ? (DAY_NAME_MAP[mostProfitableDay] || mostProfitableDay) : '-',
      mostProfitablePnL: mostProfitablePnL === -Infinity ? 0 : mostProfitablePnL,
      leastProfitableDay: leastProfitableDay ? (DAY_NAME_MAP[leastProfitableDay] || leastProfitableDay) : '-',
      leastProfitablePnL: leastProfitablePnL === Infinity ? 0 : leastProfitablePnL,
      totalLots: totalLots,
      avgDuration: avgDuration,
      avgWinDuration: avgWinDuration,
      avgLossDuration: avgLossDuration,
      longCount: longCount,
      shortCount: shortCount,
      longPercent: longPercent,
      bestTrade: bestTrade,
      worstTrade: worstTrade
    };
  }

  /**
   * 空の拡張KPIオブジェクト
   */
  function getEmptyExtendedKPIs() {
    return {
      mostActiveDay: '-', mostActiveDayCount: 0, mostActiveDayDates: 0,
      totalActiveDays: 0, avgTradesPerDay: 0,
      mostProfitableDay: '-', mostProfitablePnL: 0,
      leastProfitableDay: '-', leastProfitablePnL: 0,
      totalLots: 0,
      avgDuration: 0, avgWinDuration: 0, avgLossDuration: 0,
      longCount: 0, shortCount: 0, longPercent: 0,
      bestTrade: null, worstTrade: null
    };
  }

  /**
   * トレードの方向を推定（direction列が空の場合）
   * @param {Object} trade
   * @returns {string} 'Long' | 'Short'
   */
  function inferDirection(trade) {
    if (trade.direction && trade.direction !== '') return trade.direction;
    if (trade.boughtTimestamp && trade.soldTimestamp) {
      return trade.boughtTimestamp <= trade.soldTimestamp ? 'Long' : 'Short';
    }
    return 'Long';
  }

  /**
   * トレードの詳細を人間が読める形式でフォーマット
   * @param {Object} trade
   * @returns {string}
   */
  function formatTradeDetail(trade) {
    if (!trade) return '';
    var dir = inferDirection(trade);
    var sym = trade.symbol || '';
    // シンボルの先頭文字を除去して表示用にする
    var displaySymbol = sym;
    var entry = trade.buyPrice;
    var exit = trade.sellPrice;
    var ts = '';
    if (trade.soldTimestamp && trade.soldTimestamp.getTime() > 0) {
      var d = trade.soldTimestamp;
      ts = String(d.getMonth() + 1).padStart(2, '0') + '/' +
           String(d.getDate()).padStart(2, '0') + '/' +
           d.getFullYear() + ' ' +
           String(d.getHours()).padStart(2, '0') + ':' +
           String(d.getMinutes()).padStart(2, '0') + ':' +
           String(d.getSeconds()).padStart(2, '0');
    }
    return dir + ' ' + (trade.qty || 1) + ' /' + displaySymbol +
           ' @ ' + entry + ', Exited @ ' + exit +
           (ts ? ', ' + ts : '');
  }

  // Export
  var KPI = {
    calculateAllKPIs: calculateAllKPIs,
    calculateExtendedKPIs: calculateExtendedKPIs,
    calculateDailySummary: calculateDailySummary,
    calculateDayOfWeekSummary: calculateDayOfWeekSummary,
    calculateStreaks: calculateStreaks,
    getEmptyKPIs: getEmptyKPIs,
    getEmptyExtendedKPIs: getEmptyExtendedKPIs,
    parseDurationToSeconds: parseDurationToSeconds,
    formatDurationFromSeconds: formatDurationFromSeconds,
    formatTradeDetail: formatTradeDetail,
    inferDirection: inferDirection,
    formatCurrency: formatCurrency,
    formatPercent: formatPercent,
    formatProfitFactor: formatProfitFactor,
    sum: sum,
    DAY_NAME_MAP: DAY_NAME_MAP
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KPI;
  } else {
    root.KPI = KPI;
  }
})(typeof window !== 'undefined' ? window : global);
