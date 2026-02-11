/**
 * HTTP Server - 静的ファイル配信 + Google Sheets API
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { saveToSheets } = require('./google-sheets');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

/**
 * リクエストボディを読み取る
 * @param {http.IncomingMessage} req
 * @returns {Promise<string>}
 */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

/**
 * JSONレスポンスを送信
 * @param {http.ServerResponse} res
 * @param {number} status
 * @param {Object} data
 */
function sendJSON(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

/**
 * 静的ファイルを配信
 * @param {http.ServerResponse} res
 * @param {string} filePath
 */
function serveStatic(res, filePath) {
  const safePath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.join(PUBLIC_DIR, safePath);

  // パストラバーサル防止
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(fullPath, (err, stats) => {
    if (err || !stats.isFile()) {
      // index.htmlにフォールバック (SPA)
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.readFile(indexPath, (err2, data) => {
        if (err2) {
          res.writeHead(404);
          res.end('Not Found');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(data);
      });
      return;
    }

    const ext = path.extname(fullPath);
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(fullPath, (readErr, data) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Internal Server Error');
        return;
      }
      res.writeHead(200, { 'Content-Type': mimeType });
      res.end(data);
    });
  });
}

/**
 * APIルーティング
 */
async function handleAPI(req, res) {
  const url = req.url;
  const method = req.method;

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  if (url === '/api/sheets/save' && method === 'POST') {
    try {
      const body = await readBody(req);
      const payload = JSON.parse(body);
      const result = await saveToSheets(payload);
      sendJSON(res, 200, { success: true, spreadsheetId: result.spreadsheetId });
    } catch (err) {
      console.error('Google Sheets save error:', err.message);
      sendJSON(res, 500, { success: false, error: err.message });
    }
    return;
  }

  if (url === '/api/health' && method === 'GET') {
    sendJSON(res, 200, { status: 'ok', timestamp: new Date().toISOString() });
    return;
  }

  sendJSON(res, 404, { error: 'APIエンドポイントが見つかりません' });
}

/**
 * メインサーバー
 */
const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) {
      await handleAPI(req, res);
    } else {
      const urlPath = req.url.split('?')[0];
      const filePath = urlPath === '/' ? '/index.html' : urlPath;
      serveStatic(res, filePath);
    }
  } catch (err) {
    console.error('Server error:', err);
    res.writeHead(500);
    res.end('Internal Server Error');
  }
});

server.listen(PORT, () => {
  console.log(`
  ┌─────────────────────────────────────────────┐
  │  Tradovate Analytics Dashboard              │
  │  Server running at http://localhost:${PORT}     │
  │                                             │
  │  CSVファイルをアップロードして分析開始！     │
  └─────────────────────────────────────────────┘
  `);
});

module.exports = server;
