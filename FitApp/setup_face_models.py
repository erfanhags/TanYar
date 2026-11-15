"""Download only the two required official models and verify their Git hashes."""
import concurrent.futures
import hashlib
import os
from pathlib import Path
import urllib.request

MODELS = {
    'shape_predictor_5_face_landmarks.dat': (9150489, '67878ed3894d929c5e03bd1ad2d931cc6d745ee7'),
    'dlib_face_recognition_resnet_model_v1.dat': (22466066, 'ddb515897db3724ddeed593083d3f39818db1a54'),
}
BASE_URL = 'https://raw.githubusercontent.com/ageitgey/face_recognition_models/master/face_recognition_models/models/'


def valid(path, size, git_hash):
    if not path.exists() or path.stat().st_size != size:
        return False
    digest = hashlib.sha1(f'blob {size}\0'.encode())
    with path.open('rb') as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b''):
            digest.update(chunk)
    return digest.hexdigest() == git_hash


def download(item):
    name, (size, git_hash) = item
    folder = Path(os.environ.get('FACE_MODEL_DIR', str(Path(__file__).resolve().parent.parent / 'face-runtime' / 'models')))
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / name
    if valid(target, size, git_hash):
        print(f'[OK] {name}', flush=True)
        return
    temporary = target.with_suffix('.download')
    for attempt in range(3):
        print(f'Downloading {name} ({size // 1_000_000} MB), attempt {attempt + 1}', flush=True)
        try:
            request = urllib.request.Request(BASE_URL + name, headers={'User-Agent': 'TanYar-Face-Setup'})
            with urllib.request.urlopen(request, timeout=60) as response, temporary.open('wb') as file:
                while chunk := response.read(256 * 1024):
                    file.write(chunk)
            if not valid(temporary, size, git_hash):
                raise ValueError('Incomplete model or checksum mismatch')
            temporary.replace(target)
            print(f'[OK] {name}', flush=True)
            return
        except Exception as error:
            if attempt == 2:
                raise RuntimeError(f'Could not download {name}: {error}') from error


if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(download, MODELS.items()))
    print('Face models are ready. Run start_app.bat.', flush=True)
