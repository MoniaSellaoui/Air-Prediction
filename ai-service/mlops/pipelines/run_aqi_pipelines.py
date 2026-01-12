"""Scripts de lancement des pipelines ZenML pour l'API AQI.

On définit :
- un run "baseline" avec des hyperparamètres par défaut
- une "grille" de plusieurs runs pour simuler un scénario de CT / tuning

Utilisation (depuis le dossier `ai-service`):

    # Baseline
    python -m mlops.pipelines.run_aqi_pipelines --mode baseline

    # Grille de plusieurs runs (CT / tuning)
    python -m mlops.pipelines.run_aqi_pipelines --mode grid
"""

import argparse

from mlops.pipelines.training_pipeline import aqi_training_pipeline


def run_baseline() -> None:
    """Lance un run baseline du pipeline AQI."""
    aqi_training_pipeline(
        epochs=5,
        batch_size=64,
        lr=1e-3,
        run_name="aqi_baseline_e5_bs64_lr1e-3",
    )


def run_grid() -> None:
    """Lance plusieurs exécutions du pipeline avec différents hyperparamètres.

    Cela simule un scénario de CT / tuning simple.
    """
    configs = [
        {"epochs": 5, "batch_size": 32, "lr": 1e-3, "run_name": "aqi_e5_bs32_lr1e-3"},
        {"epochs": 10, "batch_size": 64, "lr": 1e-3, "run_name": "aqi_e10_bs64_lr1e-3"},
        {"epochs": 5, "batch_size": 128, "lr": 5e-4, "run_name": "aqi_e5_bs128_lr5e-4"},
    ]

    for cfg in configs:
        print(f"[ZenML] Lancement du pipeline AQI avec paramètres : {cfg}")
        aqi_training_pipeline(**cfg)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--mode",
        type=str,
        choices=["baseline", "grid"],
        default="baseline",
        help="Mode d'exécution du pipeline (baseline ou grid)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    if args.mode == "baseline":
        run_baseline()
    elif args.mode == "grid":
        run_grid()


if __name__ == "__main__":
    main()
