# TFLite Models

Place the following pre-trained TFLite models in this directory:

## Required Models

| Model | Filename | Size | Source |
|-------|----------|------|--------|
| BlazeFace | `blazeface.tflite` | ~0.1MB | [MediaPipe/BlazeFace](https://github.com/nicadre/blazeface/tree/master/model) |
| Face Landmarks | `face_landmark.tflite` | ~0.4MB | [MediaPipe Face Mesh](https://github.com/google/mediapipe) |
| MobileFaceNet | `mobilefacenet.tflite` | ~1.0MB | [MobileFaceNet](https://github.com/nicadre/MobileFaceNet/releases) |
| MiniFASNet | `minifasnet.tflite` | ~2.7MB | [Silent-Face-Anti-Spoofing](https://github.com/minivision-ai/Silent-Face-Anti-Spoofing) |

## Download Instructions

```bash
# BlazeFace (short-range face detection)
# Download from MediaPipe or convert from TF Hub

# MobileFaceNet (face recognition/embedding)
# Pre-trained weights available at:
# https://github.com/nicadre/MobileFaceNet/releases

# Face Landmarks (68-point)
# Available from dlib or MediaPipe face mesh

# MiniFASNet (liveness/anti-spoofing)
# Convert from PyTorch weights at:
# https://github.com/minivision-ai/Silent-Face-Anti-Spoofing
```

## Quantization

All models should be INT8 quantized for optimal mobile performance.
See `scripts/quantize_models.py` for the quantization pipeline.

## Total Size Budget

```
blazeface.tflite       :  0.1 MB
face_landmark.tflite   :  0.4 MB
mobilefacenet.tflite   :  1.0 MB
minifasnet.tflite      :  2.7 MB
─────────────────────────────────
TOTAL                  :  4.2 MB  (budget: 20 MB)
```
