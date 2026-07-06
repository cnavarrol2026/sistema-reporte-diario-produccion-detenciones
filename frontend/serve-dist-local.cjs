const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const port = Number(process.env.FRONTEND_PORT || 5173);
const root = path.join(__dirname, "dist");
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp"
};

function send(response, statusCode, body, contentType = "text/plain; charset=utf-8") {
  response.writeHead(statusCode, { "Content-Type": contentType });
  response.end(body);
}

http
  .createServer((request, response) => {
    const urlPath = decodeURIComponent((request.url || "/").split("?")[0]);
    const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
    let filePath = path.join(root, safePath === "/" ? "index.html" : safePath);

    if (!filePath.startsWith(root)) {
      send(response, 403, "Acceso no permitido");
      return;
    }

    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(root, "index.html");
    }

    const extension = path.extname(filePath).toLowerCase();
    fs.readFile(filePath, (error, content) => {
      if (error) {
        send(response, 500, "No fue posible cargar la pagina");
        return;
      }
      send(response, 200, content, contentTypes[extension] || "application/octet-stream");
    });
  })
  .listen(port, "127.0.0.1", () => {
    console.log(`Frontend estatico disponible en http://localhost:${port}`);
  });
