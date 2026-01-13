# ai-service/ai_server.py

import grpc
from concurrent import futures
import joblib
import json
from kafka import KafkaProducer
import prediction_pb2
import prediction_pb2_grpc
from prometheus_client import Counter, Histogram, Gauge, start_http_server
import time

# Prometheus metrics
PREDICTIONS_TOTAL = Counter('predictions_total', 'Total predictions made', ['status'])
PREDICTION_DURATION = Histogram('prediction_duration_seconds', 'Prediction duration in seconds')
PREDICTION_AQI_GAUGE = Gauge('prediction_aqi_value', 'Current AQI prediction value')
ALERTS_TOTAL = Counter('alerts_total', 'Total high AQI alerts')

# Load models
regressor = joblib.load("")
classifier = joblib.load("")

# Kafka setup
producer = KafkaProducer(
    bootstrap_servers=['localhost:9092'],
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

class PredictionService(prediction_pb2_grpc.PredictionServiceServicer):
    def Predict(self, request, context):
        start_time = time.time()
        try:
            features = [
                request.pm25, request.pm10, request.no, request.no2, request.nox,
                request.nh3, request.co, request.so2, request.o3,
                request.benzene, request.toluene, request.xylene
            ]
            aqi = regressor.predict([features])[0]
            bucket = classifier.predict([features])[0]

            prediction = {
                "user_id": request.user_id,
                "location": request.location,
                "aqi": round(aqi),
                "bucket": str(bucket)
            }

            producer.send("predictions", prediction)
            PREDICTIONS_TOTAL.labels(status='success').inc()
            PREDICTION_AQI_GAUGE.set(round(aqi))
            
            if aqi > 100:
                producer.send("alerts", prediction)
                ALERTS_TOTAL.inc()

            duration = time.time() - start_time
            PREDICTION_DURATION.observe(duration)

            return prediction_pb2.PredictionResponse(
                aqi=round(aqi),
                bucket=str(bucket)
            )
        except Exception as e:
            PREDICTIONS_TOTAL.labels(status='error').inc()
            raise

def serve():
    # Start Prometheus metrics server
    start_http_server(8001)
    
    server = grpc.server(futures.ThreadPoolExecutor(max_workers=10))
    prediction_pb2_grpc.add_PredictionServiceServicer_to_server(PredictionService(), server)
    server.add_insecure_port("[::]:6000")
    server.start()
    print("AI Prediction Service running on port 6000")
    server.wait_for_termination()

if __name__ == '__main__':
    serve()
