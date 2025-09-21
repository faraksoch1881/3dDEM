<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Geo Upload Dashboard</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <!-- Bootstrap 5 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <!-- SweetAlert2 CSS -->
  <link href="https://cdn.jsdelivr.net/npm/sweetalert2@11/dist/sweetalert2.min.css" rel="stylesheet">
  <!-- Font Awesome (latest, only CSS needed for icons) -->
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css">

  <script src="https://cdn.jsdelivr.net/npm/geotiff@2.1.4-beta.0/dist-browser/geotiff.min.js"></script>

  <style>
    html, body { height: 100%; }
    body { min-height: 100vh; background: #f8fafb; }
    .main-container { height: 100vh; display: flex; flex-direction: row; }
    .left-col {
      background: #fff; padding: 2rem 1.5rem; box-shadow: 2px 0 20px 0 rgba(30,40,90,.06);
      min-width: 450px; max-width: 550px; width: 100%; display: flex; flex-direction: column;
      justify-content: center; z-index: 2;
    }
    .right-col {
      flex: 1 1 auto; position: relative; background: #181d2b; display: flex;
      align-items: center; justify-content: center; height: 100vh; padding: 0; overflow: hidden;
    }
    .right-col video {
      width: 100vw; height: 100vh; object-fit: cover;
    }
    .tab-pane {
      min-height: 300px; display: flex; flex-direction: column;
      justify-content: center; align-items: center;
    }
    .fa-upload, .fa-paper-plane { margin-right: 6px; }
    .loader-bg {
      position: fixed; left: 0; top: 0; width: 100vw; height: 100vh; z-index: 99999;
      background: rgba(255,255,255,0.8); display: flex; align-items: center; justify-content: center;
    }
    .tab-pane button[type=button], .tab-pane button[type=submit] {
      width: auto !important;
      min-width: 140px;
      margin-bottom: 10px;
    }
    .tab-pane .btn + .btn { margin-left: 0; }
    @media (max-width: 992px) {
      .main-container { flex-direction: column; }
      .right-col { height: 350px; }
    }

  .nav-tabs .nav-link {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 10px 15px; /* Adjust padding as needed */
  }
  .nav-tabs .nav-link i {
    display: block;
    margin-bottom: 5px; /* Space between icon and text */
  }
  .nav-tabs .nav-link span {
    display: block;
  }

#timeseriesFileTable {
  width: 100%; /* Ensure table takes full width of its container */
  max-width: 100%; /* Prevent overflow beyond left-col */
  margin-left: 0; /* Align table to the left */
  margin-right: auto; /* Allow right margin to adjust naturally */
  table-layout: auto; /* Allow table to adjust column widths based on content */
  font-size: 12px;
}

#tsProgressWrapper {
  width: 100%;
  max-width: 100%;
  margin-left: 0;
  margin-right: auto;
}

#cProgressWrapper {
  width: 100%;
  max-width: 100%;
  margin-left: 0;
  margin-right: auto;
}
  </style>
