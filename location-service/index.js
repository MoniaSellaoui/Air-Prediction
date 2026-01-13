// location-service/index.js

const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { Kafka } = require('kafkajs');
const NodeCache = require('node-cache');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const winston = require('winston');
const geocodingService = require('./services/geocoding');
const authMiddleware = require('./middleware/auth');
require('dotenv').config();

// === Constants ===
const PORT = process.env.LOCATION_SERVICE_PORT || 5002;
const CACHE_TTL = 300; // 5 minutes
const MAX_LOCATIONS_PER_USER = 10;

// === Logger Setup ===
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// === Cache Setup ===
const cache = new NodeCache({ stdTTL: CACHE_TTL });

// === Rate Limiting ===
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// === Database Setup ===
const db = new sqlite3.Database('./locations.db');

// Promisify database operations
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function (err) {
    if (err) reject(err);
    else resolve(this);
  });
});

const dbGet = (sql, params = []) => new Promise((resolve, reject) => {
  db.get(sql, params, (err, row) => {
    if (err) reject(err);
    else resolve(row);
  });
});

const dbAll = (sql, params = []) => new Promise((resolve, reject) => {
  db.all(sql, params, (err, rows) => {
    if (err) reject(err);
    else resolve(rows);
  });
});

// Initialize database
const initializeDatabase = async () => {
  try {
    await dbRun(`CREATE TABLE IF NOT EXISTS locations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      name TEXT NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      address TEXT,
      city TEXT,
      country TEXT,
      place_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    await dbRun('CREATE INDEX IF NOT EXISTS idx_user_locations ON locations(user_id)');
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  }
};

// === Validation ===
const validateCoordinates = ({ latitude, longitude }) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number') {
    return false;
  }
  return latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
};

const validateLocationName = (name) => {
  return typeof name === 'string' && name.trim().length >= 2;
};

// === Express App Setup ===
const app = express();

// CORS - Handle by API Gateway
/*
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
*/
app.use(bodyParser.json());
app.use(limiter);

// === API Routes ===
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Endpoint public qui retourne les villes (utilisé pour le select du frontend)
app.get('/cities', (req, res) => {
  const publicLocations = [
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

  res.json(publicLocations);
});

// Endpoint public pour la liste des villes/locations (pour le select du frontend)
app.get('/api/locations/public', async (req, res, next) => {
  try {
    // Retourner une liste de villes prédéfinies ou les locations publiques
    const publicLocations = [
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

    res.json(publicLocations);
  } catch (error) {
    next(error);
  }
});

// Endpoint alternatif public avec un chemin complètement différent
app.get('/public/cities', async (req, res, next) => {
  try {
    const publicLocations = [
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

    res.json(publicLocations);
  } catch (error) {
    next(error);
  }
});

// Routes protégées par l'authentification (uniquement les routes qui en ont besoin)
app.get('/api/locations', authMiddleware, async (req, res, next) => {
  try {
    const userId = req.user.id;
    if (!userId) {
      return res.status(400).json({ error: 'User ID missing in token' });
    }

    const locations = await dbAll(
      'SELECT * FROM locations WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json(locations);
  } catch (error) {
    next(error);
  }
});

// Get specific user's locations (API technique, conserve pour compatibilité)
app.get('/api/locations/:userId', authMiddleware, async (req, res, next) => {
  try {
    // Vérifier que l'utilisateur accède à ses propres données
    const userIdFromToken = req.user.id;
    if (!userIdFromToken || req.params.userId !== userIdFromToken) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    const locations = await dbAll(
      'SELECT * FROM locations WHERE user_id = ? ORDER BY created_at DESC',
      [req.params.userId]
    );
    res.json(locations);
  } catch (error) {
    next(error);
  }
});

// Add new location
app.post('/api/locations', authMiddleware, async (req, res, next) => {
  try {
    // On déduit l'utilisateur à partir du token JWT
    const userId = req.user.id;
    const { name, address, latitude, longitude, city } = req.body;

    // Validate input
    if (!userId || !name) {
      return res.status(400).json({ error: 'User ID and name are required' });
    }

    // Check location limit
    const count = await dbGet(
      'SELECT COUNT(*) as count FROM locations WHERE user_id = ?',
      [userId]
    );
    if (count.count >= MAX_LOCATIONS_PER_USER) {
      return res.status(400).json({ error: `Maximum ${MAX_LOCATIONS_PER_USER} locations allowed per user` });
    }

    let locationData;
    // On utilise en priorité une adresse explicite, sinon la ville, sinon le nom
    const addressOrCity = address || city || name;
    if (addressOrCity) {
      // Geocode adresse / ville
      locationData = await geocodingService.geocode(addressOrCity);
    } else if (latitude !== undefined && longitude !== undefined) {
      // Validate coordinates
      if (!validateCoordinates({ latitude, longitude })) {
        return res.status(400).json({ error: 'Invalid coordinates' });
      }
      // Reverse geocode coordinates
      locationData = await geocodingService.reverseGeocode({ latitude, longitude });
      locationData.latitude = latitude;
      locationData.longitude = longitude;
    } else {
      return res.status(400).json({ error: 'Either address or coordinates are required' });
    }

    // Save to database
    const result = await dbRun(
      `INSERT INTO locations (
        user_id, name, latitude, longitude, address, city, country, place_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)` ,
      [
        userId,
        name,
        locationData.latitude,
        locationData.longitude,
        locationData.address,
        // si le geocoder ne renvoie pas de ville, on retombe sur city ou name
        locationData.city || city || name,
        locationData.country,
        locationData.place_id
      ]
    );

    const location = await dbGet('SELECT * FROM locations WHERE id = ?', [result.lastID]);
    res.status(201).json(location);
  } catch (error) {
    logger.error('Error adding location:', error);
    next(error);
  }
});

// Update location
app.put('/api/locations/:id', authMiddleware, async (req, res, next) => {
  try {
    const { name, address } = req.body;
    const locationId = req.params.id;

    // Validate input
    if (!validateLocationName(name)) {
      return res.status(400).json({ error: 'Invalid location name' });
    }

    let locationData = null;
    if (address) {
      locationData = await geocodingService.geocode(address);
    }

    if (locationData) {
      await dbRun(
        `UPDATE locations SET 
          name = ?, 
          latitude = ?, 
          longitude = ?, 
          address = ?, 
          city = ?, 
          country = ?,
          place_id = ?,
          updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?`,
        [
          name,
          locationData.latitude,
          locationData.longitude,
          locationData.address,
          locationData.city,
          locationData.country,
          locationData.place_id,
          locationId
        ]
      );
    } else {
      await dbRun(
        'UPDATE locations SET name = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, locationId]
      );
    }

    const location = await dbGet('SELECT * FROM locations WHERE id = ?', [locationId]);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }

    res.json(location);
  } catch (error) {
    logger.error('Error updating location:', error);
    next(error);
  }
});

// Delete location
app.delete('/api/locations/:id', authMiddleware, async (req, res, next) => {
  try {
    const result = await dbRun('DELETE FROM locations WHERE id = ?', [req.params.id]);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// === Error Handler ===
app.use((err, req, res, next) => {
  logger.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// === Startup ===
const startServer = async () => {
  try {
    await initializeDatabase();

    app.listen(PORT, () => {
      logger.info(`Location Service running at http://localhost:${PORT}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// === Graceful Shutdown ===
const shutdown = async () => {
  logger.info('Shutting down gracefully...');
  try {
    await db.close();
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (err) => {
  logger.error('Unhandled rejection:', err);
  process.exit(1);
});

startServer();
