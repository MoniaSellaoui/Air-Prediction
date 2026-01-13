// api-gateway/index.js

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const { metricsMiddleware, errorMiddleware, metricsEndpoint } = require('./middleware/metrics');
require('dotenv').config();

// === Constants ===
const PORT = process.env.API_GATEWAY_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'votre_super_secret_jwt_2024';
const SERVICES = {
  LOCATION: process.env.LOCATION_SERVICE_URL || 'http://location-service:5002',
  USER: process.env.USER_SERVICE_URL || 'http://user-service:5000',
  AQI: process.env.AQI_SERVICE_URL || 'http://aqi-service:5003',
  NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL || 'http://notification-service:5004',
  AI: process.env.AI_SERVICE_URL || 'http://ai-service:5005'
};

// === Logger Setup ===
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// === Express App Setup ===
const app = express();

// Basic Middleware
app.use(bodyParser.json());
app.use(cookieParser());
app.use(metricsMiddleware);

// CORS configuration - explicit origins required when using credentials
// CORS configuration - explicit origins required when using credentials
const corsOptions = {
  origin: function (origin, callback) {
    const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) === -1) {
      const msg = 'The CORS policy for this site does not allow access from the specified Origin.';
      return callback(new Error(msg), false);
    }
    return callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};

app.use(cors(corsOptions));

// Preflight OPTIONS handler
app.options('*', cors(corsOptions));

// Request Logging Middleware
app.use((req, res, next) => {
  if (req.url !== '/health') {
    const hasAuthHeader = !!req.headers.authorization;
    const hasCookie = !!(req.cookies && req.cookies.token);
    logger.info(`${req.method} ${req.url} - Origin: ${req.headers.origin} - Auth: ${hasAuthHeader} - Cookie: ${hasCookie}`);
    if (req.method === 'POST' || req.method === 'PUT') {
      logger.info(`Body: ${JSON.stringify(req.body)}`);
    }
  }
  next();
});

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000
});
app.use(limiter);

// === Auth Middleware ===
const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    // Priorité au header Authorization (Bearer token)
    let token = authHeader?.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;
    let source = 'Header';

    // Si pas de header, on regarde dans les cookies
    if (!token && req.cookies.token) {
      token = req.cookies.token;
      source = 'Cookie';
    }

    if (!token) {
      logger.warn(`Auth failed: No token found for ${req.url}`);
      return res.status(401).json({ error: 'Token manquant' });
    }

    // Protection contre les tokens qui sont en fait des chaînes de texte bizarres
    if (token === 'undefined' || token === 'null' || token.length < 10) {
      logger.warn(`Auth failed: Malformed token string (${token}) from ${source} for ${req.url}`);
      return res.status(401).json({ error: 'Token malformé' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    const authHeader = req.headers.authorization;
    const tokenHint = authHeader ? authHeader.substring(0, 15) + '...' : (req.cookies.token ? 'Cookie present' : 'None');
    logger.warn(`Auth failed: Invalid token for ${req.url} - Error: ${error.message} - Token hint: ${tokenHint}`);
    return res.status(401).json({ error: 'Token invalide' });
  }
};

// Health Check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Metrics endpoint
app.get('/metrics', metricsEndpoint);

// Cities endpoint (direct)
app.get('/cities', (req, res) => {
  const cities = [
    { id: 1, name: 'Paris', latitude: 48.8566, longitude: 2.3522, city: 'Paris' },
    { id: 2, name: 'Lyon', latitude: 45.7640, longitude: 4.8357, city: 'Lyon' },
    { id: 3, name: 'Marseille', latitude: 43.2965, longitude: 5.3698, city: 'Marseille' },
    { id: 4, name: 'Toulouse', latitude: 43.6047, longitude: 1.4442, city: 'Toulouse' },
    { id: 5, name: 'Nice', latitude: 43.7102, longitude: 7.2620, city: 'Nice' },
    { id: 6, name: 'Nantes', latitude: 47.2184, longitude: -1.5536, city: 'Nantes' },
    { id: 7, name: 'Strasbourg', latitude: 48.5846, longitude: 7.7507, city: 'Strasbourg' },
    { id: 8, name: 'Bordeaux', latitude: 44.8378, longitude: -0.5792, city: 'Bordeaux' },
    { id: 9, name: 'Lille', latitude: 50.6292, longitude: 3.0573, city: 'Lille' },
    { id: 10, name: 'Rennes', latitude: 48.1173, longitude: -1.6778, city: 'Rennes' }
  ];
  res.json(cities);
});

// Proxy logic
const createLoggingProxy = (target, options = {}) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    onProxyReq: (proxyReq, req, res) => {
      if (options.addAuth && req.user) {
        proxyReq.setHeader('Authorization', `Bearer ${jwt.sign(req.user, JWT_SECRET)}`);
      }
      fixRequestBody(proxyReq, req);
    },
    onProxyRes: (proxyRes, req, res) => {
      // Strip upstream CORS headers to let Gateway handle it
      delete proxyRes.headers['access-control-allow-origin'];
      delete proxyRes.headers['access-control-allow-methods'];
      delete proxyRes.headers['access-control-allow-headers'];
      delete proxyRes.headers['access-control-allow-credentials'];
    },
    ...options
  });
};

// Route assignments
app.use('/auth', createLoggingProxy(SERVICES.USER));
app.use('/api/locations/public', createLoggingProxy(SERVICES.LOCATION));
app.use('/api/locations', authMiddleware, createLoggingProxy(SERVICES.LOCATION, { addAuth: true }));
app.use('/api/aqi', authMiddleware, createLoggingProxy(SERVICES.AQI, { addAuth: true }));
app.use('/api/ai', authMiddleware, createLoggingProxy(SERVICES.AI, { addAuth: true }));
app.use('/api/notifications', authMiddleware, createLoggingProxy(SERVICES.NOTIFICATION, {
  addAuth: true
}));

// Error Handler
app.use(errorMiddleware);
app.use((err, req, res, next) => {
  logger.error('Gateway Error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'Internal Gateway Error' });
  }
});

app.listen(PORT, () => {
  logger.info(`API Gateway live on port ${PORT}`);
});
