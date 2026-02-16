/**
 * Main Application Controller
 * CSVアップロード → 解析 → KPI/チャート/テーブル表示を統合
 */
(function (root) {
  'use strict';

  var state = {
    trades: [],
    kpis: null,
    extendedKpis: null,
    dailySummary: [],
    dayOfWeekSummary: [],
    csvHeaders: [],
    mapping: {},
    fileNames: [],
    isLoaded: false
  };

  /**
   * アプリケーション初期化
   */
  function init() {
    setupFileUpload();
    setupMappingModal();

    // localStorageに保存済みデータがあれば自動読み込み
    if (typeof TradeStorage !== 'undefined' && TradeStorage.hasSaved()) {
      var saved = TradeStorage.load();
      if (saved && saved.trades && saved.trades.length > 0) {
        state.trades = saved.trades;
        state.fileNames = saved.fileNames || [];
        state.kpis = KPI.calculateAllKPIs(state.trades);
        state.extendedKpis = KPI.calculateExtendedKPIs(state.trades);
        state.dailySummary = KPI.calculateDailySummary(state.trades);
        state.dayOfWeekSummary = KPI.calculateDayOfWeekSummary(state.trades);
        state.isLoaded = true;
        state.savedAt = saved.savedAt;

        showSection('dashboard');
        renderDashboard();
        return;
      }
    }

    showSection('upload');
  }

  /**
   * ファイルアップロードのセットアップ
   */
  function setupFileUpload() {
    var dropZone = document.getElementById('drop-zone');
    var fileInput = document.getElementById('csv-file-input');

    if (!dropZone || !fileInput) return;

    // ドラッグ&ドロップ
    dropZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });
    dropZone.addEventListener('dragleave', function () {
      dropZone.classList.remove('drag-over');
    });
    dropZone.addEventListener('drop', function (e) {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      var files = e.dataTransfer.files;
      if (files.length > 0) handleFile(files[0]);
    });

    // クリックでファイル選択
    dropZone.addEventListener('click', function () {
      fileInput.click();
    });
    fileInput.addEventListener('change', function () {
      if (this.files.length > 0) handleFile(this.files[0]);
    });
  }

  /**
   * ファイル処理
   * @param {File} file
   */
  function handleFile(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      showError('CSVファイルのみアップロード可能です。');
      return;
    }

    state._currentFileName = file.name;
    showStatus('ファイルを読み込んでいます...');

    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        processCSV(e.target.result);
      } catch (err) {
        showError('CSVの解析中にエラーが発生しました: ' + err.message);
      }
    };
    reader.onerror = function () {
      showError('ファイルの読み込みに失敗しました。');
    };
    reader.readAsText(file);
  }

  /**
   * CSV処理
   * @param {string} csvText
   */
  function processCSV(csvText) {
    var parsed = CSVParser.parseCSVText(csvText);
    state.csvHeaders = parsed.headers;

    if (parsed.rows.length === 0) {
      showError('CSVファイルにデータが含まれていません。');
      return;
    }

    // CSVフォーマットを自動検出
    var format = CSVParser.detectCSVFormat(parsed.headers);

    if (format === 'fills') {
      // Fills CSV → FIFOマッチングでトレードを生成
      finalizeFillsTrades(parsed);
      return;
    }

    // Performance CSV / その他 → 従来のマッピング処理
    var detection = CSVParser.autoDetectMapping(parsed.headers);

    if (detection.missing.length > 0) {
      // マッピングUIを表示
      showMappingModal(parsed.headers, detection.mapping, detection.missing, parsed);
    } else {
      // 全カラム検出済み → そのまま処理
      state.mapping = detection.mapping;
      finalizeTrades(parsed, detection.mapping);
    }
  }

  /**
   * Fills CSVからトレードデータを確定し、ダッシュボードを表示
   * @param {{ headers: string[], rows: string[][] }} parsed
   */
  function finalizeFillsTrades(parsed) {
    showStatus('Fills CSVからトレードデータを生成しています...');

    try {
      var newTrades = CSVParser.normalizeFillsToTrades(parsed);

      if (newTrades.length === 0) {
        showError('マッチするトレードが見つかりませんでした。Buy/Sellのペアが存在するか確認してください。');
        return;
      }

      applyMergedTrades(newTrades);
      hideStatus();

    } catch (err) {
      showError('Fills CSVの処理中にエラーが発生しました: ' + err.message);
    }
  }

  /**
   * マッピングモーダル表示
   */
  function showMappingModal(headers, partialMapping, missing, parsed) {
    var modal = document.getElementById('mapping-modal');
    var content = document.getElementById('mapping-content');
    if (!modal || !content) return;

    var html = '<h3>列マッピング設定</h3>';
    html += '<p class="mapping-info">以下の項目が自動検出できませんでした。CSVの列を選択してください。</p>';

    var allFields = Object.keys(CSVParser.REQUIRED_COLUMNS);
    var fieldLabels = {
      symbol: 'シンボル',
      buyPrice: 'エントリー価格',
      sellPrice: 'イグジット価格',
      pnl: '損益',
      qty: '数量',
      boughtTimestamp: '買い時刻',
      soldTimestamp: '売り時刻',
      duration: '保有時間'
    };

    html += '<div class="mapping-grid">';
    for (var i = 0; i < allFields.length; i++) {
      var field = allFields[i];
      var isMissing = missing.indexOf(field) !== -1;
      var currentVal = partialMapping[field] || '';

      html += '<div class="mapping-row' + (isMissing ? ' missing' : '') + '">';
      html += '<label>' + fieldLabels[field] + (isMissing ? ' <span class="required">※必須</span>' : '') + '</label>';
      html += '<select data-field="' + field + '">';
      html += '<option value="">-- 選択してください --</option>';
      for (var j = 0; j < headers.length; j++) {
        var selected = headers[j] === currentVal ? ' selected' : '';
        html += '<option value="' + headers[j] + '"' + selected + '>' + headers[j] + '</option>';
      }
      html += '</select>';
      html += '</div>';
    }
    html += '</div>';

    html += '<div class="mapping-actions">';
    html += '<button id="mapping-confirm" class="btn-primary">確定</button>';
    html += '<button id="mapping-cancel" class="btn-secondary">キャンセル</button>';
    html += '</div>';

    content.innerHTML = html;
    modal.classList.add('active');

    // 確定ボタン
    document.getElementById('mapping-confirm').addEventListener('click', function () {
      var selects = content.querySelectorAll('select[data-field]');
      var newMapping = {};
      var stillMissing = [];

      for (var k = 0; k < selects.length; k++) {
        var field = selects[k].getAttribute('data-field');
        var value = selects[k].value;
        if (value) {
          newMapping[field] = value;
        } else {
          stillMissing.push(fieldLabels[field] || field);
        }
      }

      if (stillMissing.length > 0) {
        showError('以下の必須項目が未選択です: ' + stillMissing.join(', '));
        return;
      }

      modal.classList.remove('active');
      state.mapping = newMapping;
      finalizeTrades(parsed, newMapping);
    });

    // キャンセルボタン
    document.getElementById('mapping-cancel').addEventListener('click', function () {
      modal.classList.remove('active');
    });
  }

  function setupMappingModal() {
    var overlay = document.getElementById('mapping-modal');
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) overlay.classList.remove('active');
      });
    }
  }

  /**
   * トレードデータを確定し、ダッシュボードを表示
   */
  function finalizeTrades(parsed, mapping) {
    showStatus('トレードデータを処理しています...');

    try {
      var newTrades = CSVParser.normalizeToTrades(parsed, mapping);

      applyMergedTrades(newTrades);
      hideStatus();

    } catch (err) {
      showError('データ処理中にエラーが発生しました: ' + err.message);
    }
  }

  /**
   * 新規トレードを既存データにマージしてダッシュボード表示
   * @param {Array} newTrades - CSVから生成された新しいトレード配列
   */
  function applyMergedTrades(newTrades) {
    var fileName = state._currentFileName || '';

    if (typeof TradeStorage !== 'undefined' && state.trades.length > 0) {
      // 既存データがある場合はマージ
      var result = TradeStorage.merge(state.trades, newTrades);
      state.trades = result.merged;

      if (result.skipped > 0 && result.added === 0) {
        showSuccess('すべてのトレード（' + result.skipped + '件）が既に保存済みです。新規データはありません。');
      } else if (result.skipped > 0) {
        showSuccess(result.added + '件の新規トレードを追加しました（' + result.skipped + '件の重複をスキップ）。');
      } else {
        showSuccess(result.added + '件の新規トレードを追加しました。');
      }
    } else {
      // 初回ロード
      state.trades = newTrades;
    }

    // ファイル名を追加（重複なし）
    if (fileName && state.fileNames.indexOf(fileName) === -1) {
      state.fileNames.push(fileName);
    }

    state.kpis = KPI.calculateAllKPIs(state.trades);
    state.extendedKpis = KPI.calculateExtendedKPIs(state.trades);
    state.dailySummary = KPI.calculateDailySummary(state.trades);
    state.dayOfWeekSummary = KPI.calculateDayOfWeekSummary(state.trades);
    state.isLoaded = true;

    saveToLocalStorage();
    showSection('dashboard');
    renderDashboard();
  }

  /**
   * ダッシュボード全体を描画
   */
  function renderDashboard() {
    renderFileInfo();
    renderKPICards();
    renderExtendedKPICards();
    PnLCalendar.init('pnl-calendar', state.dailySummary);
    renderCharts();
    TradeTable.initTable(state.trades);
  }

  /**
   * ファイル情報表示
   */
  function renderFileInfo() {
    var el = document.getElementById('file-info');
    if (!el) return;

    var fileLabel = state.fileNames.length > 0
      ? state.fileNames.map(escapeHtml).join(', ')
      : '(保存済みデータ)';

    var html = '<span class="file-name">' + fileLabel + '</span>' +
      '<span class="trade-count">' + state.trades.length + ' トレード</span>';

    if (state.savedAt) {
      var savedDate = new Date(state.savedAt);
      var savedStr = savedDate.getFullYear() + '/' +
        String(savedDate.getMonth() + 1).padStart(2, '0') + '/' +
        String(savedDate.getDate()).padStart(2, '0') + ' ' +
        String(savedDate.getHours()).padStart(2, '0') + ':' +
        String(savedDate.getMinutes()).padStart(2, '0');
      html += '<span class="saved-info">保存済み: ' + savedStr + '</span>';
    }

    html += '<button id="btn-new-upload" class="btn-secondary btn-sm">CSVを追加読み込み</button>';
    html += '<button id="btn-clear-storage" class="btn-secondary btn-sm btn-danger-outline">保存データを削除</button>';

    el.innerHTML = html;

    document.getElementById('btn-new-upload').addEventListener('click', function () {
      showSection('upload');
    });

    document.getElementById('btn-clear-storage').addEventListener('click', function () {
      if (typeof TradeStorage === 'undefined') return;
      var btn = document.getElementById('btn-clear-storage');
      if (!btn.dataset.confirmed) {
        btn.dataset.confirmed = 'pending';
        btn.textContent = '本当に削除しますか？';
        btn.classList.add('btn-danger-solid');
        setTimeout(function () {
          if (btn.dataset.confirmed === 'pending') {
            delete btn.dataset.confirmed;
            btn.textContent = '保存データを削除';
            btn.classList.remove('btn-danger-solid');
          }
        }, 3000);
        return;
      }
      delete btn.dataset.confirmed;
      TradeStorage.clear();
      state.trades = [];
      state.fileNames = [];
      state.savedAt = null;
      state.isLoaded = false;
      showSuccess('保存データを削除しました。');
      showSection('upload');
    });
  }

  /**
   * KPIカード描画
   */
  function renderKPICards() {
    var container = document.getElementById('kpi-cards');
    if (!container || !state.kpis) return;

    var kpis = state.kpis;
    var cards = [
      {
        label: 'Total P/L',
        value: KPI.formatCurrency(kpis.totalPnL),
        sub: 'Net: ' + KPI.formatCurrency(kpis.netPnL),
        color: kpis.totalPnL >= 0 ? 'positive' : 'negative'
      },
      {
        label: 'Win率',
        value: KPI.formatPercent(kpis.winRate),
        sub: kpis.winCount + '勝 / ' + kpis.lossCount + '敗',
        color: kpis.winRate >= 50 ? 'positive' : 'negative'
      },
      {
        label: 'Avg Win',
        value: KPI.formatCurrency(kpis.avgWin),
        sub: '最大: ' + KPI.formatCurrency(kpis.maxWin),
        color: 'positive'
      },
      {
        label: 'Avg Loss',
        value: KPI.formatCurrency(kpis.avgLoss),
        sub: '最大: ' + KPI.formatCurrency(Math.abs(kpis.maxLoss)),
        color: 'negative'
      },
      {
        label: 'Profit Factor',
        value: KPI.formatProfitFactor(kpis.profitFactor),
        sub: kpis.profitFactor >= 1.5 ? '良好' : kpis.profitFactor >= 1.0 ? '注意' : '改善必要',
        color: kpis.profitFactor >= 1.0 ? 'positive' : 'negative'
      },
      {
        label: '総トレード数',
        value: String(kpis.totalTrades),
        sub: '平均: ' + KPI.formatCurrency(kpis.avgPnL) + '/トレード',
        color: 'neutral'
      }
    ];

    var html = '';
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      html += '<div class="kpi-card kpi-' + card.color + '">';
      html += '<div class="kpi-label">' + card.label + '</div>';
      html += '<div class="kpi-value">' + card.value + '</div>';
      html += '<div class="kpi-sub">' + card.sub + '</div>';
      html += '</div>';
    }
    container.innerHTML = html;
  }

  /**
   * 拡張KPIカード描画（画像に対応する13項目）
   * レイアウト: Row1(3col) Row2(3col) Row3(2col) Row4(3col) Row5(2col)
   */
  function renderExtendedKPICards() {
    var container = document.getElementById('extended-kpi-cards');
    if (!container || !state.extendedKpis || !state.kpis) return;

    var ext = state.extendedKpis;
    var kpis = state.kpis;
    var html = '';

    // === Row 1: 3 columns (span-2 each) ===

    // 1. Most Active Day (horizontal: value left, stats right)
    html += '<div class="kpi-card kpi-neutral kpi-card-h ext-span-2">';
    html += '<div class="kpi-label">Most Active Day</div>';
    html += '<div class="kpi-card-body">';
    html += '<div class="kpi-card-left"><div class="kpi-value">' + escapeHtml(ext.mostActiveDay) + '</div></div>';
    html += '<div class="kpi-card-right"><div class="kpi-side-info">';
    html += '<div>' + ext.mostActiveDayDates + ' active days</div>';
    html += '<div>' + ext.mostActiveDayCount + ' total trades</div>';
    html += '<div>' + ext.avgTradesPerDay.toFixed(2) + ' avg trades/day</div>';
    html += '</div></div>';
    html += '</div></div>';

    // 2. Most Profitable Day (horizontal: day name left, P/L right)
    html += '<div class="kpi-card kpi-positive kpi-card-h ext-span-2">';
    html += '<div class="kpi-label">Most Profitable Day</div>';
    html += '<div class="kpi-card-body">';
    html += '<div class="kpi-card-left"><div class="kpi-value">' + escapeHtml(ext.mostProfitableDay) + '</div></div>';
    html += '<div class="kpi-card-right"><div class="kpi-side-value" style="color:var(--positive)">' + KPI.formatCurrency(ext.mostProfitablePnL) + '</div></div>';
    html += '</div></div>';

    // 3. Least Profitable Day (horizontal: day name left, P/L right)
    html += '<div class="kpi-card kpi-negative kpi-card-h ext-span-2">';
    html += '<div class="kpi-label">Least Profitable Day</div>';
    html += '<div class="kpi-card-body">';
    html += '<div class="kpi-card-left"><div class="kpi-value">' + escapeHtml(ext.leastProfitableDay) + '</div></div>';
    html += '<div class="kpi-card-right"><div class="kpi-side-value" style="color:var(--negative)">' + KPI.formatCurrency(ext.leastProfitablePnL) + '</div></div>';
    html += '</div></div>';

    // === Row 2: 3 columns (span-2 each) ===

    // 4. Total Number of Trades
    html += '<div class="kpi-card kpi-neutral ext-span-2">';
    html += '<div class="kpi-label">Total Number of Trades</div>';
    html += '<div class="kpi-value">' + kpis.totalTrades + '</div>';
    html += '</div>';

    // 5. Total Number of Lots Traded
    html += '<div class="kpi-card kpi-neutral ext-span-2">';
    html += '<div class="kpi-label">Total Number of Lots Traded</div>';
    html += '<div class="kpi-value">' + ext.totalLots + '</div>';
    html += '</div>';

    // 6. Average Trade Duration
    html += '<div class="kpi-card kpi-neutral ext-span-2">';
    html += '<div class="kpi-label">Average Trade Duration</div>';
    html += '<div class="kpi-value">' + KPI.formatDurationFromSeconds(ext.avgDuration) + '</div>';
    html += '</div>';

    // === Row 3: 2 columns (span-3 each) ===

    // 7. Average Win Duration
    html += '<div class="kpi-card kpi-positive ext-span-3">';
    html += '<div class="kpi-label">Average Win Duration</div>';
    html += '<div class="kpi-value">' + KPI.formatDurationFromSeconds(ext.avgWinDuration) + '</div>';
    html += '</div>';

    // 8. Average Loss Duration
    html += '<div class="kpi-card kpi-negative ext-span-3">';
    html += '<div class="kpi-label">Average Loss Duration</div>';
    html += '<div class="kpi-value">' + KPI.formatDurationFromSeconds(ext.avgLossDuration) + '</div>';
    html += '</div>';

    // === Row 4: 3 columns (span-2 each) ===

    // 9. Avg Winning Trade
    html += '<div class="kpi-card kpi-positive ext-span-2">';
    html += '<div class="kpi-label">Avg Winning Trade</div>';
    html += '<div class="kpi-value">' + KPI.formatCurrency(kpis.avgWin) + '</div>';
    html += '</div>';

    // 10. Avg Losing Trade
    html += '<div class="kpi-card kpi-negative ext-span-2">';
    html += '<div class="kpi-label">Avg Losing Trade</div>';
    html += '<div class="kpi-value">' + KPI.formatCurrency(-kpis.avgLoss) + '</div>';
    html += '</div>';

    // 11. Trade Direction % (horizontal: value left, donut right)
    html += '<div class="kpi-card kpi-neutral kpi-card-h ext-span-2">';
    html += '<div class="kpi-label">Trade Direction %</div>';
    html += '<div class="kpi-card-body">';
    html += '<div class="kpi-card-left"><div class="kpi-value">' + ext.longPercent.toFixed(2) + '%</div></div>';
    html += '<div class="kpi-card-right">';
    html += '<div class="kpi-donut-container">';
    html += '<canvas id="donut-direction" width="80" height="80"></canvas>';
    html += '<div class="kpi-donut-labels">';
    html += '<span class="donut-label-long">' + ext.longCount + '</span>';
    html += '<span class="donut-label-short">' + ext.shortCount + '</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    html += '</div></div>';

    // === Row 5: 2 columns (span-3 each) ===

    // 12. Best Trade (horizontal: value left, trade details right)
    html += '<div class="kpi-card kpi-positive kpi-card-h ext-span-3">';
    html += '<div class="kpi-label">Best Trade</div>';
    html += '<div class="kpi-card-body">';
    html += '<div class="kpi-card-left"><div class="kpi-value">' + (ext.bestTrade ? KPI.formatCurrency(ext.bestTrade.pnl) : '$0.00') + '</div></div>';
    html += '<div class="kpi-card-right"><div class="kpi-side-info">';
    if (ext.bestTrade) {
      html += formatTradeDetailLines(ext.bestTrade);
    }
    html += '</div></div>';
    html += '</div></div>';

    // 13. Worst Trade (horizontal: value left, trade details right)
    html += '<div class="kpi-card kpi-negative kpi-card-h ext-span-3">';
    html += '<div class="kpi-label">Worst Trade</div>';
    html += '<div class="kpi-card-body">';
    html += '<div class="kpi-card-left"><div class="kpi-value">' + (ext.worstTrade ? KPI.formatCurrency(ext.worstTrade.pnl) : '$0.00') + '</div></div>';
    html += '<div class="kpi-card-right"><div class="kpi-side-info">';
    if (ext.worstTrade) {
      html += formatTradeDetailLines(ext.worstTrade);
    }
    html += '</div></div>';
    html += '</div></div>';

    container.innerHTML = html;

    // Draw donut chart
    drawDirectionDonut(ext.longCount, ext.shortCount);
  }

  /**
   * トレード詳細を複数行のHTMLで返す（Best/Worst Trade右側用）
   */
  function formatTradeDetailLines(trade) {
    if (!trade) return '';
    var dir = KPI.inferDirection(trade);
    var sym = trade.symbol || '';
    var entry = trade.buyPrice;
    var exit = trade.sellPrice;
    var html = '';
    html += '<div>' + escapeHtml(dir + ' ' + (trade.qty || 1) + ' /' + sym + ' @ ' + entry) + '</div>';
    html += '<div>Exited @ ' + escapeHtml(String(exit)) + '</div>';
    if (trade.soldTimestamp && trade.soldTimestamp.getTime() > 0) {
      var d = trade.soldTimestamp;
      var ts = String(d.getMonth() + 1).padStart(2, '0') + '/' +
               String(d.getDate()).padStart(2, '0') + '/' +
               d.getFullYear() + ' ' +
               String(d.getHours()).padStart(2, '0') + ':' +
               String(d.getMinutes()).padStart(2, '0') + ':' +
               String(d.getSeconds()).padStart(2, '0');
      html += '<div>' + ts + '</div>';
    }
    return html;
  }

  /**
   * Trade Direction のドーナツチャートを描画
   */
  function drawDirectionDonut(longCount, shortCount) {
    var canvas = document.getElementById('donut-direction');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    var total = longCount + shortCount;
    if (total === 0) return;

    var dpr = window.devicePixelRatio || 1;
    var size = 80;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = size + 'px';
    canvas.style.height = size + 'px';
    ctx.scale(dpr, dpr);

    var cx = size / 2;
    var cy = size / 2;
    var radius = 32;
    var lineWidth = 10;
    var longAngle = (longCount / total) * 2 * Math.PI;

    // Long portion (green)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + longAngle);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.stroke();

    // Short portion (red)
    ctx.beginPath();
    ctx.arc(cx, cy, radius, -Math.PI / 2 + longAngle, -Math.PI / 2 + 2 * Math.PI);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = lineWidth;
    ctx.lineCap = 'butt';
    ctx.stroke();
  }

  /**
   * チャート描画
   */
  function renderCharts() {
    var dailyCanvas = document.getElementById('chart-daily-pnl');
    var cumCanvas = document.getElementById('chart-cumulative-pnl');
    var dowCanvas = document.getElementById('chart-day-of-week');

    if (dailyCanvas) Charts.drawDailyPnLChart(dailyCanvas, state.dailySummary);
    if (cumCanvas) Charts.drawCumulativePnLChart(cumCanvas, state.dailySummary);
    if (dowCanvas) Charts.drawDayOfWeekChart(dowCanvas, state.dayOfWeekSummary);

    // リサイズ対応
    var resizeTimer;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        if (state.isLoaded) {
          if (dailyCanvas) Charts.drawDailyPnLChart(dailyCanvas, state.dailySummary);
          if (cumCanvas) Charts.drawCumulativePnLChart(cumCanvas, state.dailySummary);
          if (dowCanvas) Charts.drawDayOfWeekChart(dowCanvas, state.dayOfWeekSummary);
        }
      }, 200);
    });
  }

  /**
   * localStorageにトレードデータを保存
   */
  function saveToLocalStorage() {
    if (typeof TradeStorage === 'undefined') return;

    var success = TradeStorage.save({
      trades: state.trades,
      fileNames: state.fileNames
    });

    if (success) {
      state.savedAt = new Date().toISOString();
    }
  }

  // ==================== UIヘルパー ====================

  function showSection(name) {
    var sections = document.querySelectorAll('.section');
    for (var i = 0; i < sections.length; i++) {
      sections[i].classList.remove('active');
    }
    var target = document.getElementById('section-' + name);
    if (target) target.classList.add('active');
  }

  function showError(msg) {
    var el = document.getElementById('notification');
    if (el) {
      el.className = 'notification error';
      el.textContent = msg;
      el.style.display = 'block';
      setTimeout(function () { el.style.display = 'none'; }, 5000);
    }
  }

  function showSuccess(msg) {
    var el = document.getElementById('notification');
    if (el) {
      el.className = 'notification success';
      el.textContent = msg;
      el.style.display = 'block';
      setTimeout(function () { el.style.display = 'none'; }, 3000);
    }
  }

  function showStatus(msg) {
    var el = document.getElementById('status-message');
    if (el) {
      el.textContent = msg;
      el.style.display = 'block';
    }
  }

  function hideStatus() {
    var el = document.getElementById('status-message');
    if (el) el.style.display = 'none';
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // Export
  root.App = {
    init: init,
    getState: function () { return state; }
  };

  // DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})(window);
