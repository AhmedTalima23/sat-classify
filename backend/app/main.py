from fastapi import FastAPI, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import joblib
import json
import os
from shapely.geometry import shape
import rasterio
from rasterio.windows import from_bounds
import numpy as np
import boto3
from botocore.exceptions import ClientError
from urllib.parse import urlparse

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# Model configuration
MODEL_PATH = os.environ.get('MODEL_PATH', 'models/classifier_model.pkl')
S3_BUCKET = os.environ.get('S3_BUCKET', 'your-bucket')
AWS_REGION = os.environ.get('AWS_REGION', 'us-east-1')

# Initialize S3 client
s3 = boto3.client('s3')

def get_s3_file(bucket: str, key: str):
    """Get file from S3 bucket"""
    try:
        response = s3.get_object(Bucket=bucket, Key=key)
        return response['Body']
    except ClientError as e:
        raise HTTPException(status_code=404, detail=f"File not found in S3: {str(e)}")

@app.post('/predict')
async def predict(roi: str = Form(...), input_tif_key: str = Form(...)):
    """
    Predict land classification from S3 stored GeoTIFF

    Args:
        roi: GeoJSON string containing region of interest
        input_tif_key: S3 key for input GeoTIFF file
    """
    try:
        # Load model
        model = joblib.load('xgb_model.pkl')

        # Parse ROI
        geo = json.loads(roi)
        polygon = shape(geo['features'][0]['geometry'])
        minx, miny, maxx, maxy = polygon.bounds

        # Read GeoTIFF from S3
        with rasterio.Env():
            # Create /vsimem/ file from S3
            input_file = f'/vsimem/{os.path.basename(input_tif_key)}'
            with get_s3_file(S3_BUCKET, input_tif_key) as s3_file:
                with rasterio.open(input_file) as src:
                    window = from_bounds(minx, miny, maxx, maxy, src.transform)
                    img = src.read(window=window)
                    transform = src.window_transform(window)
                    crs = src.crs

        # Prepare data for prediction
        bands, h, w = img.shape
        X = img.reshape(bands, -1).T

        # Make prediction
        y_pred = model.predict(X)
        classified = y_pred.reshape(h, w).astype('uint8')

        # Save result to temporary file
        output_filename = f'classified_{os.path.basename(input_tif_key)}'
        output_path = f'/tmp/{output_filename}'

        new_meta = {
            'driver': 'GTiff',
            'height': h,
            'width': w,
            'count': 1,
            'dtype': 'uint8',
            'crs': crs,
            'transform': transform,
            'compress': 'lzw'
        }

        # Write classified image
        with rasterio.open(output_path, 'w', **new_meta) as dst:
            dst.write(classified, 1)

        # Upload to S3
        output_key = f'outputs/{output_filename}'
        s3.upload_file(
            output_path,
            S3_BUCKET,
            output_key,
            ExtraArgs={
                'ACL': 'public-read',
                'ContentType': 'image/tiff'
            }
        )

        # Generate public URL
        url = f'https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{output_key}'

        # Cleanup temporary files
        os.remove(output_path)

        return {
            'status': 'success',
            'result_url': url,
            'metadata': {
                'crs': str(crs),
                'bounds': [minx, miny, maxx, maxy],
                'width': w,
                'height': h
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload")
async def upload_file(file: UploadFile):
    """
    Upload GeoTIFF file and return its metadata and URL
    """
    try:
        # Upload file to S3
        file_key = f"inputs/{file.filename}"
        s3.upload_fileobj(
            file.file,
            S3_BUCKET,
            file_key,
            ExtraArgs={
                'ACL': 'public-read',
                'ContentType': 'image/tiff'
            }
        )

        # Get file metadata using rasterio
        with rasterio.open(f"s3://{S3_BUCKET}/{file_key}") as src:
            bounds = src.bounds
            crs = src.crs

        # Generate public URL
        url = f"https://{S3_BUCKET}.s3.{AWS_REGION}.amazonaws.com/{file_key}"

        return {
            "status": "success",
            "url": url,
            "bounds": [bounds.left, bounds.bottom, bounds.right, bounds.top],
            "crs": str(crs)
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
