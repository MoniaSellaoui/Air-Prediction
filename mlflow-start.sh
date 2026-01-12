#!/bin/bash

# Script de démarrage MLflow avec configuration correcte
echo "Installation MLflow..."
pip install --no-cache-dir 'mlflow==2.14.0'

echo "Démarrage MLflow sur 0.0.0.0:5000..."
mlflow server \
  --host 0.0.0.0 \
  --port 5000 \
  --backend-store-uri sqlite:///mlflow.db \
  --default-artifact-root s3://mlops-bucket/mlflow-artifacts \
  --gunicorn-opts '--bind 0.0.0.0:5000 --workers 4 --timeout 120'