</head>
<body>
<div class="main-container">
  <!-- Left Column: Tabs & Upload -->
  <div class="left-col">
    <h3 class="text-center mb-4 fw-bold text-primary">
      <i class="fa-solid fa-earth-asia me-2"></i>Geo Upload Portal
    </h3>

    <!-- Tabs -->

    <ul class="nav nav-tabs mb-3" id="myTab" role="tablist">
      <li class="nav-item" role="presentation">
        <button class="nav-link active" id="timeseries-tab" data-bs-toggle="tab" data-bs-target="#timeseries" type="button" role="tab">
          <i class="fa-solid fa-chart-line"></i>
          <span>Time Series</span>
        </button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="contour-tab" data-bs-toggle="tab" data-bs-target="#contour" type="button" role="tab">
          <i class="fa-solid fa-draw-polygon"></i>
          <span>Contour</span>
        </button>
      </li>
      <li class="nav-item" role="presentation">
        <button class="nav-link" id="visualization-tab" data-bs-toggle="tab" data-bs-target="#visualization" type="button" role="tab">
          <i class="fa-solid fa-mountain-sun"></i>
          <span>Visualization</span>
        </button>
      </li>
    </ul>

    <!-- Tab Contents -->
    <div class="tab-content flex-grow-1">

      <!-- Time Series -->

      <div class="tab-pane fade show active text-center" id="timeseries" role="tabpanel">
        <input type="file" id="timeseriesFile" accept=".json" multiple class="d-none">

        <div class="my-4">
          <button class="btn btn-outline-primary" onclick="document.getElementById('timeseriesFile').click()">
            <i class="fa-solid fa-upload"></i> Upload .json (Max 2 files)
          </button>
        </div>

        <div class="my-4 w-75 mx-auto">
          <table id="timeseriesFileTable" class="table table-sm table-bordered text-muted" style="display: none;">
            <thead>
              <tr>
                <th scope="col">File Name</th>
                <th scope="col">Size (KB)</th> <!-- Changed from MB to KB -->
              </tr>
            </thead>
            <tbody id="timeseriesFileList"></tbody>
          </table>
        </div>

        <div class="my-4 w-75 mx-auto" id="tsProgressWrapper" style="display:none;">
          <div class="progress" style="height: 25px;">
            <div id="tsProgressBar" class="progress-bar progress-bar-striped progress-bar-animated"
                 role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
          </div>
        </div>

        <div class="my-4">
          <button class="btn btn-primary px-4" id="submitTimeSeries" disabled>
            <i class="fa-solid fa-paper-plane"></i> Submit
          </button>
        </div>
      </div>

      <!-- Contour -->
      <div class="tab-pane fade text-center" id="contour" role="tabpanel">
        <input type="file" id="contourFile" accept=".geojson" class="d-none">

        <div class="my-4">
          <button class="btn btn-outline-success" onclick="document.getElementById('contourFile').click()">
            <i class="fa-solid fa-upload"></i> Upload .geojson
          </button>
        </div>

        <div id="contourFileName" class="text-center small text-muted mb-4"></div>

      <div class="my-4 w-75 mx-auto" id="cProgressWrapper" style="display:none;">
        <div class="progress" style="height: 25px;">
          <div id="cProgressBar" class="progress-bar progress-bar-striped progress-bar-animated"
               role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
        </div>
      </div>

        <div class="my-4">
          <button class="btn btn-success px-4" id="submitContour" disabled>
            <i class="fa-solid fa-paper-plane"></i> Submit
          </button>
        </div>
      </div>

      <!-- Visualization -->
      <div class="tab-pane fade text-center" id="visualization" role="tabpanel">
        <input type="file" id="visualizationFile" accept=".tif,.tiff" class="d-none">

        <div class="my-4">
          <button class="btn btn-outline-warning" onclick="document.getElementById('visualizationFile').click()">
            <i class="fa-solid fa-upload"></i> Upload .tif
          </button>
        </div>

        <div id="visualizationFileName" class="text-center small text-muted mb-4"></div>

        <div class="my-4">
          <button class="btn btn-warning px-4" id="submitVisualization" disabled>
            <i class="fa-solid fa-paper-plane"></i> Submit
          </button>

        <div class="my-4 w-75 mx-auto" id="vProgressWrapper" style="display:none;">
          <div class="progress" style="height: 25px;">
            <div id="vProgressBar" class="progress-bar progress-bar-striped progress-bar-animated"
                 role="progressbar" style="width: 0%;" aria-valuenow="0" aria-valuemin="0" aria-valuemax="100">0%</div>
          </div>
        </div>

        </div>

      </div>
    </div>
<!-- End Visulization -->

  </div>

  <!-- Right Column: Video -->
  <div class="right-col">
    <video src="3dsub.mp4" controls autoplay muted loop></video>
  </div>
</div>


<!-- Loader (hidden initially) -->
<div id="loader" class="loader-bg" style="display:none;">
  <img src="loader.gif" alt="Loading..." width="80"><br>
  <div class="mt-2">Uploading file, please wait...</div>
</div>

<!-- Bootstrap 5 JS, SweetAlert2, FontAwesome (already in <head>) -->
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
<script>
function showLoader(msg){
  document.getElementById('loader').style.display = 'flex';
  document.querySelector('#loader .mt-2').innerText = msg || "Uploading file, please wait...";
}
function hideLoader(){
  document.getElementById('loader').style.display = 'none';
}

function calculateArea(widthDeg, heightDeg, avgLat) {
  const earthRadius = 6371; // Earth's radius in km
  const toRadians = (deg) => deg * Math.PI / 180;

  // Approximate km per degree of longitude at given latitude
  const kmPerDegLon = Math.cos(toRadians(avgLat)) * earthRadius * (Math.PI / 180);
  const kmPerDegLat = earthRadius * (Math.PI / 180); // Approx. km per degree of latitude

  // Calculate area in km²
  const widthKm = widthDeg * kmPerDegLon;
  const heightKm = heightDeg * kmPerDegLat;
  return widthKm * heightKm;
}


