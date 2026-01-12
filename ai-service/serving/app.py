from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import torch
from torch import nn
import os
import logging
import numpy as np

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="Air Prediction Serving API")

# Model Architecture (Must match training)
class MLP(nn.Module):
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

# Global model instance
model = None

def load_model():
    global model
    model_path = os.getenv("MODEL_PATH", "/app/models/model_v1.pt")
    input_dim = 12
    try:
        model = MLP(in_features=input_dim)
        if os.path.exists(model_path):
            state_dict = torch.load(model_path, map_location='cpu')
            model.load_state_dict(state_dict)
            model.eval()
            logger.info(f"Model loaded successfully from {model_path}")
        else:
            logger.warning(f"Model file not found at {model_path}. Prediction will fail.")
            model = None
    except Exception as e:
        logger.error(f"Error loading model: {e}")
        model = None

@app.on_event("startup")
async def startup_event():
    load_model()

class PredictionRequest(BaseModel):
    # Expecting 12 features: PM2.5, PM10, NO, NO2, NOx, NH3, CO, SO2, O3, Benzene, Toluene, Xylene
    features: list[float]

@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": model is not None}

@app.post("/predict")
def predict(request: PredictionRequest):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    if len(request.features) != 12:
        raise HTTPException(status_code=400, detail="Expected 12 features")

    try:
        inputs = torch.tensor([request.features], dtype=torch.float32)
        with torch.no_grad():
            output = model(inputs)
            prediction = output.item()
        
        return {
            "aqi_prediction": round(prediction, 2),
            "status": "success"
        }
    except Exception as e:
        logger.error(f"Prediction error: {e}")
        raise HTTPException(status_code=500, detail="Internal prediction error")
