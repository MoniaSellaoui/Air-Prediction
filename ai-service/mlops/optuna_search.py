"""Recherche d'hyperparamètres avec Optuna + MLflow.

Lance quelques trials Optuna en variant lr, hidden_size, epochs.
Enregistre rmse dans MLflow pour chaque trial.
"""

import math
import os

import mlflow
import optuna
import torch
from sklearn.metrics import mean_squared_error
from sklearn.model_selection import train_test_split

from .steps.data_loader import load_data
from .steps.train import MLP, train_model


def objective(trial: optuna.Trial) -> float:
    X, y = load_data()

    params = {
        "test_size": 0.2,
        "random_state": 42,
        "epochs": trial.suggest_int("epochs", 3, 10),
        "batch_size": trial.suggest_categorical("batch_size", [32, 64, 128]),
        "lr": trial.suggest_float("lr", 1e-4, 1e-2, log=True),
        "hidden": trial.suggest_int("hidden", 32, 256, step=32),
    }

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=params["test_size"],
        random_state=params["random_state"],
    )

    mlflow.set_tracking_uri(os.getenv("MLFLOW_TRACKING_URI", "http://localhost:5001"))
    mlflow.set_experiment("air_quality_regression_optuna")

    with mlflow.start_run(nested=True):
        mlflow.log_params(params)

        # On crée un MLP avec hidden configurable
        model = MLP(in_features=X_train.shape[1], hidden=params["hidden"])

        # Utiliser train_model en adaptant la signature si besoin ;
        # ici on reproduit sa logique en externe pour contrôler hidden.
        from torch.utils.data import TensorDataset, DataLoader
        import numpy as np

        X_tensor = torch.tensor(np.array(X_train), dtype=torch.float32)
        y_tensor = torch.tensor(np.array(y_train).reshape(-1, 1), dtype=torch.float32)
        dataset = TensorDataset(X_tensor, y_tensor)
        dataloader = DataLoader(dataset, batch_size=params["batch_size"], shuffle=True)

        criterion = torch.nn.MSELoss()
        optimizer = torch.optim.Adam(model.parameters(), lr=params["lr"])

        for epoch in range(params["epochs"]):
            for xb, yb in dataloader:
                preds = model(xb)
                loss = criterion(preds, yb)
                optimizer.zero_grad()
                loss.backward()
                optimizer.step()

        # Évaluation
        model.eval()
        with torch.no_grad():
            X_test_tensor = torch.tensor(X_test.values, dtype=torch.float32)
            preds = model(X_test_tensor).numpy().ravel()
        rmse = math.sqrt(mean_squared_error(y_test, preds))
        mlflow.log_metric("rmse", rmse)

    return rmse


def main():
    study = optuna.create_study(direction="minimize", study_name="aqi_optuna")
    study.optimize(objective, n_trials=5)
    print("Meilleur trial:", study.best_trial.params)


if __name__ == "__main__":
    main()
