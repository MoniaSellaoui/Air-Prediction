import requests
import json
import time

URL = "http://localhost:8000/predict"
HEALTH_URL = "http://localhost:8000/health"

test_data = {
    "features": [60.0, 100.0, 15.0, 20.0, 30.0, 5.0, 0.8, 10.0, 45.0, 1.2, 2.5, 0.5]
}

def test_inference():
    print(f"Checking health at {HEALTH_URL}...")
    try:
        response = requests.get(HEALTH_URL)
        print(f"Health check: {response.json()}")
    except Exception as e:
        print(f"Health check failed: {e}")
        return

    print(f"Sending prediction request to {URL}...")
    try:
        response = requests.post(URL, json=test_data)
        if response.status_code == 200:
            print("Prediction Success!")
            print(json.dumps(response.json(), indent=2))
        else:
            print(f"Prediction Failed with status {response.status_code}")
            print(response.text)
    except Exception as e:
        print(f"Request failed: {e}")

if __name__ == "__main__":
    test_inference()