// -------- Time Series --------
const tsInput = document.getElementById('timeseriesFile');
const tsSubmit = document.getElementById('submitTimeSeries');
const tsFileTable = document.getElementById('timeseriesFileTable');
const tsFileList = document.getElementById('timeseriesFileList');
const tsProgressWrapper = document.getElementById('tsProgressWrapper');
const tsProgressBar = document.getElementById('tsProgressBar');

tsInput.addEventListener('change', () => {
  tsFileList.innerHTML = ''; // Clear previous table content
  if (tsInput.files.length) {
    if (tsInput.files.length > 2) {
      tsInput.value = ''; // Clear the input
      Swal.fire({
        icon: 'error',
        title: 'Too Many Files',
        text: 'You can upload a maximum of 2 .json files.'
      });
      tsFileTable.style.display = 'none';
      tsSubmit.disabled = true;
      return;
    }

    // Populate table with file names and sizes
    Array.from(tsInput.files).forEach(file => {
      const row = document.createElement('tr');
      const nameCell = document.createElement('td');
      const sizeCell = document.createElement('td');
      nameCell.textContent = file.name;
      sizeCell.textContent = (file.size / 1024).toFixed(2); // Size in KB
      row.appendChild(nameCell);
      row.appendChild(sizeCell);
      tsFileList.appendChild(row);
    });

    tsFileTable.style.display = 'table'; // Show the table
    tsSubmit.disabled = false;
  } else {
    tsFileTable.style.display = 'none'; // Hide the table
    tsSubmit.disabled = true;
  }
});

tsSubmit.addEventListener('click', async () => {
  const files = Array.from(tsInput.files);
  if (!files.length) return;

  // Validate JSON files and determine types
  let locationFile = null;
  let dispFile = null;

  for (const file of files) {
    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      const keys = Array.isArray(jsonData) && jsonData[0] ? Object.keys(jsonData[0]) : Object.keys(jsonData);
      const isLocation = keys.includes('id') && keys.includes('lat') && keys.includes('lon');
      if (isLocation) {
        locationFile = file;
      } else {
        dispFile = file;
      }
    } catch (e) {
      Swal.fire({
        icon: 'error',
        title: 'Invalid JSON',
        text: `File ${file.name} is not a valid JSON file.`
      });
      return;
    }
  }

  if (!locationFile || !dispFile) {
    Swal.fire({
      icon: 'error',
      title: 'Invalid Files',
      text: 'Please upload one JSON file with id, lat, and lon keys (ts_location) and one without (disp_ts).'
    });
    return;
  }

  // Show progress bar
  tsProgressWrapper.style.display = 'block';
  tsProgressBar.style.width = '0%';
  tsProgressBar.textContent = '0%';
  tsProgressBar.classList.remove('bg-success', 'bg-danger');

  // Upload both files
  const formData = new FormData();
  formData.append('files[]', locationFile);
  formData.append('files[]', dispFile);

  try {
    const response = await uploadFile(formData, percent => {
      tsProgressBar.style.width = percent + '%';
      tsProgressBar.textContent = percent + '%';
    });

    if (response.success && response.ts_url && response.disp_url) {
      tsProgressBar.classList.add('bg-success');
      tsProgressBar.textContent = 'Completed';

      // Construct and log the iframe URL
      const iframeUrl = `https://insarplusktm.alwaysdata.net/?ts_url=${encodeURIComponent(response.ts_url)}&disp_url=${encodeURIComponent(response.disp_url)}`;
      console.log('Sagar:', iframeUrl);

      // Replace video with iframe
      const rightCol = document.querySelector('.right-col');
      rightCol.innerHTML = ''; // Clear existing content (video)
      const iframe = document.createElement('iframe');
      iframe.src = iframeUrl;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      rightCol.appendChild(iframe);
    } else {
      tsProgressBar.classList.add('bg-danger');
      tsProgressBar.textContent = 'Failed';
      Swal.fire('Upload Failed', response.error || 'Unknown error', 'error');
    }
  } catch (err) {
    tsProgressBar.classList.add('bg-danger');
    tsProgressBar.textContent = 'Error';
    Swal.fire('Upload Failed', err.error || 'Unknown error', 'error');
    console.error('Upload error:', err);
  }
});

// -------- Contour --------
const cInput = document.getElementById('contourFile');
const cSubmit = document.getElementById('submitContour');
const cProgressWrapper = document.getElementById('cProgressWrapper');
const cProgressBar = document.getElementById('cProgressBar');

