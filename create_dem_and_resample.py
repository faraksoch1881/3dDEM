#!/usr/bin/python
import sys
import rasterio
from rasterio.warp import reproject, Resampling
from affine import Affine
import numpy as np
import requests
import os

API_KEY = "ae0dcd6ceeecbf5ada9579d49e16b3a9"
DEM_TYPE = "AW3D30"


if len(sys.argv) != 4:
    print("Usage: create_dem_and_resample.py <input_tif> <dem_out> <resample_out>")
    sys.exit(1)

input_file, dem_file, resample_file = sys.argv[1], sys.argv[2], sys.argv[3]

# 1. Open input, get bounds
try:
    with rasterio.open(input_file) as src:
        bounds = src.bounds
        src_crs = src.crs
        src_transform = src.transform
        src_dtype = src.dtypes[0]
        src_data = src.read(1)
        if np.all(np.isnan(src_data)):
            print("Uploaded raster is all NaN!")
            sys.exit(4)
        profile = src.profile.copy()
except Exception as e:
    print("Could not open input file:", e)
    sys.exit(2)

# 2. Download DEM for bounds
dem_url = (
    "https://portal.opentopography.org/API/globaldem"
    f"?demtype={DEM_TYPE}"
    f"&south={bounds.bottom}"
    f"&north={bounds.top}"
    f"&west={bounds.left}"
    f"&east={bounds.right}"
    "&outputFormat=GTiff"
    f"&API_Key={API_KEY}"
)
try:
    resp = requests.get(dem_url)
    if resp.status_code == 200:
        with open(dem_file, "wb") as f:
            f.write(resp.content)
    else:
        print("DEM download failed:", resp.text)
        sys.exit(3)
except Exception as e:
    print("DEM request failed:", e)
    sys.exit(3)

# 3. Resample to DEM grid (using DEM's transform and dimensions)
try:
    with rasterio.open(dem_file) as demsrc:
        dem_transform = demsrc.transform
        dem_crs = demsrc.crs
        dem_shape = (demsrc.height, demsrc.width)
    # Resample original to DEM grid
    resampled = np.empty(dem_shape, dtype=src_dtype)
    reproject(
        source=src_data,
        destination=resampled,
        src_transform=src_transform,
        src_crs=src_crs,
        dst_transform=dem_transform,
        dst_crs=dem_crs,
        resampling=Resampling.bilinear
    )
    profile.update({
        "driver": "GTiff",
        "height": dem_shape[0],
        "width": dem_shape[1],
        "transform": dem_transform,
        "crs": dem_crs,
        "count": 1,
        "dtype": src_dtype,
    })
    with rasterio.open(resample_file, "w", **profile) as dst:
        dst.write(resampled, 1)
except Exception as e:
    print("Resampling failed:", e)
    sys.exit(5)

# 4. Delete original input file
try:
    os.remove(input_file)
except Exception as e:
    print("Could not delete input file:", e)

print(f"Success: DEM and resampled file created.")
sys.exit(0)
