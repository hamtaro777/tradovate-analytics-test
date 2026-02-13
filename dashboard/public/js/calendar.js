/**
 * P/L Calendar - 損益カレンダーコンポーネント
 * 月別カレンダーに日次P/Lとトレード数を表示
 */
(function (root) {
  'use strict';

  var currentYear;
  var currentMonth;
  var dailySummaryData = [];
  var containerEl = null;

  /**
   * カレンダー初期化
   * @param {string} containerId - コンテナ要素のID
   * @param {Object[]} dailySummary - 日次サマリー配列
   */
  function init(containerId, dailySummary) {
    containerEl = document.getElementById(containerId);
    if (!containerEl) return;

    dailySummaryData = dailySummary || [];

    // データが存在する最新月を初期表示にする
    if (dailySummaryData.length > 0) {
      var lastDate = dailySummaryData[dailySummaryData.length - 1].date;
      var parts = lastDate.split('-');
      currentYear = parseInt(parts[0], 10);
      currentMonth = parseInt(parts[1], 10) - 1; // 0-indexed
    } else {
      var now = new Date();
      currentYear = now.getFullYear();
      currentMonth = now.getMonth();
    }

    render();
  }

  /**
   * 日次サマリーからdate→データのマップを作成
   */
  function buildDateMap() {
    var map = {};
    for (var i = 0; i < dailySummaryData.length; i++) {
      var d = dailySummaryData[i];
      map[d.date] = d;
    }
    return map;
  }

  /**
   * 月のP/L合計を計算
   */
  function getMonthlyPnL(year, month, dateMap) {
    var totalPnL = 0;
    var totalTrades = 0;
    var daysInMonth = new Date(year, month + 1, 0).getDate();

    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = formatDateStr(year, month, d);
      if (dateMap[dateStr]) {
        totalPnL += dateMap[dateStr].pnl;
        totalTrades += dateMap[dateStr].tradeCount;
      }
    }
    return { pnl: totalPnL, tradeCount: totalTrades };
  }

  /**
   * 週のP/L合計を計算
   */
  function getWeeklyPnL(weekDates, dateMap) {
    var totalPnL = 0;
    var hasTrades = false;
    for (var i = 0; i < weekDates.length; i++) {
      if (weekDates[i] && dateMap[weekDates[i]]) {
        totalPnL += dateMap[weekDates[i]].pnl;
        hasTrades = true;
      }
    }
    return hasTrades ? totalPnL : null;
  }

  /**
   * YYYY-MM-DD形式の日付文字列を生成
   */
  function formatDateStr(year, month, day) {
    var m = String(month + 1);
    if (m.length < 2) m = '0' + m;
    var d = String(day);
    if (d.length < 2) d = '0' + d;
    return year + '-' + m + '-' + d;
  }

  /**
   * 月名（英語短縮）
   */
  function getMonthName(month) {
    var names = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return names[month];
  }

  /**
   * P/L金額のフォーマット（カレンダー用：コンパクト表示）
   */
  function formatPnL(value) {
    var isNegative = value < 0;
    var abs = Math.abs(value);
    var formatted;
    if (abs >= 1000) {
      formatted = (abs / 1000).toFixed(1) + 'k';
      // 末尾の.0kを除去
      formatted = formatted.replace('.0k', 'k');
    } else {
      formatted = abs.toFixed(0);
    }
    return (isNegative ? '-$' : '+$') + formatted;
  }

  /**
   * P/L金額のフォーマット（ヘッダー用：フル表示）
   */
  function formatPnLFull(value) {
    var isNegative = value < 0;
    var abs = Math.abs(value);
    var formatted = abs.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return (isNegative ? '-$' : '+$') + formatted;
  }

  /**
   * カレンダーを描画
   */
  function render() {
    if (!containerEl) return;

    var dateMap = buildDateMap();
    var monthly = getMonthlyPnL(currentYear, currentMonth, dateMap);
    var today = new Date();
    var todayStr = formatDateStr(today.getFullYear(), today.getMonth(), today.getDate());

    // カレンダーグリッドデータを構築
    var firstDay = new Date(currentYear, currentMonth, 1).getDay(); // 0=Sunday
    var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    var weeks = [];
    var currentWeek = [];
    var weekDates = [];

    // 先頭の空白日
    for (var i = 0; i < firstDay; i++) {
      currentWeek.push(null);
      weekDates.push(null);
    }

    for (var day = 1; day <= daysInMonth; day++) {
      var dateStr = formatDateStr(currentYear, currentMonth, day);
      currentWeek.push({ day: day, dateStr: dateStr, data: dateMap[dateStr] || null });
      weekDates.push(dateStr);

      if (currentWeek.length === 7) {
        weeks.push({ cells: currentWeek, dates: weekDates });
        currentWeek = [];
        weekDates = [];
      }
    }

    // 末尾の空白日
    if (currentWeek.length > 0) {
      while (currentWeek.length < 7) {
        currentWeek.push(null);
        weekDates.push(null);
      }
      weeks.push({ cells: currentWeek, dates: weekDates });
    }

    // HTML構築
    var html = '';

    // ヘッダー
    html += '<div class="cal-header">';
    html += '<div class="cal-header-left">';
    html += '<h3 class="cal-title">損益カレンダー</h3>';
    html += '<span class="cal-monthly-pnl ' + (monthly.pnl >= 0 ? 'cal-positive' : 'cal-negative') + '">';
    html += formatPnLFull(monthly.pnl);
    html += '</span>';
    html += '</div>';
    html += '<div class="cal-header-right">';
    html += '<button class="cal-btn cal-btn-today" data-action="today">Today</button>';
    html += '<button class="cal-btn cal-btn-nav" data-action="prev">&#9664;</button>';
    html += '<span class="cal-month-label">' + getMonthName(currentMonth) + ' ' + currentYear + '</span>';
    html += '<button class="cal-btn cal-btn-nav" data-action="next">&#9654;</button>';
    html += '</div>';
    html += '</div>';

    // 曜日ヘッダー
    var dayNames = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    html += '<div class="cal-grid">';
    html += '<div class="cal-weekday-row">';
    for (var w = 0; w < dayNames.length; w++) {
      html += '<div class="cal-weekday">' + dayNames[w] + '</div>';
    }
    html += '<div class="cal-weekday cal-weekday-summary">Week</div>';
    html += '</div>';

    // 各週の描画
    for (var wi = 0; wi < weeks.length; wi++) {
      var week = weeks[wi];
      html += '<div class="cal-week-row">';

      for (var ci = 0; ci < week.cells.length; ci++) {
        var cell = week.cells[ci];
        if (!cell) {
          html += '<div class="cal-day cal-day-empty"></div>';
        } else {
          var isToday = cell.dateStr === todayStr;
          var hasData = cell.data !== null;
          var cellClass = 'cal-day';
          if (isToday) cellClass += ' cal-day-today';
          if (hasData) {
            cellClass += cell.data.pnl >= 0 ? ' cal-day-positive' : ' cal-day-negative';
          }

          html += '<div class="' + cellClass + '">';
          html += '<div class="cal-day-number">' + cell.day + '</div>';
          if (hasData) {
            html += '<div class="cal-day-pnl ' + (cell.data.pnl >= 0 ? 'cal-positive' : 'cal-negative') + '">';
            html += formatPnL(cell.data.pnl);
            html += '</div>';
            html += '<div class="cal-day-trades">' + cell.data.tradeCount + ' trade' + (cell.data.tradeCount !== 1 ? 's' : '') + '</div>';
          }
          html += '</div>';
        }
      }

      // 週サマリー
      var weekPnL = getWeeklyPnL(week.dates, dateMap);
      html += '<div class="cal-week-summary">';
      if (weekPnL !== null) {
        html += '<div class="cal-week-pnl ' + (weekPnL >= 0 ? 'cal-positive' : 'cal-negative') + '">';
        html += formatPnL(weekPnL);
        html += '</div>';
      }
      html += '</div>';

      html += '</div>';
    }

    html += '</div>';

    containerEl.innerHTML = html;

    // イベントリスナーの設定
    var buttons = containerEl.querySelectorAll('[data-action]');
    for (var b = 0; b < buttons.length; b++) {
      buttons[b].addEventListener('click', handleNavClick);
    }
  }

  /**
   * ナビゲーションボタンのクリックハンドラー
   */
  function handleNavClick(e) {
    var action = e.currentTarget.getAttribute('data-action');

    if (action === 'prev') {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
    } else if (action === 'next') {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
    } else if (action === 'today') {
      var now = new Date();
      currentYear = now.getFullYear();
      currentMonth = now.getMonth();
    }

    render();
  }

  // Export
  root.PnLCalendar = {
    init: init
  };

})(window);
