import unittest
import numpy as np
import os
import sys
import joblib

# Ajout du chemin source au PYTHONPATH
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

class TestPredictions(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        """Chargement du modèle pour les tests."""
        model_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'models/aqi_model.pkl')
        try:
            cls.model = joblib.load(model_path)
        except Exception as e:
            print(f"Erreur lors du chargement du modèle: {str(e)}")
            raise

    def test_model_prediction_shape(self):
        """Test si le modèle peut faire des prédictions avec la bonne forme."""
        # Données de test
        test_features = np.array([[20.5, 40.2, 30.1, 12.4, 4.2, 0.6]])
        
        # Prédiction
        prediction = self.model.predict(test_features)
        
        # Vérification
        self.assertEqual(len(prediction), 1, "La prédiction devrait être un scalaire")
        self.assertTrue(isinstance(prediction[0], (np.float64, float)), "La prédiction devrait être un nombre")

    def test_model_prediction_range(self):
        """Test si les prédictions sont dans une plage raisonnable (0-500 pour AQI)."""
        # Données de test
        test_features = np.array([[20.5, 40.2, 30.1, 12.4, 4.2, 0.6]])
        
        # Prédiction
        prediction = self.model.predict(test_features)
        
        # Vérification
        self.assertTrue(0 <= prediction[0] <= 500, "La prédiction AQI devrait être entre 0 et 500")

if __name__ == '__main__':
    unittest.main() 