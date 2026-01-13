// middleware/metrics.js
const promClient = require('prom-client');

// Create default metrics
promClient.collectDefaultMetrics();

// Custom metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5]
});

const httpRequests = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status']
});

const errors = new promClient.Counter({
  name: 'errors_total',
  help: 'Total number of errors',
  labelNames: ['type', 'route']
});

const activeConnections = new promClient.Gauge({
  name: 'active_connections',
  help: 'Number of active connections'
});

// Middleware to track metrics
const metricsMiddleware = (req, res, next) => {
  const start = Date.now();
  
  activeConnections.inc();

  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route ? req.route.path : req.path;
    
    httpRequestDuration
      .labels(req.method, route, res.statusCode)
      .observe(duration);
    
    httpRequests
      .labels(req.method, route, res.statusCode)
      .inc();
    
    activeConnections.dec();
  });

  next();
};

// Error tracking middleware
const errorMiddleware = (err, req, res, next) => {
  const route = req.route ? req.route.path : req.path;
  errors.labels(err.name || 'Error', route).inc();
  next(err);
};

// Metrics endpoint
const metricsEndpoint = (req, res) => {
  res.set('Content-Type', promClient.register.contentType);
  res.end(promClient.register.metrics());
};

module.exports = {
  metricsMiddleware,
  errorMiddleware,
  metricsEndpoint,
  httpRequestDuration,
  httpRequests,
  errors,
  activeConnections
};
