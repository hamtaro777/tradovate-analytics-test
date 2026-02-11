/**
 * Trade Table - トレード一覧テーブル（ソート・フィルタ）
 */
(function (root) {
  'use strict';

  var currentSort = { column: 'id', direction: 'asc' };
  var currentFilter = { dateFrom: '', dateTo: '', symbol: '' };
  var allTrades = [];
  var displayedTrades = [];

  /**
   * テーブルを初期化
   * @param {Object[]} trades
   */
  function initTable(trades) {
    allTrades = trades;
    applyFiltersAndSort();
    renderTable();
    renderFilterControls();
  }

  /**
   * フィルタ適用とソート
   */
  function applyFiltersAndSort() {
    displayedTrades = allTrades.filter(function (t) {
      if (currentFilter.dateFrom && t.tradeDate < currentFilter.dateFrom) return false;
      if (currentFilter.dateTo && t.tradeDate > currentFilter.dateTo) return false;
      if (currentFilter.symbol && t.symbol.toLowerCase().indexOf(currentFilter.symbol.toLowerCase()) === -1) return false;
      return true;
    });

    displayedTrades.sort(function (a, b) {
      var valA = a[currentSort.column];
      var valB = b[currentSort.column];

      if (typeof valA === 'string') valA = valA.toLowerCase();
      if (typeof valB === 'string') valB = valB.toLowerCase();
      if (valA instanceof Date) valA = valA.getTime();
      if (valB instanceof Date) valB = valB.getTime();

      var result = 0;
      if (valA < valB) result = -1;
      else if (valA > valB) result = 1;

      return currentSort.direction === 'desc' ? -result : result;
    });
  }

  /**
   * テーブルを描画
   */
  function renderTable() {
    var container = document.getElementById('trade-table-container');
    if (!container) return;

    var columns = [
      { key: 'id', label: '#', width: '50px' },
      { key: 'tradeDate', label: '日付', width: '100px' },
      { key: 'symbol', label: 'シンボル', width: '100px' },
      { key: 'qty', label: '数量', width: '60px' },
      { key: 'buyPrice', label: 'エントリー', width: '100px' },
      { key: 'sellPrice', label: 'イグジット', width: '100px' },
      { key: 'pnl', label: '損益', width: '100px' },
      { key: 'commission', label: '手数料', width: '80px' },
      { key: 'duration', label: '保有時間', width: '100px' }
    ];

    var html = '<div class="table-wrapper"><table class="trade-table">';

    // ヘッダー
    html += '<thead><tr>';
    for (var i = 0; i < columns.length; i++) {
      var col = columns[i];
      var sortIcon = '';
      if (currentSort.column === col.key) {
        sortIcon = currentSort.direction === 'asc' ? ' ▲' : ' ▼';
      }
      html += '<th data-column="' + col.key + '" style="width:' + col.width + '">' +
        col.label + sortIcon + '</th>';
    }
    html += '</tr></thead>';

    // ボディ
    html += '<tbody>';
    if (displayedTrades.length === 0) {
      html += '<tr><td colspan="' + columns.length + '" class="empty-message">トレードデータがありません</td></tr>';
    }
    for (var j = 0; j < displayedTrades.length; j++) {
      var trade = displayedTrades[j];
      var pnlClass = trade.pnl > 0 ? 'pnl-positive' : (trade.pnl < 0 ? 'pnl-negative' : '');
      html += '<tr class="' + pnlClass + '">';
      html += '<td>' + trade.id + '</td>';
      html += '<td>' + trade.tradeDate + '</td>';
      html += '<td>' + trade.symbol + '</td>';
      html += '<td>' + trade.qty + '</td>';
      html += '<td>' + formatPrice(trade.buyPrice) + '</td>';
      html += '<td>' + formatPrice(trade.sellPrice) + '</td>';
      html += '<td class="' + pnlClass + '">' + root.KPI.formatCurrency(trade.pnl) + '</td>';
      html += '<td>' + root.KPI.formatCurrency(trade.commission) + '</td>';
      html += '<td>' + trade.duration + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';

    // フッター（件数表示）
    html += '<div class="table-footer">' +
      '<span>表示: ' + displayedTrades.length + ' / ' + allTrades.length + ' 件</span>' +
      '</div>';

    container.innerHTML = html;

    // ソートイベント
    var headers = container.querySelectorAll('th[data-column]');
    for (var k = 0; k < headers.length; k++) {
      headers[k].addEventListener('click', function () {
        var col = this.getAttribute('data-column');
        if (currentSort.column === col) {
          currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
        } else {
          currentSort.column = col;
          currentSort.direction = 'asc';
        }
        applyFiltersAndSort();
        renderTable();
      });
    }
  }

  /**
   * フィルタコントロールを描画
   */
  function renderFilterControls() {
    var container = document.getElementById('table-filters');
    if (!container) return;

    // シンボル一覧取得
    var symbols = {};
    for (var i = 0; i < allTrades.length; i++) {
      symbols[allTrades[i].symbol] = true;
    }
    var symbolList = Object.keys(symbols).sort();

    var html = '<div class="filter-row">';
    html += '<div class="filter-group">';
    html += '<label>開始日</label>';
    html += '<input type="date" id="filter-date-from" value="' + currentFilter.dateFrom + '">';
    html += '</div>';
    html += '<div class="filter-group">';
    html += '<label>終了日</label>';
    html += '<input type="date" id="filter-date-to" value="' + currentFilter.dateTo + '">';
    html += '</div>';
    html += '<div class="filter-group">';
    html += '<label>シンボル</label>';
    html += '<select id="filter-symbol"><option value="">すべて</option>';
    for (var j = 0; j < symbolList.length; j++) {
      var selected = currentFilter.symbol === symbolList[j] ? ' selected' : '';
      html += '<option value="' + symbolList[j] + '"' + selected + '>' + symbolList[j] + '</option>';
    }
    html += '</select>';
    html += '</div>';
    html += '<div class="filter-group">';
    html += '<button id="filter-clear" class="btn-secondary">フィルタクリア</button>';
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    // イベントバインド
    document.getElementById('filter-date-from').addEventListener('change', function () {
      currentFilter.dateFrom = this.value;
      applyFiltersAndSort();
      renderTable();
    });
    document.getElementById('filter-date-to').addEventListener('change', function () {
      currentFilter.dateTo = this.value;
      applyFiltersAndSort();
      renderTable();
    });
    document.getElementById('filter-symbol').addEventListener('change', function () {
      currentFilter.symbol = this.value;
      applyFiltersAndSort();
      renderTable();
    });
    document.getElementById('filter-clear').addEventListener('click', function () {
      currentFilter = { dateFrom: '', dateTo: '', symbol: '' };
      applyFiltersAndSort();
      renderTable();
      renderFilterControls();
    });
  }

  function formatPrice(val) {
    if (!val && val !== 0) return '-';
    return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  // Export
  var TradeTable = {
    initTable: initTable,
    applyFiltersAndSort: applyFiltersAndSort,
    renderTable: renderTable,
    getDisplayedTrades: function () { return displayedTrades; }
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TradeTable;
  } else {
    root.TradeTable = TradeTable;
  }
})(typeof window !== 'undefined' ? window : global);
