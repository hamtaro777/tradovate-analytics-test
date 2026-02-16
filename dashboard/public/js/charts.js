/**
 * Canvas Chart Renderer - Chart.js不要のカスタムチャート描画
 */
(function (root) {
  'use strict';

  var COLORS = {
    profit: '#22c55e',
    loss: '#ef4444',
    line: '#3b82f6',
    lineArea: 'rgba(59, 130, 246, 0.15)',
    grid: '#374151',
    text: '#9ca3af',
    textLight: '#d1d5db',
    bg: '#1f2937',
    barPositive: '#22c55e',
    barNegative: '#ef4444',
    tooltip: '#111827'
  };

  var PADDING = { top: 30, right: 20, bottom: 50, left: 70 };

  /**
   * 日次損益棒グラフを描画
   * @param {HTMLCanvasElement} canvas
   * @param {Object[]} dailySummary
   */
  function drawDailyPnLChart(canvas, dailySummary) {
    if (!dailySummary || dailySummary.length === 0) return;
    var ctx = canvas.getContext('2d');
    setupCanvas(canvas, ctx);

    var width = canvas.width;
    var height = canvas.height;
    var chartW = width - PADDING.left - PADDING.right;
    var chartH = height - PADDING.top - PADDING.bottom;

    var values = dailySummary.map(function (d) { return d.pnl; });
    var maxVal = Math.max.apply(null, values.map(Math.abs));
    if (maxVal === 0) maxVal = 1;
    var yScale = chartH / 2 / (maxVal * 1.1);
    var barWidth = Math.max(4, Math.min(40, (chartW / dailySummary.length) * 0.7));
    var gap = (chartW - barWidth * dailySummary.length) / (dailySummary.length + 1);

    // 背景
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // タイトル
    ctx.fillStyle = COLORS.textLight;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('日次損益', width / 2, 18);

    // グリッド線
    var zeroY = PADDING.top + chartH / 2;
    drawHorizontalGrid(ctx, PADDING.left, width - PADDING.right, zeroY, COLORS.grid);

    var gridSteps = 4;
    for (var g = 1; g <= gridSteps; g++) {
      var offset = (chartH / 2) * (g / gridSteps);
      drawHorizontalGrid(ctx, PADDING.left, width - PADDING.right, zeroY - offset, COLORS.grid, 0.3);
      drawHorizontalGrid(ctx, PADDING.left, width - PADDING.right, zeroY + offset, COLORS.grid, 0.3);

      // Y軸ラベル
      ctx.fillStyle = COLORS.text;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      var labelVal = (maxVal * 1.1 * g / gridSteps);
      ctx.fillText('$' + formatNum(labelVal), PADDING.left - 5, zeroY - offset + 4);
      ctx.fillText('-$' + formatNum(labelVal), PADDING.left - 5, zeroY + offset + 4);
    }

    // ゼロライン
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, zeroY);
    ctx.lineTo(width - PADDING.right, zeroY);
    ctx.stroke();

    // 棒グラフ描画
    for (var i = 0; i < dailySummary.length; i++) {
      var x = PADDING.left + gap + i * (barWidth + gap);
      var val = dailySummary[i].pnl;
      var barH = Math.abs(val) * yScale;
      var y = val >= 0 ? zeroY - barH : zeroY;

      ctx.fillStyle = val >= 0 ? COLORS.barPositive : COLORS.barNegative;
      roundRect(ctx, x, y, barWidth, barH, 2);

      // X軸ラベル（日付が多い場合は間引く）
      if (dailySummary.length <= 15 || i % Math.ceil(dailySummary.length / 10) === 0) {
        ctx.save();
        ctx.fillStyle = COLORS.text;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        var dateLabel = dailySummary[i].date.substring(5);
        ctx.fillText(dateLabel, x + barWidth / 2, height - PADDING.bottom + 15);
        ctx.restore();
      }
    }

    // ツールチップ用データ保存
    canvas._chartData = {
      type: 'bar',
      items: dailySummary.map(function (d, idx) {
        return {
          x: PADDING.left + gap + idx * (barWidth + gap),
          w: barWidth,
          label: d.date,
          value: d.pnl
        };
      })
    };
  }

  /**
   * 累積損益線グラフを描画
   * @param {HTMLCanvasElement} canvas
   * @param {Object[]} dailySummary
   */
  function drawCumulativePnLChart(canvas, dailySummary) {
    if (!dailySummary || dailySummary.length === 0) return;
    var ctx = canvas.getContext('2d');
    setupCanvas(canvas, ctx);

    var width = canvas.width;
    var height = canvas.height;
    var chartW = width - PADDING.left - PADDING.right;
    var chartH = height - PADDING.top - PADDING.bottom;

    var values = dailySummary.map(function (d) { return d.cumulativePnL; });
    var minVal = Math.min.apply(null, values.concat([0]));
    var maxVal = Math.max.apply(null, values.concat([0]));
    var range = maxVal - minVal;
    if (range === 0) range = 1;

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // タイトル
    ctx.fillStyle = COLORS.textLight;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('累積損益', width / 2, 18);

    // Y軸グリッド
    var gridSteps = 5;
    for (var g = 0; g <= gridSteps; g++) {
      var yPos = PADDING.top + (chartH * g / gridSteps);
      var yVal = maxVal - (range * g / gridSteps);
      drawHorizontalGrid(ctx, PADDING.left, width - PADDING.right, yPos, COLORS.grid, 0.3);
      ctx.fillStyle = COLORS.text;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText('$' + formatNum(yVal), PADDING.left - 5, yPos + 4);
    }

    // ゼロライン
    if (minVal < 0 && maxVal > 0) {
      var zeroY = PADDING.top + chartH * (maxVal / range);
      ctx.strokeStyle = COLORS.text;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, zeroY);
      ctx.lineTo(width - PADDING.right, zeroY);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 面積グラデーション
    var pointSpacing = chartW / Math.max(1, dailySummary.length - 1);
    ctx.beginPath();
    ctx.moveTo(PADDING.left, PADDING.top + chartH - ((values[0] - minVal) / range) * chartH);
    for (var i = 1; i < values.length; i++) {
      var px = PADDING.left + i * pointSpacing;
      var py = PADDING.top + chartH - ((values[i] - minVal) / range) * chartH;
      ctx.lineTo(px, py);
    }
    ctx.lineTo(PADDING.left + (values.length - 1) * pointSpacing, PADDING.top + chartH);
    ctx.lineTo(PADDING.left, PADDING.top + chartH);
    ctx.closePath();
    ctx.fillStyle = COLORS.lineArea;
    ctx.fill();

    // 線グラフ
    ctx.beginPath();
    ctx.strokeStyle = COLORS.line;
    ctx.lineWidth = 2.5;
    ctx.lineJoin = 'round';
    for (var j = 0; j < values.length; j++) {
      var lx = PADDING.left + j * pointSpacing;
      var ly = PADDING.top + chartH - ((values[j] - minVal) / range) * chartH;
      if (j === 0) ctx.moveTo(lx, ly);
      else ctx.lineTo(lx, ly);
    }
    ctx.stroke();

    // データポイント
    for (var k = 0; k < values.length; k++) {
      var dx = PADDING.left + k * pointSpacing;
      var dy = PADDING.top + chartH - ((values[k] - minVal) / range) * chartH;
      ctx.beginPath();
      ctx.arc(dx, dy, 4, 0, Math.PI * 2);
      ctx.fillStyle = values[k] >= 0 ? COLORS.profit : COLORS.loss;
      ctx.fill();
      ctx.strokeStyle = COLORS.bg;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // X軸ラベル
    for (var m = 0; m < dailySummary.length; m++) {
      if (dailySummary.length <= 15 || m % Math.ceil(dailySummary.length / 10) === 0) {
        ctx.fillStyle = COLORS.text;
        ctx.font = '10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(dailySummary[m].date.substring(5), PADDING.left + m * pointSpacing, height - PADDING.bottom + 15);
      }
    }
  }

  /**
   * 曜日別損益棒グラフを描画
   * @param {HTMLCanvasElement} canvas
   * @param {Object[]} dayOfWeekSummary
   */
  function drawDayOfWeekChart(canvas, dayOfWeekSummary) {
    if (!dayOfWeekSummary || dayOfWeekSummary.length === 0) return;
    var ctx = canvas.getContext('2d');
    setupCanvas(canvas, ctx);

    var width = canvas.width;
    var height = canvas.height;
    var chartW = width - PADDING.left - PADDING.right;
    var chartH = height - PADDING.top - PADDING.bottom;

    var values = dayOfWeekSummary.map(function (d) { return d.pnl; });
    var maxVal = Math.max.apply(null, values.map(Math.abs));
    if (maxVal === 0) maxVal = 1;
    var yScale = chartH / 2 / (maxVal * 1.1);
    var barWidth = Math.min(60, (chartW / dayOfWeekSummary.length) * 0.6);
    var gap = (chartW - barWidth * dayOfWeekSummary.length) / (dayOfWeekSummary.length + 1);

    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // タイトル
    ctx.fillStyle = COLORS.textLight;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('曜日別損益', width / 2, 18);

    // ゼロライン
    var zeroY = PADDING.top + chartH / 2;
    ctx.strokeStyle = COLORS.text;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(PADDING.left, zeroY);
    ctx.lineTo(width - PADDING.right, zeroY);
    ctx.stroke();

    // グリッド
    var gridSteps = 4;
    for (var g = 1; g <= gridSteps; g++) {
      var offset = (chartH / 2) * (g / gridSteps);
      drawHorizontalGrid(ctx, PADDING.left, width - PADDING.right, zeroY - offset, COLORS.grid, 0.3);
      drawHorizontalGrid(ctx, PADDING.left, width - PADDING.right, zeroY + offset, COLORS.grid, 0.3);

      ctx.fillStyle = COLORS.text;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'right';
      var lv = (maxVal * 1.1 * g / gridSteps);
      ctx.fillText('$' + formatNum(lv), PADDING.left - 5, zeroY - offset + 4);
      ctx.fillText('-$' + formatNum(lv), PADDING.left - 5, zeroY + offset + 4);
    }

    // 棒グラフ
    for (var i = 0; i < dayOfWeekSummary.length; i++) {
      var x = PADDING.left + gap + i * (barWidth + gap);
      var val = dayOfWeekSummary[i].pnl;
      var barH = Math.abs(val) * yScale;
      var y = val >= 0 ? zeroY - barH : zeroY;

      ctx.fillStyle = val >= 0 ? COLORS.barPositive : COLORS.barNegative;
      roundRect(ctx, x, y, barWidth, barH, 3);

      // 曜日ラベル
      ctx.fillStyle = COLORS.textLight;
      ctx.font = '13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(dayOfWeekSummary[i].day, x + barWidth / 2, height - PADDING.bottom + 18);

      // 金額ラベル
      ctx.fillStyle = val >= 0 ? COLORS.profit : COLORS.loss;
      ctx.font = '11px system-ui, sans-serif';
      var labelY = val >= 0 ? y - 5 : y + barH + 14;
      ctx.fillText('$' + formatNum(val), x + barWidth / 2, labelY);
    }
  }

  /**
   * 保有時間別トレード数 横棒グラフ
   * @param {HTMLCanvasElement} canvas
   * @param {Object[]} durationBuckets
   */
  function drawDurationTradeCountChart(canvas, durationBuckets) {
    if (!durationBuckets || durationBuckets.length === 0) return;
    var ctx = canvas.getContext('2d');
    setupCanvas(canvas, ctx);

    var width = canvas.width;
    var height = canvas.height;
    var padLeft = 90;
    var padRight = 50;
    var padTop = 36;
    var padBottom = 30;
    var chartW = width - padLeft - padRight;
    var chartH = height - padTop - padBottom;
    var n = durationBuckets.length;
    var barHeight = Math.min(28, (chartH / n) * 0.65);
    var gap = (chartH - barHeight * n) / (n + 1);

    var maxCount = 1;
    for (var i = 0; i < n; i++) {
      if (durationBuckets[i].tradeCount > maxCount) maxCount = durationBuckets[i].tradeCount;
    }

    // 背景
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // タイトル
    ctx.fillStyle = COLORS.textLight;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('保有時間別トレード数', width / 2, 20);

    // 棒グラフ
    for (var j = 0; j < n; j++) {
      var bucket = durationBuckets[j];
      var y = padTop + gap + j * (barHeight + gap);
      var barW = maxCount > 0 ? (bucket.tradeCount / maxCount) * chartW : 0;
      if (barW < 1 && bucket.tradeCount > 0) barW = 4;

      // ラベル（左側）
      ctx.fillStyle = COLORS.text;
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(bucket.label, padLeft - 8, y + barHeight / 2 + 4);

      // バー
      ctx.fillStyle = COLORS.line;
      roundRect(ctx, padLeft, y, Math.max(barW, 0), barHeight, 3);

      // カウントラベル
      ctx.fillStyle = COLORS.textLight;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(String(bucket.tradeCount), padLeft + barW + 6, y + barHeight / 2 + 4);
    }
  }

  /**
   * 保有時間別勝率 横棒グラフ
   * @param {HTMLCanvasElement} canvas
   * @param {Object[]} durationBuckets
   */
  function drawDurationWinRateChart(canvas, durationBuckets) {
    if (!durationBuckets || durationBuckets.length === 0) return;
    var ctx = canvas.getContext('2d');
    setupCanvas(canvas, ctx);

    var width = canvas.width;
    var height = canvas.height;
    var padLeft = 90;
    var padRight = 50;
    var padTop = 36;
    var padBottom = 30;
    var chartW = width - padLeft - padRight;
    var chartH = height - padTop - padBottom;
    var n = durationBuckets.length;
    var barHeight = Math.min(28, (chartH / n) * 0.65);
    var gap = (chartH - barHeight * n) / (n + 1);

    // 背景
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    // タイトル
    ctx.fillStyle = COLORS.textLight;
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('保有時間別勝率', width / 2, 20);

    // 50%ライン
    var fiftyX = padLeft + chartW * 0.5;
    ctx.save();
    ctx.strokeStyle = COLORS.text;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(fiftyX, padTop);
    ctx.lineTo(fiftyX, height - padBottom);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();

    ctx.fillStyle = COLORS.text;
    ctx.font = '10px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('50%', fiftyX, height - padBottom + 14);

    // 棒グラフ
    for (var j = 0; j < n; j++) {
      var bucket = durationBuckets[j];
      var y = padTop + gap + j * (barHeight + gap);
      var barW = (bucket.winRate / 100) * chartW;
      if (barW < 1 && bucket.tradeCount > 0) barW = 4;

      // ラベル（左側）
      ctx.fillStyle = COLORS.text;
      ctx.font = '12px system-ui, sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(bucket.label, padLeft - 8, y + barHeight / 2 + 4);

      // バー（勝率50%以上は緑、以下は赤）
      if (bucket.tradeCount > 0) {
        ctx.fillStyle = bucket.winRate >= 50 ? COLORS.profit : COLORS.loss;
        roundRect(ctx, padLeft, y, Math.max(barW, 0), barHeight, 3);
      }

      // パーセントラベル
      ctx.fillStyle = COLORS.textLight;
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.textAlign = 'left';
      if (bucket.tradeCount > 0) {
        ctx.fillText(bucket.winRate.toFixed(1) + '%', padLeft + barW + 6, y + barHeight / 2 + 4);
      } else {
        ctx.fillStyle = COLORS.text;
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText('-', padLeft + 6, y + barHeight / 2 + 4);
      }
    }
  }

  // ==================== ユーティリティ ====================

  function setupCanvas(canvas, ctx) {
    var dpr = window.devicePixelRatio || 1;
    var rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    // Reset for logical pixel drawing
    canvas.width = rect.width;
    canvas.height = rect.height;
  }

  function drawHorizontalGrid(ctx, x1, x2, y, color, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha || 1;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x1, y);
    ctx.lineTo(x2, y);
    ctx.stroke();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    if (h < 1) h = 1;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
  }

  function formatNum(val) {
    var abs = Math.abs(val);
    if (abs >= 1000) {
      return abs.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    return abs.toFixed(2);
  }

  // Export
  var Charts = {
    drawDailyPnLChart: drawDailyPnLChart,
    drawCumulativePnLChart: drawCumulativePnLChart,
    drawDayOfWeekChart: drawDayOfWeekChart,
    drawDurationTradeCountChart: drawDurationTradeCountChart,
    drawDurationWinRateChart: drawDurationWinRateChart,
    COLORS: COLORS
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Charts;
  } else {
    root.Charts = Charts;
  }
})(typeof window !== 'undefined' ? window : global);
