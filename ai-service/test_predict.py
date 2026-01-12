import os
import pandas as pd

from src.server import app


def main():
    base_dir = os.path.dirname(__file__)
    data_path = os.path.join(base_dir, 'data', 'raw', 'data2.csv')
    df = pd.read_csv(data_path)
    row = df.iloc[0]

    features = [
        float(row['PM2.5']), float(row['PM10']), float(row['NO']), float(row['NO2']),
        float(row['NOx']), float(row['NH3']), float(row['CO']), float(row['SO2']),
        float(row['O3']), float(row['Benzene']), float(row['Toluene']), float(row['Xylene'])
    ]

    with app.test_client() as client:
        resp = client.post('/api/predict', json={'features': features})
        print('Status:', resp.status_code)
        print('Response:', resp.json)


if __name__ == '__main__':
    main()
