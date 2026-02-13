/**
 * Main Application Controller
 * CSVアップロード → 解析 → KPI/チャート/テーブル表示を統合
 */
(function (root) {
  'use strict';

  var state = {
    trades: [],
    kpis: null,
    dailySummary: [],
    dayOfWeekSummary: [],
    csvHeaders: [],
    mapping: {},
    fileName: '',
    isLoaded: false
  };

  /**
   * アプリケーション初期化
   */
  function init() {
    setupFileUpload();
    setupMappingModal();
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

    state.fileName = file.name;
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
      state.trades = CSVParser.normalizeFillsToTrades(parsed);

      if (state.trades.length === 0) {
        showError('マッチするトレードが見つかりませんでした。Buy/Sellのペアが存在するか確認してください。');
        return;
      }

      state.kpis = KPI.calculateAllKPIs(state.trades);
      state.dailySummary = KPI.calculateDailySummary(state.trades);
      state.dayOfWeekSummary = KPI.calculateDayOfWeekSummary(state.trades);
      state.isLoaded = true;

      renderDashboard();
      showSection('dashboard');
      hideStatus();

      // Google Sheets保存（設定済みの場合）
      saveToGoogleSheets();
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
      state.trades = CSVParser.normalizeToTrades(parsed, mapping);
      state.kpis = KPI.calculateAllKPIs(state.trades);
      state.dailySummary = KPI.calculateDailySummary(state.trades);
      state.dayOfWeekSummary = KPI.calculateDayOfWeekSummary(state.trades);
      state.isLoaded = true;

      renderDashboard();
      showSection('dashboard');
      hideStatus();

      // Google Sheets保存（設定済みの場合）
      saveToGoogleSheets();
    } catch (err) {
      showError('データ処理中にエラーが発生しました: ' + err.message);
    }
  }

  /**
   * ダッシュボード全体を描画
   */
  function renderDashboard() {
    renderFileInfo();
    renderKPICards();
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
    el.innerHTML = '<span class="file-name">' + escapeHtml(state.fileName) + '</span>' +
      '<span class="trade-count">' + state.trades.length + ' トレード</span>' +
      '<button id="btn-new-upload" class="btn-secondary btn-sm">別のCSVを読み込む</button>';

    document.getElementById('btn-new-upload').addEventListener('click', function () {
      state.isLoaded = false;
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
   * Google Sheets保存
   */
  function saveToGoogleSheets() {
    var saveBtn = document.getElementById('btn-save-sheets');
    if (!saveBtn) return;

    saveBtn.style.display = 'inline-block';
    saveBtn.addEventListener('click', function () {
      saveBtn.disabled = true;
      saveBtn.textContent = '保存中...';

      var payload = {
        trades: state.trades.map(function (t) {
          return {
            id: t.id, symbol: t.symbol, qty: t.qty,
            buyPrice: t.buyPrice, sellPrice: t.sellPrice,
            pnl: t.pnl, commission: t.commission,
            boughtTimestamp: t.boughtTimestamp.toISOString(),
            soldTimestamp: t.soldTimestamp.toISOString(),
            duration: t.duration, tradeDate: t.tradeDate
          };
        }),
        dailySummary: state.dailySummary,
        kpis: state.kpis
      };

      fetch('/api/sheets/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })
        .then(function (res) { return res.json(); })
        .then(function (data) {
          if (data.success) {
            showSuccess('Google Sheetsに保存しました。');
          } else {
            showError('Google Sheetsへの保存に失敗しました: ' + (data.error || '不明なエラー'));
          }
          saveBtn.disabled = false;
          saveBtn.textContent = 'Google Sheetsに保存';
        })
        .catch(function (err) {
          showError('Google Sheetsへの接続に失敗しました。サーバー設定を確認してください。');
          saveBtn.disabled = false;
          saveBtn.textContent = 'Google Sheetsに保存';
        });
    });
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
