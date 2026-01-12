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
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const path = require('path');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// === Constants ===
const PORT = process.env.AQI_SERVICE_PORT || 5001;
const JWT_SECRET = process.env.JWT_SECRET || 'votre_secret_par_defaut';
const CACHE_TTL = 300; // 5 minutes
const API_KEY = process.env.AQICN_API_KEY;
const API_URL = 'https://api.waqi.info/feed';
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://model-serving:8000';

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

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader) {
    try {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      console.warn('Invalid token in aqi-service:', err.message);
    }
  }
  next();
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
const producer = kafka.producer();

const checkAndEmitAlerts = async (data, userId = 'system') => {
  const alerts = [];
  if (data.aqi > 150) alerts.push(`High Pollution (AQI: ${data.aqi})`);
  if (data.temperature > 35) alerts.push(`High Temperature (${data.temperature}°C)`);
  if (data.humidity > 85) alerts.push(`High Humidity (${data.humidity}%)`);

  if (alerts.length > 0) {
    console.log(`!!! ALERT DETECTED for ${data.location}: ${alerts.join(', ')}`);
    try {
      await producer.send({
        topic: 'alerts',
        messages: [{
          value: JSON.stringify({
            user_id: userId,
            location: data.location,
            aqi: data.aqi,
            bucket: data.bucket,
            content: `🚨 Environmental Alert for ${data.location}: ${alerts.join(' & ')}`,
            timestamp: new Date().toISOString()
          })
        }]
      });
    } catch (error) {
      console.error('Failed to emit alert:', error);
    }
  }
};

const setupKafkaConsumer = async () => {
  try {
    await consumer.connect();
    await consumer.subscribe({ topic: 'aqi-data', fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ message }) => {
        try {
          const data = JSON.parse(message.value.toString());

          // Enrich with AI prediction if pollutants available
          let aiAqi = null;
          if (data.pollutants) {
            aiAqi = await getAiPrediction(data.pollutants);
          }

          const finalAqi = aiAqi !== null ? aiAqi : data.aqi;

          await dbRun(
            'INSERT INTO aqi_data (location, aqi, bucket, temperature, humidity, wind_speed, pollutants) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [
              data.location,
              finalAqi,
              calculateAQIBucket(finalAqi),
              data.temperature,
              data.humidity,
              data.wind_speed,
              JSON.stringify(data.pollutants || {})
            ]
          );
          // Invalidate cache for this location
          cache.del(data.location);

          // Check for alerts
          await checkAndEmitAlerts({
            ...data,
            aqi: finalAqi,
            bucket: calculateAQIBucket(finalAqi)
          }, data.user_id || 'system');
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

// === AI Service Integration ===
const getAiPrediction = async (pollutants) => {
  try {
    // Model expects 12 features: PM2.5, PM10, NO, NO2, NOx, NH3, CO, SO2, O3, Benzene, Toluene, Xylene
    const features = [
      pollutants.pm25 || 0,
      pollutants.pm10 || 0,
      0, // NO (not usually in WAQI)
      pollutants.no2 || 0,
      0, // NOx
      0, // NH3
      pollutants.co || 0,
      pollutants.so2 || 0,
      pollutants.o3 || 0,
      0, // Benzene
      0, // Toluene
      0  // Xylene
    ];

    const response = await fetch(`${AI_SERVICE_URL}/predict`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ features })
    });

    if (!response.ok) {
      console.warn(`AI Service responded with ${response.status}. Using external AQI.`);
      return null;
    }

    const result = await response.json();
    return result.aqi_prediction;
  } catch (error) {
    console.error('Error calling AI Service:', error);
    return null;
  }
};

// === gRPC Setup ===
const PROTO_PATH = path.join(__dirname, 'protos', 'aqi.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true,
});
const aqiProto = grpc.loadPackageDefinition(packageDefinition).aqi;

const getAQIGrpc = async (call, callback) => {
  try {
    const location = call.request.location;
    if (!validateLocation(location)) {
      return callback({
        code: grpc.status.INVALID_ARGUMENT,
        message: 'Invalid location format',
      });
    }

    const data = await dbGet(
      'SELECT * FROM aqi_data WHERE location = ? ORDER BY timestamp DESC LIMIT 1',
      [location]
    );

    if (data) {
      return callback(null, {
        location: data.location,
        index: data.aqi,
        bucket: data.bucket,
      });
    }

    // Attempt to fetch from external API if not found
    try {
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
      return callback(null, {
        location: externalData.location,
        index: externalData.aqi,
        bucket: externalData.bucket,
      });
    } catch (err) {
      return callback({
        code: grpc.status.NOT_FOUND,
        message: 'AQI data not found for location',
      });
    }
  } catch (error) {
    console.error('gRPC Error:', error);
    callback({
      code: grpc.status.INTERNAL,
      message: 'Internal server error',
    });
  }
};

