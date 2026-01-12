// user-service/index.js

const express = require('express');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const sqlite3 = require('sqlite3').verbose();
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
require('dotenv').config();

// === Constants ===
const PORT = process.env.USER_SERVICE_PORT || 5000;
const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET || 'default_secret';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '24h';

// === Database Setup ===
const db = new sqlite3.Database('./users.db');

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

// Initialize database
db.serialize(async () => {
  try {
    await dbRun(`CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      phone TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
    
    // Add indexes for performance
    await dbRun('CREATE INDEX IF NOT EXISTS idx_email ON users(email)');
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization failed:', error);
    process.exit(1);
  }
});

// === Input Validation ===
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validatePassword = (password) => {
  return password && password.length >= 8;
};

const validatePhone = (phone) => {
  const phoneRegex = /^\+?[\d\s-]{10,}$/;
  return !phone || phoneRegex.test(phone);
};

// === Error Handler ===
const errorHandler = (err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
};

// === gRPC Server Implementation ===
const packageDef = protoLoader.loadSync('protos/user.proto', {
  keepCase: true,
  longs: String,
  enums: String,
  defaults: true,
  oneofs: true
});

const userProto = grpc.loadPackageDefinition(packageDef).user;

const server = new grpc.Server();

server.addService(userProto.UserService.service, {
  async GetUser(call, callback) {
    try {
      const user = await dbGet('SELECT id, name, email, phone, created_at, updated_at FROM users WHERE id = ?', [call.request.id]);
      if (!user) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'User not found'
        });
      }
      callback(null, user);
    } catch (error) {
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  async CreateUser(call, callback) {
    try {
      const { email, password, name, phone } = call.request;

      // Validation
      if (!email || !password || !name) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Missing required fields'
        });
      }

      if (!validateEmail(email)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Invalid email format'
        });
      }

      if (!validatePassword(password)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Password must be at least 8 characters long'
        });
      }

      if (phone && !validatePhone(phone)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Invalid phone number format'
        });
      }

      // Check if email already exists
      const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
      if (existingUser) {
        return callback({
          code: grpc.status.ALREADY_EXISTS,
          message: 'Email already registered'
        });
      }

      const id = uuidv4();
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      await dbRun(
        'INSERT INTO users (id, name, email, password, phone) VALUES (?, ?, ?, ?, ?)',
        [id, name, email, hashedPassword, phone || null]
      );

      const user = await dbGet(
        'SELECT id, name, email, phone, created_at, updated_at FROM users WHERE id = ?',
        [id]
      );

      callback(null, user);
    } catch (error) {
      console.error('CreateUser error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  async AuthenticateUser(call, callback) {
    try {
      const { email, password } = call.request;

      if (!email || !password) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Email and password are required'
        });
      }

      const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
      if (!user) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'Invalid credentials'
        });
      }

      const validPassword = await bcrypt.compare(password, user.password);
      if (!validPassword) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Invalid credentials'
        });
      }

      const token = jwt.sign(
        { id: user.id, email: user.email },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRATION }
      );

      callback(null, {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name
        }
      });
    } catch (error) {
      console.error('AuthenticateUser error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  },

  async UpdateUser(call, callback) {
    try {
      const { id, name, phone } = call.request;

      if (!id || !name) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'ID and name are required'
        });
      }

      if (phone && !validatePhone(phone)) {
        return callback({
          code: grpc.status.INVALID_ARGUMENT,
          message: 'Invalid phone number format'
        });
      }

      const result = await dbRun(
        'UPDATE users SET name = ?, phone = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [name, phone || null, id]
      );

      if (result.changes === 0) {
        return callback({
          code: grpc.status.NOT_FOUND,
          message: 'User not found'
        });
      }

      const updatedUser = await dbGet(
        'SELECT id, name, email, phone, created_at, updated_at FROM users WHERE id = ?',
        [id]
      );

      callback(null, updatedUser);
    } catch (error) {
      console.error('UpdateUser error:', error);
      callback({
        code: grpc.status.INTERNAL,
        message: 'Internal server error'
      });
    }
  }
});

// === Express App Setup ===
const app = express();

// Augmenter la limite de payload
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configuration du body-parser avec des limites plus élevées
app.use(bodyParser.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));

app.use(bodyParser.urlencoded({
  extended: true,
  limit: '10mb'
}));

// Middleware pour gérer les timeouts
app.use((req, res, next) => {
  // Augmenter le timeout à 30 secondes
  req.setTimeout(30000);
  res.setTimeout(30000);
  
  // Gérer les événements de timeout
  req.on('timeout', () => {
    console.error('Request timeout');
    if (!res.headersSent) {
      res.status(408).json({ error: 'Request timeout' });
    }
  });

  // Gérer les déconnexions client
  req.on('close', () => {
    if (!res.headersSent) {
      console.log('Client disconnected');
    }
  });

  next();
});

// Middleware de logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// === REST Endpoints ===
app.post('/auth/register', async (req, res) => {
  try {
    console.log('Received registration request:', req.body);
    const { email, password, name, phone } = req.body;

    // Validation
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!validateEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (!validatePassword(password)) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    if (phone && !validatePhone(phone)) {
      return res.status(400).json({ error: 'Invalid phone number format' });
    }

    // Check if email already exists
    const existingUser = await dbGet('SELECT id FROM users WHERE email = ?', [email]);
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    await dbRun(
      'INSERT INTO users (id, name, email, password, phone) VALUES (?, ?, ?, ?, ?)',
      [id, name, email, hashedPassword, phone || null]
    );

    const user = await dbGet(
      'SELECT id, name, email, phone, created_at, updated_at FROM users WHERE id = ?',
      [id]
    );

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    res.status(201).json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRATION }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Error handling middleware
app.use(errorHandler);

// Start both gRPC and REST servers
server.bindAsync(
  `0.0.0.0:${parseInt(PORT) + 1000}`,
  grpc.ServerCredentials.createInsecure(),
  (error, port) => {
    if (error) {
      console.error('Failed to start gRPC server:', error);
      return;
    }
    server.start();
    console.log(`gRPC server running at http://0.0.0.0:${port}`);
  }
);

app.listen(PORT, () => {
  console.log(`REST server running at http://0.0.0.0:${PORT}`);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Closing database and shutting down...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err);
      process.exit(1);
    }
    process.exit(0);
  });
});

process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});
