import os
import pandas as pd


def load_data():
    """Charge le dataset data2.csv depuis ai-service/data/raw.

    Retourne:
        X: DataFrame des features
        y: Series de la cible (à adapter selon tes colonnes)
    """
    # __file__ = ai-service/mlops/steps/data_loader.py
    # On remonte de deux niveaux pour arriver à ai-service/
    base_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
    data_path = os.path.join(base_dir, "data", "raw", "data2.csv")

    if not os.path.exists(data_path):
        raise FileNotFoundError(f"Dataset introuvable: {data_path}")

    df = pd.read_csv(data_path)

    # Colonnes réelles de data2.csv (d'après ton extrait) :
    # City, Date, PM2.5, PM10, NO, NO2, NOx, NH3, CO, SO2, O3, Benzene,
    # Toluene, Xylene, AQI, AQI_Bucket
    # On prend comme features les polluants normalisés et comme cible l'AQI.
    feature_cols = [
        "PM2.5",
        "PM10",
        "NO",
        "NO2",
        "NOx",
        "NH3",
        "CO",
        "SO2",
        "O3",
        "Benzene",
        "Toluene",
        "Xylene",
    ]
    target_col = "AQI"

    missing = [c for c in feature_cols + [target_col] if c not in df.columns]
    if missing:
        raise ValueError(f"Colonnes manquantes dans le dataset: {missing}")

    X = df[feature_cols]
    y = df[target_col]
    return X, y
