/**
 * Google Sheets Integration
 * サービスアカウントを使用してGoogle Sheetsにデータを保存
 *
 * 必要な環境変数:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL: サービスアカウントのメールアドレス
 * - GOOGLE_PRIVATE_KEY: サービスアカウントの秘密鍵（PEM形式）
 * - GOOGLE_SPREADSHEET_ID: 保存先スプレッドシートID
 */
const crypto = require('crypto');
const https = require('https');

const SCOPES = 'https://www.googleapis.com/auth/spreadsheets';

/**
 * JWT トークンを生成
 * @returns {string} JWT token
 */
function createJWT() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');

  if (!email || !privateKey) {
    throw new Error('Google API認証情報が設定されていません。.envファイルを確認してください。');
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: email,
    scope: SCOPES,
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const segments = [
    base64url(JSON.stringify(header)),
    base64url(JSON.stringify(payload))
  ];
  const signingInput = segments.join('.');

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signingInput);
  const signature = sign.sign(privateKey);

  return signingInput + '.' + base64url(signature);
}

/**
 * Base64URL エンコード
 * @param {string|Buffer} input
 * @returns {string}
 */
function base64url(input) {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * アクセストークンを取得
 * @returns {Promise<string>}
 */
async function getAccessToken() {
  const jwt = createJWT();
  const body = new URLSearchParams({
    grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
    assertion: jwt
  }).toString();

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'oauth2.googleapis.com',
      path: '/token',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) {
            resolve(parsed.access_token);
          } else {
            reject(new Error('トークン取得に失敗: ' + (parsed.error_description || parsed.error || '不明')));
          }
        } catch (e) {
          reject(new Error('トークンレスポンスの解析に失敗'));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

/**
 * Google Sheets APIリクエスト
 * @param {string} token
 * @param {string} path
 * @param {string} method
 * @param {Object} [body]
 * @returns {Promise<Object>}
 */
function sheetsRequest(token, apiPath, method, body) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'sheets.googleapis.com',
      path: apiPath,
      method: method,
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error('Sheets API Error: ' + (parsed.error?.message || JSON.stringify(parsed))));
          }
        } catch (e) {
          reject(new Error('Sheets APIレスポンスの解析に失敗'));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * トレードデータをGoogle Sheetsに保存
 * 3つのシートに書き込み: Raw, Trades, DailySummary
 * @param {Object} payload - { trades, dailySummary, kpis }
 * @returns {Promise<{ spreadsheetId: string }>}
 */
async function saveToSheets(payload) {
  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID;
  if (!spreadsheetId) {
    throw new Error('GOOGLE_SPREADSHEET_IDが設定されていません。');
  }

  const token = await getAccessToken();
  const basePath = `/v4/spreadsheets/${spreadsheetId}/values`;

  // Trades シート
  const tradeRows = [
    ['#', 'シンボル', '数量', 'エントリー', 'イグジット', '損益', '手数料', '買い時刻', '売り時刻', '保有時間', '取引日']
  ];
  for (const t of payload.trades) {
    tradeRows.push([
      t.id, t.symbol, t.qty, t.buyPrice, t.sellPrice,
      t.pnl, t.commission, t.boughtTimestamp, t.soldTimestamp,
      t.duration, t.tradeDate
    ]);
  }

  // DailySummary シート
  const dailyRows = [
    ['日付', '日次損益', '累積損益', 'トレード数', 'Win率', '手数料']
  ];
  for (const d of payload.dailySummary) {
    dailyRows.push([
      d.date, d.pnl, d.cumulativePnL, d.tradeCount,
      d.winRate.toFixed(1) + '%', d.commission
    ]);
  }

  // KPI シート
  const kpi = payload.kpis;
  const kpiRows = [
    ['指標', '値'],
    ['総トレード数', kpi.totalTrades],
    ['勝ちトレード数', kpi.winCount],
    ['負けトレード数', kpi.lossCount],
    ['Win率', kpi.winRate.toFixed(1) + '%'],
    ['Total P/L', kpi.totalPnL],
    ['Net P/L', kpi.netPnL],
    ['総手数料', kpi.totalCommission],
    ['平均勝ち', kpi.avgWin],
    ['平均負け', kpi.avgLoss],
    ['Profit Factor', kpi.profitFactor === Infinity ? '∞' : kpi.profitFactor.toFixed(2)],
    ['最大勝ち', kpi.maxWin],
    ['最大負け', kpi.maxLoss],
    ['最大連勝', kpi.maxConsecutiveWins],
    ['最大連敗', kpi.maxConsecutiveLosses]
  ];

  // バッチ更新
  await sheetsRequest(token, `/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`, 'POST', {
    valueInputOption: 'USER_ENTERED',
    data: [
      { range: 'Trades!A1', values: tradeRows },
      { range: 'DailySummary!A1', values: dailyRows },
      { range: 'KPI!A1', values: kpiRows }
    ]
  });

  return { spreadsheetId };
}

module.exports = { saveToSheets, getAccessToken };
