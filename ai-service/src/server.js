const express = require('express');
const cors = require('cors');
const { Kafka } = require('kafkajs');
const tf = require('@tensorflow/tfjs-node');
const winston = require('winston');
const path = require('path');
require('dotenv').config();

// Configuration du logger
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

const app = express();
app.use(cors());
app.use(express.json());

// Configuration Kafka
const kafka = new Kafka({
  clientId: 'ai-service',
  brokers: [process.env.KAFKA_BROKER || 'kafka:9092']
});

const consumer = kafka.consumer({ groupId: 'ai-service-group' });
const producer = kafka.producer();

// Chargement du modèle
let model;
async function loadModel() {
  try {
    model = await tf.loadLayersModel('file://' + path.join(__dirname, '../models/model.json'));
    logger.info('Modèle chargé avec succès');
  } catch (error) {
    logger.error('Erreur lors du chargement du modèle:', error);
    process.exit(1);
  }
}

// Routes API
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

app.post('/api/predict', async (req, res) => {
  try {
    const { features } = req.body;
    if (!features || !Array.isArray(features)) {
      return res.status(400).json({ error: 'Features invalides' });
    }

    const tensor = tf.tensor2d([features]);
    const prediction = model.predict(tensor);
    const result = await prediction.data();

    res.json({ prediction: Array.from(result) });
  } catch (error) {
    logger.error('Erreur de prédiction:', error);
    res.status(500).json({ error: 'Erreur lors de la prédiction' });
  }
});

// Gestionnaire Kafka
async function setupKafka() {
  await consumer.connect();
  await producer.connect();
  
  await consumer.subscribe({ topic: 'aqi-data', fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const data = JSON.parse(message.value.toString());
        // Traitement des données et prédiction
        const prediction = await processPrediction(data);
        
        // Publication des résultats
        await producer.send({
          topic: 'ai-predictions',
          messages: [
            { value: JSON.stringify(prediction) },
          ],
        });
      } catch (error) {
        logger.error('Erreur de traitement Kafka:', error);
      }
    },
  });
}

async function processPrediction(data) {
  // Préparation des features
  const features = prepareFeatures(data);
  const tensor = tf.tensor2d([features]);
  const prediction = model.predict(tensor);
  const result = await prediction.data();

  return {
    timestamp: new Date().toISOString(),
    location: data.location,
    prediction: Array.from(result)[0],
    confidence: calculateConfidence(result)
  };
}

function prepareFeatures(data) {
  // Transformation des données en features pour le modèle
  // À adapter selon votre modèle
  return [
    data.pm25 || 0,
    data.pm10 || 0,
    data.o3 || 0,
    data.no2 || 0,
    data.so2 || 0,
    data.co || 0,
    // Ajoutez d'autres features selon votre modèle
  ];
}

function calculateConfidence(prediction) {
  // Calcul simple de la confiance basé sur la distribution des prédictions
  // À adapter selon votre modèle
  return 0.85; // Exemple
}

// Démarrage du serveur
const PORT = process.env.TENSORFLOW_SERVER_PORT || 5005;

async function startServer() {
  try {
    await loadModel();
    await setupKafka();
    
    app.listen(PORT, () => {
      logger.info(`Service AI démarré sur le port ${PORT}`);
    });
  } catch (error) {
    logger.error('Erreur au démarrage du serveur:', error);
    process.exit(1);
  }
}

startServer(); 