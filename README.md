# Infollion Load Balancer - Software Developer Intern Task

This repository is an in-memory Load Balancer demo implementing:
- Rendezvous hashing (highest-random-weight) for deterministic routing.
- Weighted routing (node weights affect selection).
- Basic health checks (manual toggle) and fallback to healthy nodes.
- Rate limiting per IP (fixed window).
- Simple metrics and logs endpoints.
- Simulation endpoint to generate random traffic.

**This implementation is designed to satisfy the task and bonus challenges** from the provided PDF. fileciteturn0file0

## Setup

1. Ensure Node.js (v14 or later) and npm are installed.
2. Extract the zip and run:
   ```bash
   npm install
   npm start
   ```
3. Server runs on `http://localhost:3000`.

## Endpoints

- `GET /route?ip=1.2.3.4` — route a single IP (if ip omitted, random IP generated).
- `POST /simulate` `{ "count": 10 }` — simulate `count` random requests.
- `GET /nodes` — list nodes.
- `POST /nodes` `{ "name":"Node-D", "weight":2 }` — add a node.
- `DELETE /nodes/:name` — remove a node.
- `POST /nodes/:name/health` `{ "healthy": false }` — set node health manually.
- `GET /metrics` — get metrics JSON.
- `GET /logs` — recent logs.
- `POST /ratelimit` `{ "windowSec": 60, "maxRequests": 50 }` — set rate limit config.
- `GET /dashboard` — tiny HTML dashboard.

## Notes / Design Decisions

- **Rendezvous hashing** chosen for deterministic, order-independent mapping and easy weighted routing.
- **Weights** are implemented by multiplying the (big integer) hash by the node weight.
- **Health checks** are manual for this in-memory demo; an automated health probe could be added if backing servers exist.
- **Rate limiting** is fixed-window per IP and kept in-memory.
- All data structures are in-memory per constraints.

## Deliverables

- Backend project (this folder).
- Optional demonstration: use `curl` or Postman to call `/simulate` and `/metrics` to show flows.

## Example

```bash
# Route an IP
curl "http://localhost:3000/route?ip=203.120.10.5"

# Simulate 20 requests
curl -X POST "http://localhost:3000/simulate" -H "Content-Type: application/json" -d '{ "count": 20 }'

# Add node
curl -X POST "http://localhost:3000/nodes" -H "Content-Type: application/json" -d '{ "name": "Node-D", "weight": 2 }'

# Make Node-B unhealthy
curl -X POST "http://localhost:3000/nodes/Node-B/health" -H "Content-Type: application/json" -d '{ "healthy": false }'
```