const startGrpcServer = () => {
  const server = new grpc.Server();
  server.addService(aqiProto.AqiService.service, { getAQI: getAQIGrpc });
  const grpcPort = process.env.GRPC_PORT || '50051';
  server.bindAsync(`0.0.0.0:${grpcPort}`, grpc.ServerCredentials.createInsecure(), (err, port) => {
    if (err) {
      console.error('gRPC binding failed:', err);
      return;
    }
    console.log(`gRPC Server running at http://0.0.0.0:${port}`);
  });
};

// === External API Integration ===
const fetchExternalAQI = async (location) => {
  try {
    const response = await fetch(`${API_URL}/${location}/?token=${API_KEY}`);
    let data;

    if (response.ok) {
      data = await response.json();
    }

    if (!response.ok || data.status !== 'ok') {
      console.warn(`External API failed or key missing for ${location}. Using MOCK data for demo.`);
      data = {
        status: 'ok',
        data: {
          aqi: 42, // Dummy external AQI
          iaqi: {
            pm25: { v: Math.random() * 100 },
            pm10: { v: Math.random() * 80 },
            o3: { v: Math.random() * 60 },
            no2: { v: Math.random() * 40 },
            so2: { v: Math.random() * 20 },
            co: { v: Math.random() * 5 }
          }
        }
      };
    }

    // Enrich with AI prediction
    const pollutants = {
      pm25: data.data.iaqi.pm25?.v,
      pm10: data.data.iaqi.pm10?.v,
      o3: data.data.iaqi.o3?.v,
      no2: data.data.iaqi.no2?.v,
      so2: data.data.iaqi.so2?.v,
      co: data.data.iaqi.co?.v
    };

    const aiAqi = await getAiPrediction(pollutants);

    return {
      location,
      aqi: aiAqi !== null ? aiAqi : data.data.aqi,
      external_aqi: data.data.aqi,
      ai_powered: aiAqi !== null,
      bucket: calculateAQIBucket(aiAqi !== null ? aiAqi : data.data.aqi),
      temperature: data.data.iaqi.t?.v,
      humidity: data.data.iaqi.h?.v,
      wind_speed: data.data.iaqi.w?.v,
      pollutants
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
app.get('/api/aqi/:location', authMiddleware, async (req, res, next) => {
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

    const externalData = await fetchExternalAQI(location);
    const finalData = {
      location,
      aqi: externalData.aqi,
      bucket: externalData.bucket,
      temperature: externalData.temperature,
      humidity: externalData.humidity,
      wind_speed: externalData.wind_speed,
      pollutants: JSON.stringify(externalData.pollutants)
    };

    await dbRun(
      'INSERT INTO aqi_data (location, aqi, bucket, temperature, humidity, wind_speed, pollutants) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        finalData.location,
        finalData.aqi,
        finalData.bucket,
        finalData.temperature,
        finalData.humidity,
        finalData.wind_speed,
        finalData.pollutants
      ]
    );

    cache.set(location, externalData);

    // Check for alerts
    await checkAndEmitAlerts(externalData, req.user?.id || 'system');

    res.json(externalData);
  } catch (error) {
    next(error);
  }
});

app.get('/api/aqi/history/:location', async (req, res, next) => {
  try {
    const location = req.params.location.trim();
    const limit = parseInt(req.query.limit) || 24;

    if (!validateLocation(location)) {
      return res.status(400).json({ error: 'Invalid location format' });
    }

    const data = await dbAll(
      'SELECT * FROM aqi_data WHERE location = ? ORDER BY timestamp DESC LIMIT ?',
      [location, limit]
    );

    res.json(data.reverse()); // Reverse to have chronological order for chart
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
    await producer.connect();
    console.log('Kafka producer connected');
    await setupKafkaConsumer();
    await startApolloServer();
    startGrpcServer();

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
    await producer.disconnect();
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

if (require.main === module) {
  startServer();
}

module.exports = { app, db, calculateAQIBucket };
