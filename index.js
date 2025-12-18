const express = require('express');
const bodyParser = require('body-parser');
const LoadBalancer = require('./loadbalancer');
const { generateRandomIP } = require('./utils');

const app = express();
app.use(bodyParser.json());

const lb = new LoadBalancer();

// Sample initial nodes with weights
lb.addNode('Node-A', { weight: 3 });
lb.addNode('Node-B', { weight: 1 });
lb.addNode('Node-C', { weight: 2 });

// Route an IP (query param ?ip=)
app.get('/route', (req, res) => {
  const ip = req.query.ip || generateRandomIP();
  try {
    const node = lb.route(ip);
    res.json({ ip, node });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Simulate traffic: POST { count: 10 }
app.post('/simulate', (req, res) => {
  const count = parseInt(req.body.count || 10);
  const logs = [];
  for (let i = 0; i < count; i++) {
    const ip = generateRandomIP();
    const node = lb.route(ip);
    logs.push({ ip, node });
  }
  res.json({ simulated: count, logs });
});

// Nodes management
app.get('/nodes', (req, res) => {
  res.json(lb.getNodes());
});

app.post('/nodes', (req, res) => {
  const { name, weight } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  lb.addNode(name, { weight: parseInt(weight || 1) });
  res.json({ ok: true, nodes: lb.getNodes() });
});

app.delete('/nodes/:name', (req, res) => {
  lb.removeNode(req.params.name);
  res.json({ ok: true, nodes: lb.getNodes() });
});

// Set node health manually: POST { healthy: true/false }
app.post('/nodes/:name/health', (req, res) => {
  const { healthy } = req.body;
  lb.setNodeHealth(req.params.name, !!healthy);
  res.json({ ok: true, node: lb.getNodes().find(n => n.name === req.params.name) });
});

// Metrics and logs
app.get('/metrics', (req, res) => {
  res.json(lb.metrics());
});

app.get('/logs', (req, res) => {
  res.json(lb.getLogs());
});

// Rate limit configuration (global)
app.post('/ratelimit', (req, res) => {
  const { windowSec, maxRequests } = req.body;
  lb.setRateLimit({ windowSec: parseInt(windowSec||60), maxRequests: parseInt(maxRequests||20) });
  res.json({ ok: true, rateLimit: lb.getRateLimitConfig() });
});

// Dashboard (simple)
app.get('/dashboard', (req, res) => {
  const metrics = lb.metrics();
  const nodes = lb.getNodes();
  res.send(`
    <h2>Load Balancer Dashboard</h2>
    <p>Total requests: ${metrics.totalRequests}</p>
    <h3>Nodes</h3>
    <ul>
      ${nodes.map(n => `<li>${n.name} — weight=${n.weight} — healthy=${n.healthy} — handled=${metrics.requestsPerNode[n.name]||0}</li>`).join('')}
    </ul>
    <h3>Rate Limit</h3>
    <pre>${JSON.stringify(lb.getRateLimitConfig(), null, 2)}</pre>
    <p>Use <code>/route?ip=1.2.3.4</code> to route a single IP or POST /simulate { "count": 10 } to simulate.</p>
  `);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Load Balancer demo running on http://localhost:${PORT}/dashboard`);
  console.log('Available endpoints: GET /route, POST /simulate, GET /nodes, POST /nodes, DELETE /nodes/:name, POST /nodes/:name/health, GET /metrics');
});
