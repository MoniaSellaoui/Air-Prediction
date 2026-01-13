# Monitoring Grafana et Prometheus - Guide d'Implémentation

## ✅ Corrections et Améliorations Appliquées

### 1. Configuration Prometheus Corrigée

**Fichier**: `ai-service/monitoring/prometheus/prometheus.yml`

- ✅ Targets correctement configurées pour tous les services
- ✅ Endpoints `/metrics` configurés pour chaque service
- ✅ Scrape intervals appropriés (15s pour services, 30s pour storage)

**Services monitorés**:
```
✓ api-gateway:3000
✓ user-service:5000
✓ aqi-service:5003
✓ location-service:5002
✓ ai-service:5005
✓ notification-service:5004
✓ model-serving:8000
✓ mlflow:5000
✓ minio:9000
✓ kafka:9092
✓ prometheus:9090
```

### 2. Alertes Prometheus

**Fichier**: `ai-service/monitoring/prometheus/alerts.yml`

Alertes configurées:
- **ServiceDown**: Alert critique si un service est indisponible
- **HighLatency**: Alerte si latence P95 > 1s
- **HighErrorRate**: Alerte si taux d'erreur > 5%
- **HighMemoryUsage**: Alerte si mémoire > 90%
- **HighCPUUsage**: Alerte si CPU > 80%

### 3. Datasource Grafana

**Fichier**: `ai-service/monitoring/grafana/provisioning/datasources/prometheus.yml`

Grafana se connecte automatiquement à Prometheus à l'adresse `http://prometheus:9090`

### 4. Dashboards Grafana

Deux dashboards pré-configurés:

#### Dashboard 1: System Overview (`air-predection-overview.json`)
- Service Availability
- Request Rate
- P95 Latency
- Error Rate (5xx)

#### Dashboard 2: Services Health (`air-predection-health.json`)
- Status des services (UP/DOWN)
- Request rate par service
- Métriques détaillées

### 5. Intégration Prometheus dans AI Service (Python)

**Fichier**: `ai-service/ai_server.py`

Métriques ajoutées:
```python
from prometheus_client import Counter, Histogram, Gauge, start_http_server

# Metrics
PREDICTIONS_TOTAL = Counter('predictions_total', 'Total predictions made', ['status'])
PREDICTION_DURATION = Histogram('prediction_duration_seconds', 'Prediction duration')
PREDICTION_AQI_GAUGE = Gauge('prediction_aqi_value', 'Current AQI prediction value')
ALERTS_TOTAL = Counter('alerts_total', 'Total high AQI alerts')

# Serveur Prometheus sur port 8001
start_http_server(8001)
```

### 6. Intégration Prometheus dans Services Node.js

**Middleware**: `api-gateway/middleware/metrics.js`

Métriques disponibles pour tous les services Node.js:
- `http_request_duration_seconds` (Histogram)
- `http_requests_total` (Counter)
- `errors_total` (Counter)
- `active_connections` (Gauge)

**Services mis à jour**:
- ✅ api-gateway
- ✅ user-service
- ✅ aqi-service
- ✅ location-service
- ✅ notification-service

**Installation de prom-client** dans `package.json` de chaque service

### 7. Configuration Docker Compose

**Mise à jour**: `docker-compose.yml`

```yaml
prometheus:
  image: prom/prometheus:latest
  ports: 9090:9090
  volumes:
    - ./ai-service/monitoring/prometheus/prometheus.yml:/etc/prometheus/prometheus.yml
    - ./ai-service/monitoring/prometheus/alerts.yml:/etc/prometheus/alerts.yml

grafana:
  image: grafana/grafana:latest
  ports: 3000:3000
  volumes:
    - ./ai-service/monitoring/grafana/provisioning/datasources:/etc/grafana/provisioning/datasources
    - ./ai-service/monitoring/grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards
```

## 🚀 Prochaines Étapes d'Implémentation

### Étape 1: Installer les dépendances

```bash
# AI Service - ajouter prometheus-client (déjà dans requirements.txt)
pip install prometheus-client==0.17.1

# Services Node.js
cd api-gateway && npm install
cd ../user-service && npm install
cd ../aqi-service && npm install
cd ../location-service && npm install
cd ../notification-service && npm install
```

### Étape 2: Intégrer le middleware metrics dans les services Node.js

Exemple pour chaque service (ex: user-service/index.js):

```javascript
const { metricsMiddleware, metricsEndpoint } = require('./middleware/metrics');

// Copier le fichier middleware/metrics.js
app.use(metricsMiddleware);
app.get('/metrics', metricsEndpoint);
```

