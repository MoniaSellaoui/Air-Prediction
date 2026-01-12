// api-gateway/index.js

const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const winston = require('winston');
const rateLimit = require('express-rate-limit');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
require('dotenv').config();

// === Constants ===
const PORT = process.env.API_GATEWAY_PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_par_defaut';
const SERVICES = {
  LOCATION: process.env.LOCATION_SERVICE_URL || 'http://localhost:5002',
  USER: process.env.USER_SERVICE_URL || 'http://localhost:5000',
  AQI: process.env.AQI_SERVICE_URL || 'http://localhost:5003',
  NOTIFICATION: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:5004',
  AI: process.env.AI_SERVICE_URL || 'http://localhost:5005'
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

// Middleware de base
app.use(cors({
  origin: ['http://localhost:5173', 'http://127.0.0.1:5173', process.env.CORS_ORIGIN].filter(Boolean),
  credentials: true
}));
app.use(bodyParser.json());
app.use(cookieParser());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limite chaque IP à 100 requêtes par fenêtre
});
app.use(limiter);

// === Auth Middleware ===
const authMiddleware = (req, res, next) => {
  try {
    const token = req.cookies.token || req.headers.authorization?.split(' ')[1];
    if (!token) {
      return res.status(401).json({ error: 'Token manquant' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    logger.error('Erreur d\'authentification:', error);
    return res.status(401).json({ error: 'Token invalide' });
  }
};

// === Routes publiques ===
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Endpoint public pour les locations (sans authentification)
app.get('/api/locations/public', createProxyMiddleware({
  target: SERVICES.LOCATION,
  changeOrigin: true,
  pathRewrite: {
    '^/api/locations/public': '/api/locations/public'
  },
  onProxyRes: (proxyRes, req, res) => {
    // Fix CORS headers
    const origin = req.headers.origin;
    if (origin && ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin)) {
      proxyRes.headers['access-control-allow-origin'] = origin;
      proxyRes.headers['access-control-allow-credentials'] = 'true';
    }
  }
}));

// Endpoint public pour les cities (direct dans l'API Gateway)
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
  
  // CORS headers
  const origin = req.headers.origin;
  if (origin && ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174'].includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  res.json(cities);
});

// Routes d'authentification
const authProxy = createProxyMiddleware({
  target: SERVICES.USER,
  changeOrigin: true,
  ws: true,
  secure: false,
  pathRewrite: {
    '^/auth': '/auth'
  },
  proxyTimeout: 30000,
  timeout: 30000,
  onError: (err, req, res) => {
    logger.error('Proxy error:', err);
    if (!res.headersSent) {
      res.status(500).json({
        error: 'Service temporairement indisponible',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  },
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    logger.info(`Proxying ${req.method} request to ${proxyReq.path}`);
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Fix CORS headers to allow specific origin with credentials
    const origin = req.headers.origin;
    if (origin && ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin)) {
      proxyRes.headers['access-control-allow-origin'] = origin;
      proxyRes.headers['access-control-allow-credentials'] = 'true';
      proxyRes.headers['access-control-allow-methods'] = 'GET, POST, PUT, DELETE, OPTIONS';
      proxyRes.headers['access-control-allow-headers'] = 'Content-Type, Authorization';
    }
  }
});

// Appliquer le proxy aux routes d'authentification
app.post('/auth/register', authProxy);
app.post('/auth/login', authProxy);

// === Proxy vers les services ===

// Service de localisation
app.use('/api/locations', authMiddleware, createProxyMiddleware({
  target: SERVICES.LOCATION,
  changeOrigin: true,
  pathRewrite: {
    '^/api/locations': '/api/locations'
  },
  onProxyReq: (proxyReq, req) => {
    // Ajouter le token pour le service de localisation
    if (req.user) {
      proxyReq.setHeader('Authorization', `Bearer ${jwt.sign(req.user, JWT_SECRET)}`);
    }
  },
  onProxyRes: (proxyRes, req, res) => {
    // Fix CORS headers
    const origin = req.headers.origin;
    if (origin && ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin)) {
      proxyRes.headers['access-control-allow-origin'] = origin;
      proxyRes.headers['access-control-allow-credentials'] = 'true';
    }
  }
}));

// Service AQI
app.use('/api/aqi', authMiddleware, createProxyMiddleware({
  target: SERVICES.AQI,
  changeOrigin: true,
  // On conserve le préfixe /api/aqi pour que cela corresponde au service AQI
  pathRewrite: {
    '^/api/aqi': '/api/aqi'
  },
  onProxyRes: (proxyRes, req, res) => {
    // Fix CORS headers
    const origin = req.headers.origin;
    if (origin && ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin)) {
      proxyRes.headers['access-control-allow-origin'] = origin;
      proxyRes.headers['access-control-allow-credentials'] = 'true';
    }
  }
}));

// Service AI
app.use('/api/ai', authMiddleware, createProxyMiddleware({
  target: SERVICES.AI,
  changeOrigin: true,
  pathRewrite: {
    '^/api/ai': '/api/ai'
  },
  onProxyRes: (proxyRes, req, res) => {
    // Fix CORS headers
    const origin = req.headers.origin;
    if (origin && ['http://localhost:5173', 'http://127.0.0.1:5173'].includes(origin)) {
      proxyRes.headers['access-control-allow-origin'] = origin;
      proxyRes.headers['access-control-allow-credentials'] = 'true';
    }
  }
}));

// Service de notification
app.use('/api/notifications', authMiddleware, createProxyMiddleware({
  target: SERVICES.NOTIFICATION,
  changeOrigin: true,
  pathRewrite: {
    '^/api/notifications': '/api'
  }
}));

// === Error Handler ===
app.use((err, req, res, next) => {
  logger.error('Erreur non gérée:', err);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// === Démarrage du serveur ===
app.listen(PORT, () => {
  logger.info(`API Gateway en cours d'exécution sur http://localhost:${PORT}`);
  logger.info('Services configurés:', SERVICES);
});
