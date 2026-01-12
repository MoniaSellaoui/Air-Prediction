from flask import Flask, request, jsonify
from flask_cors import CORS
from kafka import KafkaConsumer, KafkaProducer
from kafka.errors import NoBrokersAvailable
import json
import os
import numpy as np
from datetime import datetime
import logging
from dotenv import load_dotenv
from prometheus_client import start_http_server, Counter, Histogram
import threading
import torch
from torch import nn

# Chargement des variables d'environnement
load_dotenv()

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('error.log', 'a', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# Métriques Prometheus
PREDICTIONS = Counter('air_quality_predictions_total', 'Total number of predictions made')
PREDICTION_LATENCY = Histogram('prediction_latency_seconds', 'Time spent processing prediction')

app = Flask(__name__)
CORS(app)


class MLP(nn.Module):
    """Architecture PyTorch alignée avec l'entraînement (mlops/steps/train.py)."""

    def __init__(self, in_features: int, hidden: int = 64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_features, hidden),
            nn.ReLU(),
            nn.Linear(hidden, hidden),
            nn.ReLU(),
            nn.Linear(hidden, 1),
        )

    def forward(self, x):
        return self.net(x)


# Chargement du modèle PyTorch entraîné
try:
    model_dir = os.path.join(os.path.dirname(__file__), '../models')
    model_path = os.path.join(model_dir, os.getenv('MODEL_FILENAME', 'model_v1.pt'))
    input_dim = 12  # PM2.5, PM10, NO, NO2, NOx, NH3, CO, SO2, O3, Benzene, Toluene, Xylene
    model = MLP(in_features=input_dim)
    state_dict = torch.load(model_path, map_location='cpu')
    model.load_state_dict(state_dict)
    model.eval()
    logger.info(f"Modèle PyTorch chargé avec succès depuis {model_path}")
except Exception as e:
    logger.error(f"Erreur lors du chargement du modèle PyTorch: {str(e)}")
    raise

# Configuration Kafka
KAFKA_BROKER = os.getenv('KAFKA_BROKER', 'kafka:9092')
try:
    producer = KafkaProducer(
        bootstrap_servers=[KAFKA_BROKER],
        value_serializer=lambda x: json.dumps(x).encode('utf-8')
    )
    logger.info(f"KafkaProducer initialisé sur {KAFKA_BROKER}")
except NoBrokersAvailable:
    logger.warning(f"Aucun broker Kafka disponible sur {KAFKA_BROKER}. Le producer sera désactivé.")
    producer = None

def process_features(data):
    """Préparation des features pour le modèle à partir d'un dict.

    On attend idéalement les mêmes 12 features que dans le dataset :
    PM2.5, PM10, NO, NO2, NOx, NH3, CO, SO2, O3, Benzene, Toluene, Xylene.
    Si certaines valeurs sont absentes, elles sont mises à 0.
    """
    try:
        ordered_keys = [
            'PM2.5', 'PM10', 'NO', 'NO2', 'NOx', 'NH3',
            'CO', 'SO2', 'O3', 'Benzene', 'Toluene', 'Xylene'
        ]
        features = [float(data.get(k, 0.0)) for k in ordered_keys]
        arr = np.array(features, dtype=np.float32).reshape(1, -1)
        tensor = torch.from_numpy(arr)
        return tensor
    except Exception as e:
        logger.error(f"Erreur lors de la préparation des features: {str(e)}")
        raise

def calculate_confidence(prediction):
    """Calcul de la confiance de la prédiction."""
    # À adapter selon votre modèle
    return 0.85

@app.route('/health')
def health_check():
    """Endpoint de vérification de santé."""
    return jsonify({"status": "OK"})

@app.route('/api/predict', methods=['POST'])
def predict():
    """Endpoint de prédiction."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({"error": "Corps JSON manquant"}), 400

        # Deux modes possibles :
        # 1) data["features"] = liste de 12 floats
        # 2) data contient directement les clés PM2.5, PM10, ...
        if 'features' in data:
            features_list = data['features']
            if not isinstance(features_list, list) or len(features_list) != 12:
                return jsonify({"error": "features doit être une liste de 12 valeurs"}), 400
            arr = np.array(features_list, dtype=np.float32).reshape(1, -1)
            inputs = torch.from_numpy(arr)
        else:
            inputs = process_features(data)

        with PREDICTION_LATENCY.time():
            with torch.no_grad():
                pred_tensor = model(inputs)
                prediction = float(pred_tensor.numpy().ravel()[0])
            confidence = calculate_confidence(prediction)
        
        PREDICTIONS.inc()
        
        response = {
            "prediction": float(prediction),
            "confidence": confidence
        }
        
        return jsonify(response)
    
    except Exception as e:
        logger.error(f"Erreur lors de la prédiction: {str(e)}")
        return jsonify({"error": "Erreur lors de la prédiction"}), 500

def kafka_consumer():
    """Consumer Kafka pour les données en temps réel."""
    consumer = KafkaConsumer(
        'aqi-data',
        bootstrap_servers=[KAFKA_BROKER],
        value_deserializer=lambda x: json.loads(x.decode('utf-8')),
        group_id='ai-service-group'
    )

    for message in consumer:
        try:
            data = message.value
            inputs = process_features(data)

            with torch.no_grad():
                pred_tensor = model(inputs)
                prediction = float(pred_tensor.numpy().ravel()[0])
            confidence = calculate_confidence(prediction)
            
            result = {
                "timestamp": datetime.now().isoformat(),
                "location": data.get('location'),
                "prediction": float(prediction),
                "confidence": confidence
            }
            
            if producer is not None:
                producer.send('ai-predictions', value=result)
                logger.info(f"Prédiction envoyée pour la localisation: {data.get('location')}")
            else:
                logger.warning("Producer Kafka indisponible : prédiction non envoyée sur 'ai-predictions'.")
            
        except Exception as e:
            logger.error(f"Erreur dans le consumer Kafka: {str(e)}")

def start_metrics_server():
    """Démarrage du serveur de métriques Prometheus."""
    start_http_server(8000)

if __name__ == '__main__':
    # Démarrage du serveur de métriques
    threading.Thread(target=start_metrics_server, daemon=True).start()
    
    # Démarrage du consumer Kafka dans un thread séparé
    threading.Thread(target=kafka_consumer, daemon=True).start()
    
    # Démarrage du serveur Flask
    port = int(os.getenv('TENSORFLOW_SERVER_PORT', 5005))
    app.run(host='0.0.0.0', port=port) 