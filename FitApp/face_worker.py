"""Local HOG/128-d face encoder; images are processed in memory, never saved.

Uses the same face_recognition pipeline as the referenced attendance project:
https://github.com/schafiled2006/smart-attendance-system
"""
import base64
import io
import json
import os
import sys
import warnings
from pathlib import Path

warnings.filterwarnings('ignore', category=UserWarning)
_models = None


def load_models():
    global _models
    if _models is None:
        import dlib
        folder = Path(os.environ.get('FACE_MODEL_DIR', str(Path(__file__).resolve().parent.parent / 'face-runtime' / 'models')))
        _models = (
            dlib.get_frontal_face_detector(),
            dlib.shape_predictor(str(folder / 'shape_predictor_5_face_landmarks.dat')),
            dlib.face_recognition_model_v1(str(folder / 'dlib_face_recognition_resnet_model_v1.dat')),
        )
    return _models


def reply(payload):
    print(json.dumps(payload, ensure_ascii=True), flush=True)


def encode_image(data):
    from PIL import Image, ImageOps, UnidentifiedImageError
    import numpy as np
    detector, landmarks, encoder = load_models()

    try:
        with Image.open(io.BytesIO(data)) as image:
            if image.width * image.height > 16_000_000:
                return {'ok': False, 'code': 'INVALID_IMAGE'}
            image = ImageOps.exif_transpose(image).convert('RGB')
            image.thumbnail((640, 640))
            rgb = np.array(image, dtype=np.uint8)
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        return {'ok': False, 'code': 'INVALID_IMAGE'}
    locations = detector(rgb, 1)
    if not locations:
        return {'ok': False, 'code': 'NO_FACE'}
    if len(locations) != 1:
        return {'ok': False, 'code': 'MULTIPLE_FACES'}
    location = locations[0]
    if min(location.height(), location.width()) < 65:
        return {'ok': False, 'code': 'FACE_TOO_SMALL'}
    shape = landmarks(rgb, location)
    descriptor = np.asarray(encoder.compute_face_descriptor(rgb, shape, 1), dtype=np.float64)
    if descriptor.shape != (128,) or not np.isfinite(descriptor).all():
        return {'ok': False, 'code': 'INVALID_IMAGE'}
    return {'ok': True, 'model': 'dlib-hog-128-v1', 'descriptor': descriptor.tolist()}


def main():
    try:
        import dlib
        import numpy
        from PIL import Image
        load_models()  # Same Dlib HOG + five landmarks + ResNet as face_recognition.
    except (ImportError, RuntimeError):
        reply({'ready': False, 'code': 'ENGINE_UNAVAILABLE'})
        return
    reply({'ready': True})
    for line in sys.stdin.buffer:
        request_id = None
        try:
            if len(line) > 1_500_000:
                reply({'id': None, 'ok': False, 'code': 'INVALID_IMAGE'})
                continue
            request = json.loads(line)
            request_id = request.get('id')
            data = base64.b64decode(request['image'], validate=True)
            result = encode_image(data)
            reply({'id': request_id, **result})
        except (ValueError, KeyError, TypeError):
            reply({'id': request_id, 'ok': False, 'code': 'INVALID_IMAGE'})
        except Exception:
            reply({'id': request_id, 'ok': False, 'code': 'ENCODING_FAILED'})


if __name__ == '__main__':
    main()
