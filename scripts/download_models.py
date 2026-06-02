import os
import urllib.request

def download_file(url, dest_path):
    print(f"Downloading {url} to {dest_path}...")
    try:
        # Create directories if they don't exist
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        # Download
        urllib.request.urlretrieve(url, dest_path)
        print(f"Successfully downloaded {dest_path} (Size: {os.path.getsize(dest_path)} bytes)")
        return True
    except Exception as e:
        print(f"Failed to download {url}: {e}")
        return False

def main():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    assets_models_dir = os.path.join(base_dir, "android", "app", "src", "main", "assets", "models")
    src_models_dir = os.path.join(base_dir, "src", "assets", "models")
    
    models = [
        {
            "name": "blazeface.tflite",
            "url": "https://storage.googleapis.com/mediapipe-assets/face_detection_short_range.tflite"
        },
        {
            "name": "mobilefacenet.tflite",
            "url": "https://github.com/MCarlomagno/FaceRecognitionAuth/raw/master/assets/mobilefacenet.tflite"
        }
    ]
    
    for model in models:
        # Download directly to Android assets
        dest_android = os.path.join(assets_models_dir, model["name"])
        success = download_file(model["url"], dest_android)
        
        # Also copy/download to src/assets/models for completeness
        if success:
            dest_src = os.path.join(src_models_dir, model["name"])
            os.makedirs(os.path.dirname(dest_src), exist_ok=True)
            import shutil
            shutil.copy2(dest_android, dest_src)
            print(f"Copied {model['name']} to src assets.")

if __name__ == "__main__":
    main()
