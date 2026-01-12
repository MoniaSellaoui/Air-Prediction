# AI Service pour la Prédiction de la Qualité de l'Air

Ce service est responsable des prédictions de la qualité de l'air en utilisant un modèle scikit-learn.

## Fonctionnalités

- Prédiction de la qualité de l'air en temps réel
- Traitement des données via Kafka
- API REST pour les prédictions à la demande
- Modèle scikit-learn pour les prédictions
- Logging et monitoring des prédictions
- Métriques Prometheus

## Configuration

### Prérequis
- Python 3.10+
- Docker
- scikit-learn
- Flask

### Variables d'environnement
```env
NODE_ENV=development
TENSORFLOW_SERVER_PORT=5005
KAFKA_BROKER=kafka:9092
MODEL_PATH=/models
AQI_SERVICE_URL=http://aqi-service:5001
```

## Installation

1. Créer un environnement virtuel (optionnel) :
```bash
python -m venv venv
source venv/bin/activate  # Linux/Mac
venv\Scripts\activate     # Windows
```

2. Installer les dépendances :
```bash
pip install -r requirements.txt
```

3. Placer votre modèle .pkl dans le dossier `/models` :
```
models/
  └── aqi_model.pkl
```

4. Démarrer le service :
```bash
python src/server.py
```

## API Endpoints

### GET /health
Vérification de l'état du service

### POST /api/predict
Effectue une prédiction

Exemple de requête :
```json
{
  "features": [
    23.5,  // PM2.5
    45.2,  // PM10
    35.1,  // O3
    15.4,  // NO2
    5.2,   // SO2
    0.8    // CO
  ]
}
```

Exemple de réponse :
```json
{
  "prediction": 75.3,
  "confidence": 0.85
}
```

## Intégration Kafka

Le service écoute le topic `aqi-data` pour les nouvelles données et publie les prédictions sur le topic `ai-predictions`.

## Métriques

Les métriques Prometheus sont disponibles sur le port 8000 :
- `air_quality_predictions_total` : Nombre total de prédictions
- `prediction_latency_seconds` : Temps de traitement des prédictions

## Docker

Pour construire l'image :
```bash
docker build -t air-prediction/ai-service .
```

Pour exécuter avec docker-compose :
```bash
docker-compose up ai-service
```

## Monitoring

Les logs sont disponibles dans :
- error.log : Erreurs uniquement
- combined.log : Tous les logs

## Développement

Pour le développement local :
```bash
python src/server.py
```

## Tests

Pour exécuter les tests :
```bash
python -m pytest tests/
```

## Structure du Projet
```
ai-service/
├── Dockerfile
├── requirements.txt
├── README.md
├── models/
│   └── aqi_model.pkl
├── src/
│   ├── server.py
│   └── services/
└── tests/
``` 