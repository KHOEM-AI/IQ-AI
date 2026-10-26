import http from 'node:http';

const PORT = Number(process.env.PORT) || 8787;

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/api/v1/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, data: { status: 'up' }, error: null }));
    return;
  }
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, data: null, error: 'not_found' }));
});

server.listen(PORT, () => {
  console.log(`IQ-AI listening on port ${PORT}`);
});
