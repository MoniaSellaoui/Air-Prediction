// aqi-service/index.js

const express = require('express');
const bodyParser = require('body-parser');
const sqlite3 = require('sqlite3').verbose();
const { Kafka } = require('kafkajs');
const fetch = require('node-fetch');
const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const cors = require('cors');
const NodeCache = require('node-cache');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

// === Constants ===
const PORT = process.env.AQI_SERVICE_PORT || 5001;
const CACHE_TTL = 300; // 5 minutes
const API_KEY = process.env.AQICN_API_KEY;
const API_URL = 'https://api.waqi.info/feed';

// === Cache Setup ===
const cache = new NodeCache({ stdTTL: CACHE_TTL });

// === Rate Limiting ===
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});

// === Database Setup ===
const db = new sqlite3.Database('./aqi.db');

// Promisify database operations
const dbRun = (sql, params = []) => new Promise((resolve, reject) => {
  db.run(sql, params, function(err) {
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
    await dbRun(`CREATE TABLE IF NOT EXISTS aqi_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      location TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      aqi REAL NOT NULL,
      bucket TEXT NOT NULL,
      temperature REAL,
      humidity REAL,
      wind_speed REAL,
      pollutants JSON
    )`);

    await dbRun('CREATE INDEX IF NOT EXISTS idx_location_timestamp ON aqi_data(location, timestamp)');
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
};

// === AQI Calculation Utilities ===
const calculateAQIBucket = (aqi) => {
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for Sensitive Groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very Unhealthy';
  return 'Hazardous';
};

// === Input Validation ===
const validateLocation = (location) => {
  return location && typeof location === 'string' && location.length >= 2;
};

// === Error Handler ===
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// === Kafka Setup ===
const kafka = new Kafka({
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const consumer = kafka.consumer({ groupId: 'aqi-group' });

const setupKafkaConsumer = async () => {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'aqi-data', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          await dbRun(
            'INSERT INTO aqi_data (location, aqi, bucket, temperature, humidity, wind_speed, pollutants) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              data.location,
              data.aqi,
              calculateAQIBucket(data.aqi),
              data.temperature,
              data.humidity,
              data.wind_speed,
              JSON.stringify(data.pollutants)
            ]
          );
          // Invalidate cache for this location
          cache.del(data.location);
        } catch (error) {
          console.error('Error processing Kafka message:', error);
        }
      },
    });
  } catch (error) {
    console.error('Failed to setup Kafka consumer:', error);
    process.exit(1);
  }
};

// === External API Integration ===
const fetchExternalAQI = async (location) => {
  try {
    const response = await fetch(`${API_URL}/${location}/?token=${API_KEY}`);
    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }
    
    const data = await response.json();
    if (data.status !== 'ok') {
      throw new Error('Invalid response from external API');
    }

    return {
      location,
      aqi: data.data.aqi,
      bucket: calculateAQIBucket(data.data.aqi),
      temperature: data.data.iaqi.t?.v,
      humidity: data.data.iaqi.h?.v,
      wind_speed: data.data.iaqi.w?.v,
      pollutants: {
        pm25: data.data.iaqi.pm25?.v,
        pm10: data.data.iaqi.pm10?.v,
        o3: data.data.iaqi.o3?.v,
        no2: data.data.iaqi.no2?.v,
        so2: data.data.iaqi.so2?.v,
        co: data.data.iaqi.co?.v
      }
    };
  } catch (error) {
    console.error(`Error fetching AQI data for ${location}:`, error);
    throw error;
  }
};

// === Express App Setup ===
const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(bodyParser.json());
app.use(limiter);

// === Health Check ===
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    kafka: consumer.isRunning()
  });
});

// === REST Endpoints ===
app.get('/api/aqi/:location', async (req, res, next) => {
  try {
    const location = req.params.location.trim();
    
    if (!validateLocation(location)) {
      return res.status(400).json({ error: 'Invalid location format' });
    }

    // Check cache first
    const cachedData = cache.get(location);
    if (cachedData) {
      return res.json(cachedData);
    }

    // Get from database
    const data = await dbGet(
      'SELECT * FROM aqi_data WHERE location = ? ORDER BY timestamp DESC LIMIT 1',
      [location]
    );

    if (data) {
      // Store in cache and return
      cache.set(location, data);
      return res.json(data);
    }

    // If not in DB, fetch from external API
    const externalData = await fetchExternalAQI(location);
    await dbRun(
      'INSERT INTO aqi_data (location, aqi, bucket, temperature, humidity, wind_speed, pollutants) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        location,
        externalData.aqi,
        externalData.bucket,
        externalData.temperature,
        externalData.humidity,
        externalData.wind_speed,
        JSON.stringify(externalData.pollutants)
      ]
    );

    cache.set(location, externalData);
    res.json(externalData);
  } catch (error) {
    next(error);
  }
});

// === GraphQL Setup ===
const typeDefs = `#graphql
  type Pollutants {
    pm25: Float
    pm10: Float
    o3: Float
    no2: Float
    so2: Float
    co: Float
  }

  type AQI {
    location: String!
    timestamp: String!
    aqi: Float!
    bucket: String!
    temperature: Float
    humidity: Float
    wind_speed: Float
    pollutants: Pollutants
  }

  type Query {
    aqi(location: String!): AQI
    aqiHistory(location: String!, limit: Int): [AQI]
  }
`;

const resolvers = {
  Query: {
    aqi: async (_, { location }) => {
      if (!validateLocation(location)) {
        throw new Error('Invalid location format');
      }

      const cachedData = cache.get(location);
      if (cachedData) return cachedData;

      const data = await dbGet(
        'SELECT * FROM aqi_data WHERE location = ? ORDER BY timestamp DESC LIMIT 1',
        [location]
      );

      if (data) {
        cache.set(location, data);
        return data;
      }

      const externalData = await fetchExternalAQI(location);
      await dbRun(
        'INSERT INTO aqi_data (location, aqi, bucket, temperature, humidity, wind_speed, pollutants) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [
          location,
          externalData.aqi,
          externalData.bucket,
          externalData.temperature,
          externalData.humidity,
          externalData.wind_speed,
          JSON.stringify(externalData.pollutants)
        ]
      );

      cache.set(location, externalData);
      return externalData;
    },
    aqiHistory: async (_, { location, limit = 24 }) => {
      if (!validateLocation(location)) {
        throw new Error('Invalid location format');
      }

      return await dbAll(
        'SELECT * FROM aqi_data WHERE location = ? ORDER BY timestamp DESC LIMIT ?',
        [location, limit]
      );
    }
  }
};

const startApolloServer = async () => {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    formatError: (error) => {
      console.error(error);
      return new Error('Internal server error');
    },
  });

  await server.start();
  app.use('/graphql', expressMiddleware(server, {
    context: async ({ req }) => ({ token: req.headers.authorization })
  }));
};

// === Error Handling ===
app.use(errorHandler);

// === Startup ===
const startServer = async () => {
  try {
    await initializeDatabase();
    await setupKafkaConsumer();
    await startApolloServer();

    app.listen(PORT, () => {
      console.log(`AQI Service running at http://localhost:${PORT}`);
      console.log(`GraphQL endpoint: http://localhost:${PORT}/graphql`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// === Graceful Shutdown ===
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  try {
    await consumer.disconnect();
    await db.close();
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

startServer();
