// notification-service/index.js

const { Kafka } = require('kafkajs');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const twilio = require('twilio');
const nodemailer = require('nodemailer');
const sqlite3 = require('sqlite3').verbose();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
require('dotenv').config();

// === Constants ===
const PORT = process.env.NOTIFICATION_SERVICE_PORT || 5003;
const MAX_RETRIES = 3;
const RETRY_DELAY = 5000; // 5 seconds
const RETRY_BACKOFF_MULTIPLIER = 2;

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

// === Database Setup ===
const db = new sqlite3.Database('./notifications.db');

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
    await dbRun(`CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      channel TEXT NOT NULL,
      content TEXT NOT NULL,
      status TEXT NOT NULL,
      error TEXT,
      retry_count INTEGER DEFAULT 0,
      next_retry DATETIME,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sent_at DATETIME
    )`);

    await dbRun('CREATE INDEX IF NOT EXISTS idx_user_notifications ON notifications(user_id, created_at)');
    await dbRun('CREATE INDEX IF NOT EXISTS idx_retry_notifications ON notifications(status, next_retry)');
    logger.info('Database initialized successfully');
  } catch (error) {
    logger.error('Database initialization failed:', error);
    process.exit(1);
  }
};

// === Notification Channels Setup ===
// Twilio Setup
const twilioClient = process.env.TWILIO_SID && process.env.TWILIO_TOKEN
  ? twilio(process.env.TWILIO_SID, process.env.TWILIO_TOKEN)
  : null;

// Email Setup
const emailTransporter = process.env.SMTP_HOST
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

// === Notification Handlers ===
const notificationHandlers = {
  async sms(user, content) {
    if (!twilioClient) {
      throw new Error('SMS service not configured');
    }

    if (!user.phone) {
      throw new Error('User has no phone number');
    }

    await twilioClient.messages.create({
      body: content,
      from: process.env.TWILIO_PHONE,
      to: user.phone
    });
  },

  async email(user, content) {
    if (!emailTransporter) {
      throw new Error('Email service not configured');
    }

    if (!user.email) {
      throw new Error('User has no email address');
    }

    await emailTransporter.sendMail({
      from: process.env.SMTP_FROM,
      to: user.email,
      subject: 'Air Quality Alert',
      text: content,
      html: `<div style="font-family: sans-serif; padding: 20px;">
        <h2>Air Quality Alert</h2>
        <p>${content}</p>
      </div>`
    });
  }
};

// === Notification Service ===
class NotificationService {
  constructor() {
    this.retryQueue = new Map();
    this.startRetryProcessor();
  }

  async sendNotification(userId, type, content, channels = ['sms', 'email']) {
    const notifications = [];

    try {
      // Get user details
      const user = await this.getUserDetails(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Send through each channel
      for (const channel of channels) {
        try {
          // Log notification attempt
          const notifId = await this.logNotification(userId, type, channel, content, 'pending');

          // Send notification
          await notificationHandlers[channel](user, content);

          // Update notification status
          await this.updateNotificationStatus(notifId, 'sent');
          notifications.push({ channel, status: 'success' });

          logger.info(`Notification sent successfully`, {
            userId,
            channel,
            type,
            notificationId: notifId
          });
        } catch (error) {
          logger.error(`Failed to send notification`, {
            userId,
            channel,
            error: error.message
          });

          // Add to retry queue if appropriate
          if (this.shouldRetry(error)) {
            await this.scheduleRetry(userId, type, channel, content);
          }

          notifications.push({ channel, status: 'failed', error: error.message });
        }
      }
    } catch (error) {
      logger.error(`Notification processing failed`, {
        userId,
        error: error.message
      });
      throw error;
    }

    return notifications;
  }

  async getUserDetails(userId) {
    return new Promise((resolve, reject) => {
      userClient.GetUser({ id: userId }, (err, user) => {
        if (err) reject(err);
        else resolve(user);
      });
    });
  }

  async logNotification(userId, type, channel, content, status) {
    const result = await dbRun(
      'INSERT INTO notifications (user_id, type, channel, content, status) VALUES (?, ?, ?, ?, ?)',
      [userId, type, channel, content, status]
    );
    return result.lastID;
  }

  async updateNotificationStatus(id, status, error = null, retryCount = null, nextRetry = null) {
    const params = [
      status,
      error,
      status === 'sent' ? new Date().toISOString() : null,
      retryCount,
      nextRetry,
      id
    ];

    await dbRun(
      `UPDATE notifications SET 
        status = ?, 
        error = ?, 
        sent_at = ?,
        retry_count = COALESCE(?, retry_count),
        next_retry = ?,
        updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?`,
      params
    );
  }

  shouldRetry(error) {
    const retryableErrors = [
      'ECONNRESET',
      'ETIMEDOUT',
      'ECONNREFUSED',
      'NETWORK_ERROR',
      'Rate limit exceeded',
      'Service unavailable'
    ];
    return retryableErrors.some(e => error.message.includes(e));
  }

  async scheduleRetry(userId, type, channel, content, notificationId = null) {
    try {
      let id = notificationId;
      if (!id) {
        const result = await dbRun(
          `INSERT INTO notifications (
            user_id, type, channel, content, status, retry_count, next_retry
          ) VALUES (?, ?, ?, ?, 'pending_retry', 0, datetime('now', '+' || ? || ' seconds'))`,
          [userId, type, channel, content, RETRY_DELAY / 1000]
        );
        id = result.lastID;
      } else {
        const notification = await dbGet('SELECT retry_count FROM notifications WHERE id = ?', [id]);
        if (!notification || notification.retry_count >= MAX_RETRIES) {
          await this.updateNotificationStatus(id, 'failed', 'Max retries exceeded');
          return;
        }

        const nextRetryDelay = RETRY_DELAY * Math.pow(RETRY_BACKOFF_MULTIPLIER, notification.retry_count);
        await this.updateNotificationStatus(
          id,
          'pending_retry',
          null,
          notification.retry_count + 1,
          new Date(Date.now() + nextRetryDelay).toISOString()
        );
      }

      logger.info(`Scheduled notification retry`, {
        userId,
        channel,
        type,
        notificationId: id
      });
    } catch (error) {
      logger.error(`Failed to schedule retry`, {
        userId,
        channel,
        type,
        error: error.message
      });
    }
  }

  startRetryProcessor() {
    setInterval(async () => {
      try {
        const pendingRetries = await dbAll(
          `SELECT * FROM notifications 
          WHERE status = 'pending_retry' 
          AND next_retry <= datetime('now')
          AND retry_count < ?`,
          [MAX_RETRIES]
        );

        for (const notification of pendingRetries) {
          try {
            const user = await this.getUserDetails(notification.user_id);
            await notificationHandlers[notification.channel](user, notification.content);
            
            await this.updateNotificationStatus(notification.id, 'sent');
            
            logger.info(`Retry successful`, {
              notificationId: notification.id,
              userId: notification.user_id,
              channel: notification.channel
            });
          } catch (error) {
            logger.error(`Retry failed`, {
              notificationId: notification.id,
              error: error.message
            });

            if (this.shouldRetry(error)) {
              await this.scheduleRetry(
                notification.user_id,
                notification.type,
                notification.channel,
                notification.content,
                notification.id
              );
            } else {
              await this.updateNotificationStatus(notification.id, 'failed', error.message);
            }
          }
        }
      } catch (error) {
        logger.error('Error processing retry queue:', error);
      }
    }, RETRY_DELAY);
  }

  async getNotificationHistory(userId, options = {}) {
    const {
      limit = 50,
      offset = 0,
      status,
      channel,
      startDate,
      endDate
    } = options;

    let query = 'SELECT * FROM notifications WHERE user_id = ?';
    const params = [userId];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (channel) {
      query += ' AND channel = ?';
      params.push(channel);
    }

    if (startDate) {
      query += ' AND created_at >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND created_at <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await dbAll(query, params);
  }

  async getNotificationStats(userId) {
    const stats = await dbAll(`
      SELECT 
        channel,
        status,
        COUNT(*) as count,
        MAX(created_at) as last_notification
      FROM notifications 
      WHERE user_id = ?
      GROUP BY channel, status
    `, [userId]);

    return stats;
  }
}

// === Express App Setup ===
const app = express();

app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(bodyParser.json());
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
}));

