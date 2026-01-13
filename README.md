# Air-Prediction: Système Complet de Prédiction de la Qualité de l'Air

<div align="center">

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![Tech Stack](https://img.shields.io/badge/Stack-Python%2FNode.js-green)
![Docker](https://img.shields.io/badge/Docker-Containerized-cyan)
![License](https://img.shields.io/badge/License-ISC-yellow)

</div>

## 📋 Table des Matières

- [Description](#description)
- [Architecture Générale](#architecture-générale)
- [Structure du Projet](#structure-du-projet)
- [Technologies Utilisées](#technologies-utilisées)
- [Prérequis](#prérequis)
- [Installation et Configuration](#installation-et-configuration)
- [Lancement du Projet](#lancement-du-projet)
- [Services](#services)
- [Entraînement du Modèle ML](#entraînement-du-modèle-ml)
- [Documentation API](#documentation-api)
- [Dépannage](#dépannage)

---

## 📌 Description

**Air-Prediction** est un système complet de prédiction de la qualité de l'air basé sur une architecture de microservices. Le projet combine :

- **Machine Learning** : Entraînement et déploiement de modèles de prédiction avec MLflow et DVC
- **Microservices** : Services indépendants pour l'IA, AQI, utilisateurs, localisation, et notifications
- **Frontend** : Interface React moderne pour visualiser les prédictions
- **Temps réel** : Intégration Kafka pour le traitement des données en flux continu
- **Sécurité** : Authentification JWT, rate limiting, et gestion des utilisateurs

---

## 🏗️ Architecture Générale

```
┌─────────────────────────────────────────────────────────────────────┐
│                          FRONTEND (React)                           │
│                    Interface de visualisation                        │
└────────────────────┬────────────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (Port 3000)                         │
│  - Routage des requêtes    - Authentification JWT                   │
│  - Rate limiting           - Logging centralisé                     │
└──┬──────┬──────────┬────────────┬──────────────┬────────────────────┘
   │      │          │            │              │
   ▼      ▼          ▼            ▼              ▼
┌────────────┐ ┌──────────┐ ┌──────────┐ ┌─────────────┐ ┌──────────┐
│   USER     │ │AQI       │ │LOCATION  │ │NOTIFICATION│ │   AI     │
│  SERVICE   │ │ SERVICE  │ │ SERVICE  │ │ SERVICE    │ │ SERVICE  │
│(Port 5000) │ │(5003)    │ │(Port5002)│ │(Port 5004) │ │(5005)    │
└────────────┘ └──┬───────┘ └──────────┘ └─────────────┘ └────┬─────┘
                  │                                            │
                  └──────────────────┬───────────────────────┬─┘
                                     ▼                       ▼
                            ┌────────────────────────────────────┐
                            │    KAFKA (Message Broker)           │
                            │ - Traitement en temps réel          │
                            │ - Événements asynchrones            │
                            └────────────────────────────────────┘
                                     │
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              ┌──────────┐    ┌──────────────┐   ┌────────┐
              │ DVC/MLflow│   │ Base de Données│  │ Storage│
              │(Versioning│   │ (SQLite)       │  │Modèles │
              │ML Assets)│    └──────────────┘   └────────┘
              └──────────┘
```

---

## 📁 Structure du Projet

```
Air-Predection/
├── 📄 docker-compose.yml          # Orchestration des conteneurs
├── 📄 params.yaml                 # Paramètres ML/données
├── 📄 dvc.yaml                    # Pipeline DVC
├── 📄 mlflow-start.sh             # Script de démarrage MLflow
├── 📦 package.json                # Dépendances Node.js du root
│
├── 🤖 ai-service/                 # Service de prédiction ML
│   ├── ai_server.py              # Serveur gRPC/REST
│   ├── requirements.txt           # Dépendances Python
│   ├── Dockerfile                # Image Docker
│   ├── mlops/                    # Pipeline ML
│   │   ├── train.py              # Script d'entraînement
│   │   ├── optuna_search.py      # Hyperparamètre tuning
│   │   ├── config/               # Configuration
│   │   ├── steps/                # Étapes du pipeline
│   │   └── pipelines/            # ZenML pipelines
│   ├── models/                   # Modèles entraînés
│   ├── data/                     # Données
│   └── protos/                   # Définitions gRPC
│
├── 🌐 api-gateway/               # Passerelle API
│   ├── index.js                  # Routeur Express
│   ├── generateToken.js          # Génération JWT
│   ├── Dockerfile                # Image Docker
│   └── package.json              # Dépendances
│
├── 👤 user-service/              # Service utilisateurs
│   ├── index.js                  # API utilisateurs
│   ├── Dockerfile                # Image Docker
│   └── package.json              # Dépendances
│
├── 📍 location-service/          # Service de géolocalisation
│   ├── index.js                  # API localisation
│   ├── services/                 # Services géocodage
│   ├── middleware/               # Authentification
│   ├── Dockerfile                # Image Docker
│   └── package.json              # Dépendances
│
├── 💨 aqi-service/               # Service AQI (Air Quality Index)
│   ├── index.js                  # API AQI
│   ├── Dockerfile                # Image Docker
│   └── package.json              # Dépendances
│
├── 🔔 notification-service/      # Service de notifications
│   ├── index.js                  # API notifications
│   ├── Dockerfile                # Image Docker
│   └── package.json              # Dépendances
│
├── 🎨 frontend/                  # Interface utilisateur
│   ├── src/
│   │   ├── App.jsx               # Composant principal
│   │   ├── pages/                # Pages de l'appli
│   │   ├── components/           # Composants React
│   │   └── context/              # Context API
│   ├── vite.config.js            # Configuration Vite
│   ├── tailwind.config.js        # Configuration Tailwind CSS
│   └── package.json              # Dépendances
│
├── 📊 scripts/                   # Scripts utilitaires
│   └── mlops-train-and-push.ps1  # Pipeline d'entraînement
│
└── 📂 mlruns/                    # Artefacts MLflow
```

---

## 🛠️ Technologies Utilisées

### Backend
- **Python 3.10+** : Entraînement et prédiction ML
  - TensorFlow/PyTorch : Modèles de deep learning
  - Scikit-learn : Machine learning classique
  - Flask : Serveur REST (optionnel)
  - gRPC : Communication inter-services haute performance

- **Node.js 18+** : Microservices et API
  - Express.js : Framework web
  - Apollo Server/GraphQL : API GraphQL
  - Kafka.js : Streaming temps réel
  - JWT : Authentification

### ML & DataOps
- **DVC** : Versioning des datasets et modèles
- **MLflow** : Tracking expériences, versioning modèles
- **Optuna** : Optimisation hyperparamètres
- **ZenML** : Orchestration pipelines ML

### Infrastructure
- **Docker & Docker Compose** : Containerisation
- **Kafka + Zookeeper** : Message broker temps réel
- **SQLite** : Bases de données légères
- **Prometheus** : Monitoring (optionnel)

### Frontend
- **React 19** : Framework UI
- **Vite** : Build tool moderne
- **Tailwind CSS** : Styling
- **Recharts** : Visualisation données
- **React Router** : Routage
- **Axios** : Requêtes HTTP
- **TanStack Query** : Gestion état serveur

---

## 📋 Prérequis

### Système
- **Windows 10+**, **macOS**, ou **Linux**
- **Docker** (v24.0+)
- **Docker Compose** (v2.0+)
- **Git**

### Environnement Local (développement)
- **Python 3.10+**
- **Node.js 18+** & **npm**
- **Visual Studio Code** (recommandé)

### Ressources minimales
- **RAM** : 4 GB
- **Disque** : 5 GB
- **CPU** : 2 cores

### Vérification de l'installation

```bash
# Vérifier Docker
docker --version
docker-compose --version

# Vérifier Python
python --version

# Vérifier Node.js
node --version
npm --version
```

---

## 🚀 Installation et Configuration

### 1. Clone du dépôt

```bash
git clone https://github.com/votreorg/Air-Predection.git
cd Air-Predection
```

### 2. Variables d'environnement

Créer un fichier `.env` à la racine du projet :

```bash
# Copier le fichier d'exemple
cp .env.example .env
```

Éditer `.env` :

```env
# JWT
JWT_SECRET=votre_super_secret_jwt_2024

# Ports
API_GATEWAY_PORT=3000
USER_SERVICE_PORT=5000
LOCATION_SERVICE_PORT=5002
AQI_SERVICE_PORT=5003
NOTIFICATION_SERVICE_PORT=5004
AI_SERVICE_PORT=5005

# APIs externes
AQICN_API_KEY=votre_clé_api
GOOGLE_MAPS_API_KEY=votre_clé_google

# MLflow
MLFLOW_TRACKING_URI=http://127.0.0.1:5001

# Environment
NODE_ENV=development
```

### 3. Installation des dépendances Python

```bash
cd ai-service
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt
```

### 4. Installation des dépendances Node.js

```bash
# À la racine du projet
npm install

# Frontend
cd frontend
npm install

# Retour à la racine
cd ..
```

### 5. Vérification de la structure

```bash
# Les fichiers importants doivent être présents
ls docker-compose.yml
ls params.yaml
ls dvc.yaml
```

---

## ▶️ Lancement du Projet

### Option 1 : Avec Docker (Recommandé - Production)

```bash
# Lancer tous les services
npm run start

# Ou avec reconstruction des images
npm run start:dev

# Arrêter les services
npm run stop
```

**Services disponibles :**
- **Frontend** : http://localhost:3000/frontend
- **API Gateway** : http://localhost:3000
- **User Service** : http://localhost:5000
- **Location Service** : http://localhost:5002
- **AQI Service** : http://localhost:5003
- **Notification Service** : http://localhost:5004
- **AI Service** : http://localhost:5005

### Option 2 : Mode Développement Local

#### Terminal 1 - Frontend

```bash
cd frontend
npm run dev
# Accessible sur http://localhost:5173
```

#### Terminal 2 - API Gateway

```bash
cd api-gateway
npm install
node index.js
```

#### Terminal 3 - Services Node.js (user-service, aqi-service, etc.)

```bash
cd user-service
npm install
node index.js

# Dans d'autres terminaux
cd ../location-service && npm install && node index.js
cd ../aqi-service && npm install && node index.js
cd ../notification-service && npm install && node index.js
```

#### Terminal 4 - AI Service (Python)

```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # ou venv\Scripts\activate sur Windows
pip install -r requirements.txt
python ai_server.py
```

#### Terminal 5 - Kafka (Docker)

```bash
docker-compose up kafka zookeeper
```

---

## 🤖 Services

### 1. **API Gateway** (Port 3000)
**Rôle** : Point d'entrée unique pour toutes les requêtes
- ✅ Routage vers les microservices
- ✅ Authentification JWT
- ✅ Rate limiting
- ✅ Logging centralisé
- ✅ CORS et sécurité

```bash
# Répertoire
./api-gateway/

# Lancer
cd api-gateway && npm install && node index.js
```

### 2. **User Service** (Port 5000)
**Rôle** : Gestion utilisateurs et authentification
- ✅ Inscription/Connexion
- ✅ Gestion profils
- ✅ Génération tokens JWT

```bash
# Répertoire
./user-service/

# Lancer
cd user-service && npm install && node index.js
```

### 3. **Location Service** (Port 5002)
**Rôle** : Services de géolocalisation
- ✅ Géocodage (lat/lon)
- ✅ Recherche d'adresses
- ✅ Données géographiques

```bash
# Répertoire
./location-service/

# Lancer
cd location-service && npm install && node index.js
```

### 4. **AQI Service** (Port 5003)
**Rôle** : Calcul et gestion AQI (Air Quality Index)
- ✅ Récupération données externes
- ✅ Calcul AQI
- ✅ Intégration Kafka

```bash
# Répertoire
./aqi-service/

# Lancer
cd aqi-service && npm install && node index.js
```

### 5. **Notification Service** (Port 5004)
**Rôle** : Gestion des notifications
- ✅ Alertes qualité air
- ✅ Notifications utilisateur
- ✅ Kafka consumer

```bash
# Répertoire
./notification-service/

# Lancer
cd notification-service && npm install && node index.js
```

### 6. **AI Service** (Port 5005)
**Rôle** : Prédictions ML de qualité d'air
- ✅ Inférence modèles
- ✅ API gRPC
- ✅ Kafka producer/consumer
- ✅ Logging prédictions

```bash
# Répertoire
./ai-service/

# Installation
cd ai-service
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Lancer
python ai_server.py
```

### 7. **Frontend** (Port 3000 ou 5173)
**Rôle** : Interface utilisateur
- ✅ Tableaux de bord
- ✅ Visualisations données
- ✅ Formulaires prédiction

```bash
# Répertoire
./frontend/

# Développement
cd frontend
npm run dev

# Production
npm run build
npm run preview
```

---

## 📊 Entraînement du Modèle ML

### Structure ML

```
ai-service/
├── mlops/
│   ├── train.py              # Point d'entrée
│   ├── optuna_search.py      # Tuning hyperparamètres
│   ├── config/
│   │   └── params.yaml       # Paramètres du modèle
│   ├── steps/
│   │   ├── data_loader.py    # Chargement données
│   │   └── train.py          # Logique d'entraînement
│   └── pipelines/
│       ├── training_pipeline.py
│       └── run_aqi_pipelines.py
├── data/
│   └── raw/
│       └── data2.csv         # Données brutes
└── models/
    └── model_v1.pt           # Modèles entraînés
```

### 1. Préparation des données

```bash
cd ai-service

# Vérifier que data2.csv existe
ls data/raw/data2.csv

# Mettre en place les données DVC
dvc pull  # Si données versionées
```

### 2. Configuration des paramètres

Éditer `params.yaml` à la racine :

```yaml
data:
  raw_path: ai-service/data/raw/data2.csv
  test_size: 0.2
  random_state: 42

model:
  epochs: 10
  batch_size: 64
  lr: 0.001
  model_path: ai-service/models/model_v1.pt

mlflow:
  tracking_uri: http://127.0.0.1:5001
  experiment_name: air_quality_regression
```

### 3. Lancer MLflow (optionnel mais recommandé)

```bash
# Terminal dédié
bash mlflow-start.sh

# Ou manuellement
mlflow server --host 127.0.0.1 --port 5001

# Accéder UI : http://localhost:5001
```

### 4. Entraîner le modèle

#### Option A : Avec DVC

```bash
cd ai-service

# Vue d'ensemble du pipeline
dvc dag

# Exécuter le pipeline
dvc repro

# Voir les résultats
dvc metrics show
```

#### Option B : Directement avec Python

```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # ou venv\Scripts\activate
pip install -r requirements.txt

# Entraînement
python mlops/train.py

# Tuning hyperparamètres (optionnel)
python mlops/optuna_search.py
```

#### Option C : Script PowerShell (Windows)

```powershell
# À la racine du projet
.\scripts\mlops-train-and-push.ps1
```

### 5. Résultats et suivi

```bash
# Voir les expériences MLflow
mlflow ui

# Vérifier les modèles générés
ls ai-service/models/

# Voir les métriques DVC
dvc metrics show
dvc plots show
```

### Paramètres d'entraînement

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `epochs` | 5-50 | Nombre d'itérations |
| `batch_size` | 32-256 | Taille des batchs |
| `lr` (learning rate) | 1e-4 à 1e-2 | Taux d'apprentissage |
| `test_size` | 0.2 | Ratio test/train |
| `random_state` | 42 | Reproductibilité |

---

## 📡 Documentation API

### Authentification

Tous les endpoints (sauf login/register) nécessitent un token JWT :

```bash
# Header requis
Authorization: Bearer <token_jwt>
```

### Générer un token

```bash
# Depuis le gateway
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

### Endpoints principaux

#### User Service

```bash
# Inscription
POST /auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe"
}

# Connexion
POST /auth/login
{
  "email": "user@example.com",
  "password": "password123"
}

# Profil
GET /profile
Authorization: Bearer <token>
```

#### AQI Service

```bash
# Prédiction AQI
POST /predict
{
  "location": {"lat": 48.8566, "lon": 2.3522},
  "features": {
    "pm25": 35,
    "pm10": 50,
    "no2": 45
  }
}

# Historique
GET /history?location_id=1&limit=100
Authorization: Bearer <token>
```

#### Location Service

```bash
# Recherche localisation
GET /search?query=Paris

# Géocodage inverse
GET /reverse?lat=48.8566&lon=2.3522
```

#### Notification Service

```bash
# Souscrire aux alertes
POST /subscribe
{
  "location_id": 1,
  "alert_threshold": 150
}

# Notifications utilisateur
GET /notifications
Authorization: Bearer <token>
```

#### AI Service (gRPC)

```protobuf
service PredictionService {
  rpc Predict (PredictionRequest) returns (PredictionResponse);
}

message PredictionRequest {
  float pm25 = 1;
  float pm10 = 2;
  float no = 3;
  // ... autres paramètres
}
```

### Testeur d'API

```bash
# Frontend inclus : http://localhost:3000/frontend
# Postman collection : /docs/postman.json
# gRPC : grpcurl localhost:50051 list
```

---

## 🔧 Dépannage

### Problème : Docker containers ne démarrent pas

```bash
# Vérifier Docker
docker ps -a

# Voir les logs
docker-compose logs -f [service_name]

# Nettoyer et relancer
docker-compose down -v
docker-compose up --build
```

### Problème : Port déjà utilisé

```powershell
# Windows - Trouver le processus
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### Problème : Modèle ML ne charge pas

```bash
# Vérifier les fichiers
ls ai-service/models/

# Vérifier requirements.txt
cat ai-service/requirements.txt | grep torch

# Réinstaller
cd ai-service
pip install --force-reinstall -r requirements.txt
```

### Problème : Kafka ne fonctionne pas

```bash
# Vérifier Kafka/Zookeeper
docker-compose logs kafka zookeeper

# Relancer services Kafka
docker-compose restart kafka zookeeper
docker-compose restart aqi-service notification-service
```

### Problème : Token JWT expiré

```bash
# Se reconnecter via login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

### Problème : Frontend ne se connecte pas à l'API

```bash
# Vérifier CORS dans api-gateway/index.js
# Vérifier les URLs d'API dans frontend/.env

# Tester la connexion
curl http://localhost:3000/health
```

### Logs et debugging

```bash
# Voir tous les logs
docker-compose logs -f

# Service spécifique
docker-compose logs -f ai-service

# Niveau de log
docker-compose logs --tail=50 api-gateway
```

---

## 📚 Ressources supplémentaires

### Documentation officielle
- [Docker Compose](https://docs.docker.com/compose/)
- [Express.js](https://expressjs.com/)
- [React](https://react.dev/)
- [PyTorch](https://pytorch.org/)
- [MLflow](https://mlflow.org/)
- [DVC](https://dvc.org/)
- [Kafka](https://kafka.apache.org/)
- [gRPC](https://grpc.io/)

### Scripts utiles

```bash
# Format et lint du code
npm run lint
npm run lint:fix

# Tests
npm test
npm run test:watch

# Build frontend
cd frontend
npm run build

# Voir l'état des services
docker-compose ps

# Inspecter un service
docker-compose logs -f <service_name>
```

---

## 🤝 Contribution

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit les changements (`git commit -m 'Add some AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

---

## 📄 Licence

Ce projet est sous licence ISC. Voir le fichier [LICENSE](LICENSE) pour plus de détails.

---

## 📧 Support

Pour toute question ou problème :
- 📝 Issues GitHub
- 💬 Discussions
- 📧 Email : support@example.com

---

**Dernière mise à jour** : Janvier 2026
**Version** : 1.0.0
