from fastapi import FastAPI, Form, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
import joblib, json, os
from shapely.geometry import shape
import rasterio
from rasterio.windows import from_bounds
import numpy as np
import boto3

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

MODELS = {
    'XGBoost': 'models/xgb_model.pkl',
    'Random Forest': 'models/rf_model.pkl',
    'LightGBM': 'models/lgbm_model.pkl'
}

S3_BUCKET = os.environ.get('S3_BUCKET', 'your-bucket')

s3 = boto3.client('s3')

@app.post('/predict')
async def predict(model_name: str = Form(...), roi: str = Form(...), tif_url: str = Form(None)):
    # Load model
    model_path = MODELS.get(model_name)
    model = joblib.load(model_path)

    geo = json.loads(roi)
    polygon = shape(geo['features'][0]['geometry'])
    minx, miny, maxx, maxy = polygon.bounds

    # Read GeoTIFF from URL (rasterio supports HTTP)
    if tif_url is None:
        return { 'detail': 'Missing tif_url' }

    with rasterio.Env():
        with rasterio.open(tif_url) as src:
            window = from_bounds(minx, miny, maxx, maxy, src.transform)
            img = src.read(window=window)
            transform = src.window_transform(window)
            crs = src.crs

    bands, h, w = img.shape
    X = img.reshape(bands, -1).T
    y_pred = model.predict(X)
    classified = y_pred.reshape(h, w).astype('uint8')

    out_tif = '/tmp/classified.tif'
    new_meta = {
        'driver': 'GTiff',
        'height': h,
        'width': w,
        'count': 1,
        'dtype': 'uint8',
        'crs': crs,
        'transform': transform
    }
    with rasterio.open(out_tif, 'w', **new_meta) as dst:
        dst.write(classified, 1)

    # Upload to S3
    key = f'outputs/{os.path.basename(out_tif)}'
    s3.upload_file(out_tif, S3_BUCKET, key, ExtraArgs={'ACL': 'public-read', 'ContentType': 'image/tiff'})
    url = f'https://{S3_BUCKET}.s3.amazonaws.com/{key}'

    return {'result_url': url}