const crypto = require('crypto');

class LoadBalancer {
  constructor() {
    this.nodes = new Map(); // name -> { weight, healthy }
    this.logs = [];
    this.requestCounter = 0;
    this.requestsPerNode = {};
    // Rate limiting: map ip -> { windowStart, count }
    this.rateLimit = { windowSec: 60, maxRequests: 100 };
    this.rateMap = new Map();
  }

  // Add node with optional options { weight }
  addNode(name, opts = {}) {
    const weight = Math.max(1, parseInt(opts.weight || 1));
    this.nodes.set(name, { name, weight, healthy: true });
    this._log(`Node added: ${name} (weight=${weight})`);
  }

  removeNode(name) {
    this.nodes.delete(name);
    this._log(`Node removed: ${name}`);
  }

  setNodeHealth(name, healthy) {
    const n = this.nodes.get(name);
    if (n) {
      n.healthy = healthy;
      this._log(`Node ${name} health set to ${healthy}`);
    }
  }

  getNodes() {
    return Array.from(this.nodes.values()).map(n => ({ name: n.name, weight: n.weight, healthy: n.healthy }));
  }

  // Simple rate limiter per IP (fixed window)
  _isRateLimited(ip) {
    const now = Math.floor(Date.now() / 1000);
    const entry = this.rateMap.get(ip) || { windowStart: now, count: 0 };
    if (now - entry.windowStart >= this.rateLimit.windowSec) {
      entry.windowStart = now;
      entry.count = 0;
    }
    entry.count += 1;
    this.rateMap.set(ip, entry);
    return entry.count > this.rateLimit.maxRequests;
  }

  setRateLimit(cfg) {
    this.rateLimit = Object.assign(this.rateLimit, cfg);
  }

  getRateLimitConfig() {
    return this.rateLimit;
  }

  // Rendezvous hashing (highest random weight) with weights
  _score(ip, node) {
    // compute hash(ip + '|' + node.name)
    const h = crypto.createHash('sha256').update(ip + '|' + node.name).digest('hex');
    // take first 16 hex chars to form a big integer
    const bigint = BigInt('0x' + h.slice(0, 16));
    // multiply by weight to implement weighted routing
    return bigint * BigInt(node.weight);
  }

  // Route an IP to a node, with health/fallback and rate limiting
  route(ip) {
    // Rate limiting check
    if (this._isRateLimited(ip)) {
      const msg = `IP ${ip} is rate-limited`;
      this._log(msg);
      throw new Error(msg);
    }

    const nodes = Array.from(this.nodes.values());
    if (nodes.length === 0) throw new Error('No nodes configured');

    // For each node compute score, pick max among healthy nodes; if none healthy, pick max overall as fallback
    let best = null;
    let bestScore = null;
    for (const node of nodes) {
      const score = this._score(ip, node);
      if (!best || score > bestScore) {
        best = node;
        bestScore = score;
      }
    }

    // If best is unhealthy, try to find next highest healthy
    if (!best.healthy) {
      // sort nodes by score descending and pick first healthy
      const scored = nodes.map(n => ({ n, s: this._score(ip, n) }))
                          .sort((a,b) => (b.s > a.s ? 1 : (b.s < a.s ? -1 : 0)));
      const healthyCandidate = scored.find(x => x.n.healthy);
      if (healthyCandidate) best = healthyCandidate.n;
      // else keep best (unhealthy) as fallback
    }

    // logging and metrics
    this._log(`Incoming IP: ${ip} → Routed to: ${best.name}`);
    this.requestCounter += 1;
    this.requestsPerNode[best.name] = (this.requestsPerNode[best.name] || 0) + 1;

    // keep last 200 logs
    while (this.logs.length > 200) this.logs.shift();

    return best.name;
  }

  _log(msg) {
    const ts = new Date().toISOString();
    const entry = { ts, msg };
    this.logs.push(entry);
    console.log(entry.ts + '  ' + entry.msg);
  }

  getLogs() {
    return this.logs.slice().reverse();
  }

  metrics() {
    return {
      totalRequests: this.requestCounter,
      requestsPerNode: this.requestsPerNode,
      nodes: this.getNodes(),
      rateLimit: this.getRateLimitConfig()
    };
  }
}

module.exports = LoadBalancer;
