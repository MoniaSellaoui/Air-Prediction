import torch
from torch import nn
from torch.utils.data import TensorDataset, DataLoader
import numpy as np


class MLP(nn.Module):
    """Petit réseau fully-connected pour la régression AQI.

    À adapter selon ton cas (classification, plus de features, etc.).
    """

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


def train_model(X, y, epochs: int = 5, batch_size: int = 64, lr: float = 1e-3):
    """Entraîne un modèle MLP simple sur (X, y)."""
    X_tensor = torch.tensor(np.array(X), dtype=torch.float32)
    y_tensor = torch.tensor(np.array(y).reshape(-1, 1), dtype=torch.float32)

    dataset = TensorDataset(X_tensor, y_tensor)
    dataloader = DataLoader(dataset, batch_size=batch_size, shuffle=True)

    model = MLP(in_features=X_tensor.shape[1])
    criterion = nn.MSELoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)

    for epoch in range(epochs):
        epoch_loss = 0.0
        for xb, yb in dataloader:
            preds = model(xb)
            loss = criterion(preds, yb)

            optimizer.zero_grad()
            loss.backward()
            optimizer.step()

            epoch_loss += loss.item() * xb.size(0)

        epoch_loss /= len(dataset)
        print(f"Epoch {epoch+1}/{epochs} - loss={epoch_loss:.4f}")

    return model