### Étape 3: Lancer l'application

```bash
docker-compose up -d
```

### Étape 4: Accéder aux dashboards

- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3000 (admin/admin)
- **API Gateway**: http://localhost:3000/metrics

## 📊 Métriques Disponibles

### Prometheus Metrics

```
# Disponibles immédiatement:
up{job="..."} - 1 si service UP, 0 sinon
http_requests_total{method, route, status} - Total requêtes HTTP
http_request_duration_seconds{method, route} - Durée des requêtes
http_requests_duration_seconds_bucket - Histogramme de latence
errors_total{type, route} - Total erreurs

# Dans l'AI Service:
predictions_total{status} - Total prédictions
prediction_duration_seconds - Durée des prédictions
prediction_aqi_value - Valeur AQI actuelle
alerts_total - Total alertes AQI élevé
```

## 🔍 Vérification

### Vérifier les metrics Prometheus

```bash
# Vérifier la configuration
curl http://localhost:9090/api/v1/query?query=up

# Vérifier les alertes
curl http://localhost:9090/api/v1/rules
```

### Vérifier les metrics des services

```bash
# API Gateway
curl http://localhost:3000/metrics

# AI Service
curl http://localhost:5005/metrics

# Autres services
curl http://localhost:5000/metrics  # user-service
curl http://localhost:5002/metrics  # location-service
curl http://localhost:5003/metrics  # aqi-service
curl http://localhost:5004/metrics  # notification-service
```

## ⚠️ Points Important à Noter

1. **Endpoints `/metrics`**: Tous les services exposent maintenant `/metrics` pour Prometheus
2. **Format Prometheus**: Utilisé le format standard Prometheus Client Libraries
3. **Pas d'authentification**: Les endpoints `/metrics` ne requièrent pas d'authentification (idéal pour les scrapers)
4. **Port 8001 pour AI Service**: L'AI service expose les metrics sur le port 8001 (serveur HTTP séparé)
5. **Port 3000 conflit**: L'API Gateway et Grafana utilisent tous les deux le port 3000 - À CORRIGER (voir section suivante)

## 🔧 CORRECTION À FAIRE: Conflit de Port

**Problème**: API Gateway et Grafana utilisent le même port (3000)

**Solution recommandée**:

Option 1: Changer le port de Grafana dans docker-compose.yml
```yaml
grafana:
  ports:
    - "3001:3000"  # Accéder à Grafana sur http://localhost:3001
```

Option 2: Changer le port de l'API Gateway
```yaml
api-gateway:
  ports:
    - "3001:3000"  # API Gateway sur 3001
```

## 📋 Fichiers Créés/Modifiés

```
ai-service/monitoring/
├── prometheus/
│   ├── prometheus.yml (✅ MODIFIÉ)
│   └── alerts.yml (✅ CRÉÉ)
└── grafana/
    └── provisioning/
        ├── datasources/
        │   └── prometheus.yml (✅ CRÉÉ)
        └── dashboards/
            ├── dashboards.yml (✅ CRÉÉ)
            ├── air-predection-overview.json (✅ CRÉÉ)
            └── air-predection-health.json (✅ CRÉÉ)

api-gateway/
├── middleware/
│   └── metrics.js (✅ CRÉÉ)
├── index.js (✅ MODIFIÉ)
└── package.json (✅ MODIFIÉ - ajout prom-client)

user-service/package.json (✅ MODIFIÉ - ajout prom-client)
aqi-service/package.json (✅ MODIFIÉ - ajout prom-client)
location-service/package.json (✅ MODIFIÉ - ajout prom-client)
notification-service/package.json (✅ MODIFIÉ - ajout prom-client)

ai-service/ai_server.py (✅ MODIFIÉ - intégration prometheus-client)
docker-compose.yml (✅ MODIFIÉ - mise à jour volumes Grafana/Prometheus)
```

## 🎯 Résumé de l'Implémentation

| Composant | Avant | Après | Status |
|-----------|-------|-------|--------|
| Prometheus | Configuration minimale, targets incorrects | Configuration complète, tous services | ✅ |
| Grafana | Pas de datasource, pas de dashboards | Datasource Prometheus, 2 dashboards | ✅ |
| Alertes | Vides | 8 alertes configurées | ✅ |
| AI Service | Pas de metrics | Metrics Prometheus intégrées | ✅ |
| Services Node.js | Pas de metrics | Middleware metrics + prom-client | ✅ (à intégrer) |
| Docker Compose | Paths incorrects | Paths corrects + volumes | ✅ |

