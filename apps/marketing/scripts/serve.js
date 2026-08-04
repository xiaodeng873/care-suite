import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const root = process.argv[2] ? path.resolve(process.argv[2]) : path.resolve(__dirname, '../dist');
const port = parseInt(process.argv[3] || '5173', 10);

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
};

function tryReadFile(filePath, callback) {
  fs.readFile(filePath, callback);
}

const server = http.createServer((req, res) => {
  let urlPath = decodeURIComponent(req.url.split('?')[0]);
  if (urlPath === '/') urlPath = '/index.html';

  function serveFile(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (err, data) => {
      if (err) {
        const notFoundPath = path.join(root, '404.html');
        if (fs.existsSync(notFoundPath)) {
          res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
          res.end(fs.readFileSync(notFoundPath));
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found');
        }
        return;
      }
      res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
      res.end(data);
    });
  }

  const filePath = path.join(root, urlPath);

  // Try exact path, then .html, then /index.html
  tryReadFile(filePath, (err) => {
    if (!err) {
      serveFile(filePath);
      return;
    }
    const htmlPath = filePath + '.html';
    tryReadFile(htmlPath, (err2) => {
      if (!err2) {
        serveFile(htmlPath);
        return;
      }
      const indexPath = path.join(filePath, 'index.html');
      tryReadFile(indexPath, (err3) => {
        if (!err3) {
          serveFile(indexPath);
          return;
        }
        serveFile(filePath); // triggers 404
      });
    });
  });
});

server.listen(port, () => {
  console.log(`Marketing site served at http://localhost:${port}`);
});
