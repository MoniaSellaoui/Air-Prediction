"""Pipeline ZenML de base pour l'entraînement AQI.

Ce fichier suppose que `zenml init` a été exécuté dans le repo.
"""

from typing import Tuple

import numpy as np
import torch
from sklearn.metrics import mean_squared_error
from zenml import pipeline, step

from mlops.steps.data_loader import load_data
from mlops.steps.train import train_model


@step
def data_step() -> Tuple[np.ndarray, np.ndarray]:
    """Charge les données AQI et renvoie (X, y) sous forme de ndarrays."""
    X, y = load_data()
    return X.values, y.values


@step
def train_step(
    X: np.ndarray,
    y: np.ndarray,
    epochs: int = 5,
    batch_size: int = 64,
    lr: float = 1e-3,
) -> torch.nn.Module:
    """Étape d'entraînement ZenML, paramétrable pour le CT.

    On réutilise la logique de train_model, qui accepte des DataFrames/Series.
    """
    import pandas as pd

    X_df = pd.DataFrame(X)
    y_s = pd.Series(y)
    model = train_model(
        X_df,
        y_s,
        epochs=epochs,
        batch_size=batch_size,
        lr=lr,
    )
    return model


@step
def eval_export_step(
    model: torch.nn.Module,
    X: np.ndarray,
    y: np.ndarray,
    epochs: int = 5,
    batch_size: int = 64,
    lr: float = 1e-3,
    run_name: str = "zenml_aqi_run",
    # Par défaut, on loggue dans un backend MLflow local (http://localhost:5001).
    mlflow_tracking_uri: str = "http://localhost:5001",
    mlflow_experiment: str = "aqi_zenml_pipeline",
) -> float:
    """Évalue le modèle (RMSE), l'exporte sur disque et logge dans MLflow.

    Le nom de run permet de différencier les modèles exportés.
    """
    import os
    import re

    import mlflow

    model.eval()
    with torch.no_grad():
        X_tensor = torch.tensor(X, dtype=torch.float32)
        preds = model(X_tensor).numpy().ravel()

    rmse = mean_squared_error(y, preds, squared=False)

    # Normaliser le nom pour un nom de fichier sûr
    safe_run_name = re.sub(r"[^a-zA-Z0-9_-]", "_", run_name)

    base_dir = os.path.dirname(os.path.dirname(__file__))
    models_dir = os.path.join(base_dir, "models")
    os.makedirs(models_dir, exist_ok=True)
    model_path = os.path.join(models_dir, f"model_zenml_{safe_run_name}.pt")
    torch.save(model.state_dict(), model_path)

    # Logging dans MLflow (serveur Docker sur http://localhost:5001)
    mlflow.set_tracking_uri(mlflow_tracking_uri)
    mlflow.set_experiment(mlflow_experiment)
    with mlflow.start_run(run_name=run_name):
        mlflow.log_params({
            "epochs": epochs,
            "batch_size": batch_size,
            "lr": lr,
        })
        mlflow.log_metric("rmse", rmse)
        mlflow.log_artifact(model_path, artifact_path="models")

    print(f"ZenML pipeline RMSE={rmse:.4f}, modèle exporté dans {model_path}")
    return rmse


@pipeline
def aqi_training_pipeline(
    epochs: int = 5,
    batch_size: int = 64,
    lr: float = 1e-3,
    run_name: str = "zenml_aqi_baseline",
):
    """Pipeline ZenML complet : data -> train -> eval/export.

    Les hyperparamètres permettent de lancer plusieurs runs (CT / grille)."""
    X, y = data_step()
    model = train_step(X, y, epochs=epochs, batch_size=batch_size, lr=lr)
    eval_export_step(
        model,
        X,
        y,
        epochs=epochs,
        batch_size=batch_size,
        lr=lr,
        run_name=run_name,
    )


if __name__ == "__main__":
    aqi_training_pipeline()()
