"""Point d'entrée pour entraîner un modèle PyTorch sur data2.csv avec suivi MLflow.

- Charge les données (features polluants, cible AQI)
- Split train/test
- Entraîne un MLP PyTorch (voir steps/train.py)
- Évalue la performance (RMSE) sur le test set
- Log les paramètres / métriques dans MLflow
- Sauvegarde le modèle dans ai-service/models/model_v1.pt
"""

import os
import math

import torch
import mlflow
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_squared_error

from .steps.data_loader import load_data
from .steps.train import train_model


def main():
    # Hyperparamètres de base (plus tard: charger depuis un params.yaml ou Optuna)
    params = {
        "test_size": 0.2,
        "random_state": 42,
        "epochs": 5,
        "batch_size": 64,
        "lr": 1e-3,
    }

    X, y = load_data()
    print(f"Dataset chargé: X.shape={X.shape}, y.shape={y.shape}")

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=params["test_size"],
        random_state=params["random_state"],
    )

    mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5001"))
    mlflow.set_experiment("air_quality_regression")

    with mlflow.start_run():
        mlflow.log_params(params)

        model = train_model(
            X_train,
            y_train,
            epochs=params["epochs"],
            batch_size=params["batch_size"],
            lr=params["lr"],
        )

        # Évaluation sur le test set
        model.eval()
        with torch.no_grad():
            X_test_tensor = torch.tensor(X_test.values, dtype=torch.float32)
            preds = model(X_test_tensor).numpy().ravel()
        rmse = math.sqrt(mean_squared_error(y_test, preds))
        print(f"Test RMSE = {rmse:.4f}")
        mlflow.log_metric("rmse", rmse)

        # Sauvegarde du modèle (fichier) + log comme artefact MLflow
        base_dir = os.path.dirname(os.path.dirname(__file__))
        models_dir = os.path.join(base_dir, "models")
        os.makedirs(models_dir, exist_ok=True)

        model_path = os.path.join(models_dir, "model_v1.pt")
        torch.save(model.state_dict(), model_path)
        print(f"Modèle sauvegardé dans {model_path}")
        mlflow.log_artifact(model_path, artifact_path="models")


if __name__ == "__main__":
    main()
