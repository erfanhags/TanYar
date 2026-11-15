import io
import os
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from face_worker import encode_image, load_models


class FaceWorkerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        load_models()

    def test_invalid_bytes_are_rejected(self):
        self.assertEqual(encode_image(b'not a photo')['code'], 'INVALID_IMAGE')

    def test_blank_image_is_not_a_face(self):
        from PIL import Image
        buffer = io.BytesIO()
        Image.new('RGB', (640, 480), 'white').save(buffer, format='JPEG')
        self.assertEqual(encode_image(buffer.getvalue())['code'], 'NO_FACE')

    @unittest.skipUnless(os.environ.get('FACE_TEST_IMAGE'), 'Set FACE_TEST_IMAGE to a single-face test fixture')
    def test_single_face_has_a_finite_128_dimensional_descriptor(self):
        import math
        result = encode_image(Path(os.environ['FACE_TEST_IMAGE']).read_bytes())
        self.assertTrue(result['ok'])
        self.assertEqual(result['model'], 'dlib-hog-128-v1')
        self.assertEqual(len(result['descriptor']), 128)
        self.assertTrue(all(math.isfinite(value) for value in result['descriptor']))

    @unittest.skipUnless(os.environ.get('FACE_TEST_MULTIPLE'), 'Set FACE_TEST_MULTIPLE to a multiple-face test fixture')
    def test_multiple_faces_are_rejected(self):
        result = encode_image(Path(os.environ['FACE_TEST_MULTIPLE']).read_bytes())
        self.assertEqual(result['code'], 'MULTIPLE_FACES')


if __name__ == '__main__':
    unittest.main()