cInput.addEventListener('change', async () => {
  document.getElementById('contourFileName').innerText = '';
  cSubmit.disabled = true;
  cProgressWrapper.style.display = 'none'; // Hide progress bar initially

  if (cInput.files.length) {
    const file = cInput.files[0];

    try {
      const text = await file.text();
      const jsonData = JSON.parse(text);

      // Validate GeoJSON structure
      if (!jsonData.type || jsonData.type !== 'FeatureCollection' || !jsonData.features || !Array.isArray(jsonData.features)) {
        cInput.value = '';
        Swal.fire({
          icon: 'error',
          title: 'Invalid GeoJSON',
          text: `File ${file.name} is not a valid GeoJSON file. It must be a FeatureCollection with a features array.`
        });
        return;
      }

      // If valid, show file name and enable submit
      document.getElementById('contourFileName').innerText = `${file.name} (${(file.size / 1024).toFixed(2)} KB)`;
      cSubmit.disabled = false;
    } catch (e) {
      cInput.value = '';
      Swal.fire({
        icon: 'error',
        title: 'Invalid JSON',
        text: `File ${file.name} is not a valid JSON file.`
      });
    }
  }
});

cSubmit.addEventListener('click', async () => {
  const file = cInput.files[0];
  if (!file) return;

  // Show progress bar
  cProgressWrapper.style.display = 'block';
  cProgressBar.style.width = '0%';
  cProgressBar.textContent = '0%';
  cProgressBar.classList.remove('bg-success', 'bg-danger');

  // Upload file
  const formData = new FormData();
  formData.append('file', file); // Use 'file' for single file upload

  try {
    const response = await uploadFile(formData, percent => {
      cProgressBar.style.width = percent + '%';
      cProgressBar.textContent = percent + '%';
    });

    if (response.success && response.geo_url) {
      cProgressBar.classList.add('bg-success');
      cProgressBar.textContent = 'Completed';

      // Construct and log the iframe URL
      const iframeUrl = `https://insarplusktm.alwaysdata.net/index_geo.php?geo_url=${encodeURIComponent(response.geo_url)}`;
      console.log('geojson:', iframeUrl);

      // Replace video with iframe
      const rightCol = document.querySelector('.right-col');
      rightCol.innerHTML = ''; // Clear existing content (video)
      const iframe = document.createElement('iframe');
      iframe.src = iframeUrl;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';
      rightCol.appendChild(iframe);
    } else {
      cProgressBar.classList.add('bg-danger');
      cProgressBar.textContent = 'Failed';
      Swal.fire('Upload Failed', response.error || 'Unknown error', 'error');
    }
  } catch (err) {
    cProgressBar.classList.add('bg-danger');
    cProgressBar.textContent = 'Error';
    Swal.fire('Upload Failed', err.error || 'Unknown error', 'error');
    console.error('Upload error:', err);
  }
});

// -------- Visualization --------
const vInput = document.getElementById('visualizationFile');
const vSubmit = document.getElementById('submitVisualization');
const vProgressWrapper = document.getElementById('vProgressWrapper');
const vProgressBar = document.getElementById('vProgressBar');

vInput.addEventListener('change', async () => {
  vSubmit.disabled = true;
  document.getElementById('visualizationFileName').innerText = '';
  vProgressWrapper.style.display = 'none'; // Hide progress bar initially

  if (vInput.files.length) {
    const file = vInput.files[0];

    // Check file size (150 MB)
    if (file.size > 150 * 1024 * 1024) {
      vInput.value = '';
      Swal.fire({
        icon: 'error',
        title: 'File size exceeded!',
        text: 'Please upload a .tif file less than 150 MB.'
      });
      return;
    }

    try {
      // Read GeoTIFF using geotiff.js
      const arrayBuffer = await file.arrayBuffer();
      const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
      const image = await tiff.getImage();
      const geoKeys = image.getGeoKeys() || {};

      // Check CRS (WGS 84, EPSG:4326)
      let isWgs84 = false;
      if (geoKeys.GeographicTypeGeoKey === 4326) {
        isWgs84 = true;
      } else if (geoKeys.ProjectedCSTypeGeoKey || !geoKeys.GeographicTypeGeoKey) {
        Swal.fire({
          icon: 'warning',
          title: 'CRS Warning',
          text: 'The GeoTIFF does not explicitly use WGS 84 (EPSG:4326). Proceeding without strict CRS validation.'
        });
        isWgs84 = true;
      } else {
        vInput.value = '';
        Swal.fire({
          icon: 'error',
          title: 'Invalid CRS!',
          text: 'The GeoTIFF must use WGS 84 (EPSG:4326) as the Coordinate Reference System.'
        });
        return;
      }

      // Get bounding box and calculate area
      const bbox = image.getBoundingBox(); // [minX, minY, maxX, maxY]
      const widthDeg = Math.abs(bbox[2] - bbox[0]); // Longitude difference
      const heightDeg = Math.abs(bbox[3] - bbox[1]); // Latitude difference

      // Approximate area in km² (simplified for WGS 84)
      const areaKm2 = calculateArea(widthDeg, heightDeg, (bbox[1] + bbox[3]) / 2);
      if (areaKm2 > 225000) {
        vInput.value = '';
        Swal.fire({
          icon: 'error',
          title: 'Area too large!',
          text: `The GeoTIFF covers an area of approximately ${areaKm2.toFixed(2)} km², which exceeds the limit of 225,000 km².`
        });
        return;
      }

      // If all checks pass, enable submit and show file info
      document.getElementById('visualizationFileName').innerText = `${file.name} (${(file.size / 1048576).toFixed(2)} MB)`;
      vSubmit.disabled = false;
    } catch (error) {
      vInput.value = '';
      Swal.fire({
        icon: 'error',
        title: 'GeoTIFF Parsing Error',
        text: `Could not parse the GeoTIFF file: ${error.message || 'Unknown error'}. Please ensure it is a valid GeoTIFF.`
      });
      console.error('GeoTIFF parsing error:', error);
    }
  }
});

