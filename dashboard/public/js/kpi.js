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

  // Export
  var KPI = {
    calculateAllKPIs: calculateAllKPIs,
    calculateDailySummary: calculateDailySummary,
    calculateDayOfWeekSummary: calculateDayOfWeekSummary,
    calculateStreaks: calculateStreaks,
    getEmptyKPIs: getEmptyKPIs,
    formatCurrency: formatCurrency,
    formatPercent: formatPercent,
    formatProfitFactor: formatProfitFactor,
    sum: sum
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = KPI;
  } else {
    root.KPI = KPI;
  }
})(typeof window !== 'undefined' ? window : global);
