const express = require('express');
const path = require('node:path');

const app = express();
app.use(express.static(path.join(__dirname, '..', 'public')));
const port = Number(process.env.PORT || 3000);
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Garageboek draait op http://127.0.0.1:${port}`);
});
server.on('error', error => {
  console.error('De webserver kon niet starten:', error.message);
  process.exitCode = 1;
});