vSubmit.addEventListener('click', async () => {
  const file = vInput.files[0];
  if (!file) return;

  vProgressWrapper.style.display = 'block';
  vProgressBar.style.width = '0%';
  vProgressBar.textContent = '0%';
  vProgressBar.classList.remove('bg-success', 'bg-danger');

  const formData = new FormData();
  formData.append('file', file); // Use 'file' for single file upload

  try {
    const response = await uploadFile(formData, percent => {
      vProgressBar.style.width = percent + '%';
      vProgressBar.textContent = percent + '%';
    });

    console.log('Upload response:', response); // Debug response

    if (response.success && response.dem_url && response.los_url) {
      vProgressBar.classList.add('bg-success');
      vProgressBar.textContent = 'Completed';

      // Open map in new window (from working version)
      const iframeUrl = `https://insarplusktm.alwaysdata.net/3dsub/?dem_url=${encodeURIComponent(response.dem_url)}&los_url=${encodeURIComponent(response.los_url)}`;

      //console.log('Sagar:', iframeUrl);

      // Replace video with iframe in .right-col
      const rightCol = document.querySelector('.right-col');
      rightCol.innerHTML = ''; // Clear existing content (video or previous iframe)
      const iframe = document.createElement('iframe');
      iframe.src = iframeUrl;
      iframe.style.width = '100%';
      iframe.style.height = '100%';
      iframe.style.border = 'none';

      // Add error handling for iframe loading
      iframe.onerror = () => {
        console.error('Iframe load error:', iframeUrl);
        vProgressBar.classList.add('bg-danger');
        vProgressBar.textContent = 'Error';
        Swal.fire('Map Load Failed', 'Failed to load the map in the iframe.', 'error');
      };

      iframe.onload = () => {
        console.log('Iframe loaded successfully:', iframeUrl);
      };

      rightCol.appendChild(iframe); 
    } else {
      console.error('Upload failed with response:', response);
      vProgressBar.classList.add('bg-danger');
      vProgressBar.textContent = 'Failed';
      Swal.fire('Upload Failed', response.error || 'Unknown error', 'error');
    }
  } catch (err) {
    console.error('Upload error:', err);
    vProgressBar.classList.add('bg-danger');
    vProgressBar.textContent = 'Error';
    Swal.fire('Upload Failed', err.error || 'Unknown error', 'error');
  }
});
// --- AJAX Upload Helper ---

function uploadFile(data, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    let formData;

    // Support both File and FormData inputs
    if (data instanceof FormData) {
      formData = data;
    } else {
      formData = new FormData();
      formData.append('file', data);
    }

    xhr.open("POST", "upload.php", true);

    // Progress event
    xhr.upload.onprogress = function(event) {
      if (event.lengthComputable && typeof onProgress === "function") {
        const percent = Math.round((event.loaded / event.total) * 100);
        onProgress(percent);
      }
    };

    // Done
    xhr.onload = function() {
      console.log('Raw response:', xhr.responseText); // Debug raw response
      if (xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (e) {
          reject({ success: false, error: `Invalid JSON response: ${e.message}`, rawResponse: xhr.responseText });
        }
      } else {
        reject({ success: false, error: `Upload failed with status ${xhr.status}`, rawResponse: xhr.responseText });
      }
    };

    xhr.onerror = function() {
      reject({ success: false, error: 'Network error', rawResponse: '' });
    };

    xhr.send(formData);
  });
}
</script>
</body>
</html>