// === gRPC Client Setup ===
const userProtoDef = protoLoader.loadSync('protos/user.proto', {
  keepCase: true,
  defaults: true,
  oneofs: true
});
const userProto = grpc.loadPackageDefinition(userProtoDef).user;
const userClient = new userProto.UserService('user-service:5000', grpc.credentials.createInsecure());

// === Kafka Setup ===
const kafka = new Kafka({
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092'],
  retry: {
    initialRetryTime: 100,
    retries: 8
  }
});

const consumer = kafka.consumer({ groupId: 'notification-group' });
const notificationService = new NotificationService();

// === API Routes ===
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    kafka: consumer.isRunning()
  });
});

// Get notification history
app.get('/api/notifications/:userId', async (req, res, next) => {
  try {
    const {
      limit,
      offset,
      status,
      channel,
      startDate,
      endDate
    } = req.query;

    const notifications = await notificationService.getNotificationHistory(
      req.params.userId,
      {
        limit: parseInt(limit),
        offset: parseInt(offset),
        status,
        channel,
        startDate,
        endDate
      }
    );

    res.json(notifications);
  } catch (error) {
    next(error);
  }
});

// Get notification statistics
app.get('/api/notifications/:userId/stats', async (req, res, next) => {
  try {
    const stats = await notificationService.getNotificationStats(req.params.userId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Manual notification send
app.post('/api/notifications', async (req, res, next) => {
  try {
    const { userId, type, content, channels } = req.body;

    if (!userId || !type || !content) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const result = await notificationService.sendNotification(
      userId,
      type,
      content,
      channels
    );

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// === Kafka Consumer Setup ===
const setupKafkaConsumer = async () => {
  try {
    await consumer.connect();
    await consumer.subscribe({ topics: ['alerts', 'user-notifications'], fromBeginning: false });

    await consumer.run({
      eachMessage: async ({ topic, message }) => {
        try {
          const data = JSON.parse(message.value.toString());
          
          let content;
          if (topic === 'alerts') {
            content = `🚨 Air Quality Alert for ${data.location}: ${data.bucket} (AQI: ${data.aqi})`;
          } else {
            content = data.content;
          }

          await notificationService.sendNotification(
            data.user_id,
            topic,
            content,
            data.channels || ['sms', 'email']
          );
        } catch (error) {
          logger.error('Failed to process message:', {
            topic,
            error: error.message
          });
        }
      }
    });

    logger.info('Kafka consumer started successfully');
  } catch (error) {
    logger.error('Failed to setup Kafka consumer:', error);
    process.exit(1);
  }
};

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
    await setupKafkaConsumer();

    app.listen(PORT, () => {
      logger.info(`Notification Service running at http://localhost:${PORT}`);
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
    await consumer.disconnect();
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
