import unittest
from unittest.mock import MagicMock, patch
import sys

# Mock tensorflow before importing ai_service to avoid loading the heavy model
sys.modules["tensorflow"] = MagicMock()
sys.modules["tensorflow.keras"] = MagicMock()
sys.modules["tensorflow.keras.applications.mobilenet_v2"] = MagicMock()
sys.modules["tensorflow.keras.preprocessing"] = MagicMock()
sys.modules["tensorflow.keras.preprocessing.image"] = MagicMock()

from app.services.ai_service import AIService

class TestAIService(unittest.TestCase):
    def setUp(self):
        # Reset singleton for each test if needed, or just patch the instance
        AIService._instance = None
        
    @patch('app.services.ai_service.MobileNetV2')
    @patch('app.services.ai_service.decode_predictions')
    @patch('app.services.ai_service.Image.open')
    @patch('app.services.ai_service.keras_image.img_to_array')
    @patch('app.services.ai_service.preprocess_input')
    def test_is_animal_success(self, mock_preprocess, mock_img_to_array, mock_open, mock_decode, mock_mobilenet):
        # Setup mocks
        mock_model = MagicMock()
        mock_mobilenet.return_value = mock_model
        
        # Mock Image.open
        mock_img = MagicMock()
        mock_img.mode = 'RGB'
        mock_open.return_value = mock_img
        mock_img.resize.return_value = mock_img
        
        # Mock prediction output (Labrador)
        mock_model.predict.return_value = [[0.1, 0.9]]
        mock_decode.return_value = [[('n02099712', 'Labrador_retriever', 0.9)]]
        
        service = AIService()
        
        # Create dummy image bytes
        image_bytes = b'fake_image_data'
        
        # Test
        result = service.is_animal(image_bytes)
        
        # Verify
        self.assertTrue(result['is_animal'])
        self.assertEqual(result['animal_type'], 'Labrador retriever')
        self.assertEqual(result['confidence_score'], 0.9)

    @patch('app.services.ai_service.MobileNetV2')
    @patch('app.services.ai_service.decode_predictions')
    @patch('app.services.ai_service.Image.open')
    @patch('app.services.ai_service.keras_image.img_to_array')
    @patch('app.services.ai_service.preprocess_input')
    def test_is_animal_failure(self, mock_preprocess, mock_img_to_array, mock_open, mock_decode, mock_mobilenet):
        # Setup mocks
        mock_model = MagicMock()
        mock_mobilenet.return_value = mock_model
        
        # Mock Image.open
        mock_img = MagicMock()
        mock_img.mode = 'RGB'
        mock_open.return_value = mock_img
        mock_img.resize.return_value = mock_img
        
        # Mock prediction output (Toaster - not an animal)
        mock_model.predict.return_value = [[0.9, 0.1]]
        mock_decode.return_value = [[('n00000000', 'toaster', 0.9)]]
        
        service = AIService()
        
        # Test
        result = service.is_animal(b'fake')
        
        # Verify
        self.assertFalse(result['is_animal'])
        self.assertEqual(result['animal_type'], 'toaster')

if __name__ == '__main__':
    unittest.main()
