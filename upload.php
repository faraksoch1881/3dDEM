<?php
header('Content-Type: application/json');
ob_start(); // Start output buffering for safety

ini_set('error_log', __DIR__ . '/php_errors.log'); // Enable error logging

$uploadDirTif = __DIR__ . '/dgeotif/';
$uploadDirJson = __DIR__ . '/djson/';
$uploadDirGeoJson = __DIR__ . '/dgeojson/';
$uploadUrlBaseTif = 'https://insarplusktm.alwaysdata.net/datasets/dgeotif/';
$uploadUrlBaseJson = 'https://insarplusktm.alwaysdata.net/datasets/djson/';
$uploadUrlBaseGeoJson = 'https://insarplusktm.alwaysdata.net/datasets/dgeojson/';

if (!is_dir($uploadDirTif)) mkdir($uploadDirTif, 0775, true);
if (!is_dir($uploadDirJson)) mkdir($uploadDirJson, 0775, true);
if (!is_dir($uploadDirGeoJson)) mkdir($uploadDirGeoJson, 0775, true);

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    ob_end_clean();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid request method']);
    exit;
}

// Generate unique timestamp and random string for filenames
$dt = date('Ymd_His'); // Match working version's format
$rand = strtoupper(bin2hex(random_bytes(3)));
$basename = "{$dt}_{$rand}";

$response = ['success' => true, 'ts_url' => '', 'disp_url' => '', 'dem_url' => '', 'los_url' => '', 'geo_url' => ''];

// Handle single file ('file') or multiple files ('files')
$files = [];
if (isset($_FILES['file']) && $_FILES['file']['error'] !== UPLOAD_ERR_NO_FILE) {
    $files = [$_FILES['file']]; // Single file for Visualization and Contour
} elseif (isset($_FILES['files'])) {
    $fileCount = count($_FILES['files']['name']);
    if ($fileCount > 2) {
        ob_end_clean();
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Maximum 2 files allowed']);
        exit;
    }
    for ($i = 0; $i < $fileCount; $i++) {
        if ($_FILES['files']['error'][$i] !== UPLOAD_ERR_OK) {
            $errorMsg = 'File upload error for ' . $_FILES['files']['name'][$i] . ': ' . $_FILES['files']['error'][$i];
            error_log($errorMsg);
            ob_end_clean();
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $errorMsg]);
            exit;
        }
        $files[] = [
            'name' => $_FILES['files']['name'][$i],
            'tmp_name' => $_FILES['files']['tmp_name'][$i],
            'size' => $_FILES['files']['size'][$i],
            'error' => $_FILES['files']['error'][$i]
        ];
    }
}

if (empty($files)) {
    ob_end_clean();
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'No valid files uploaded']);
    exit;
}

foreach ($files as $file) {
    $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));

    if (in_array($ext, ['tif', 'tiff'])) {
        // Handle .tif/.tiff files (from working version)
        if ($file['size'] > 150 * 1024 * 1024) {
            $errorMsg = 'File must be less than 150 MB: ' . $file['name'];
            error_log($errorMsg);
            ob_end_clean();
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $errorMsg]);
            exit;
        }

        $filename = "{$basename}.tif";
        $dest = $uploadDirTif . $filename;
        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            $errorMsg = 'Failed to save TIFF file: ' . $file['name'];
            error_log($errorMsg);
            ob_end_clean();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $errorMsg]);
            exit;
        }

        // Python: download DEM and resample
        $dem_file = $uploadDirTif . "{$basename}_dem.tif";
        $resample_file = $uploadDirTif . "{$basename}_resample.tif";
        $python = '/usr/bin/python';
        $pycmd = escapeshellcmd("$python create_dem_and_resample.py " .
            escapeshellarg($dest) . " " .
            escapeshellarg($dem_file) . " " .
            escapeshellarg($resample_file)
        );
        exec($pycmd . " 2>&1", $output, $retval);
        if ($retval !== 0 || !file_exists($dem_file) || !file_exists($resample_file)) {
            $errorMsg = 'DEM/resample step failed: ' . implode("\n", $output);
            error_log($errorMsg);
            ob_end_clean();
            http_response_code(500);
            echo json_encode([
                'success' => false,
                'error' => 'DEM/resample step failed!',
                'log' => implode("\n", $output)
            ]);
            exit;
        }

        $response['dem_url'] = $uploadUrlBaseTif . "{$basename}_dem.tif";
        $response['los_url'] = $uploadUrlBaseTif . "{$basename}_resample.tif";
    } elseif ($ext === 'json') {
        // Handle .json file
        $jsonContent = @file_get_contents($file['tmp_name']);
        if ($jsonContent === false) {
            $errorMsg = 'Failed to read JSON file: ' . $file['name'];
            error_log($errorMsg);
            ob_end_clean();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $errorMsg]);
            exit;
        }

        $jsonData = json_decode($jsonContent, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            $errorMsg = 'Invalid JSON file: ' . $file['name'] . ' (' . json_last_error_msg() . ')';
            error_log($errorMsg);
            ob_end_clean();
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $errorMsg]);
            exit;
        }

        // Check if JSON contains 'id', 'lat', 'lon' keys
        $isLocation = false;
        if (is_array($jsonData) && !empty($jsonData)) {
            $keys = array_keys($jsonData[0] ?? $jsonData);
            $isLocation = in_array('id', $keys) && in_array('lat', $keys) && in_array('lon', $keys);
        }

        $filename = $isLocation ? "{$basename}_ts_location.json" : "{$basename}_disp_ts.json";
        $dest = $uploadDirJson . $filename;

        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            $errorMsg = 'Failed to save JSON file: ' . $file['name'];
            error_log($errorMsg);
            ob_end_clean();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $errorMsg]);
            exit;
        }

        if ($isLocation) {
            $response['ts_url'] = $uploadUrlBaseJson . $filename;
        } else {
            $response['disp_url'] = $uploadUrlBaseJson . $filename;
        }
    } elseif ($ext === 'geojson') {
        // Handle .geojson file
        $jsonContent = @file_get_contents($file['tmp_name']);
        if ($jsonContent === false) {
            $errorMsg = 'Failed to read GeoJSON file: ' . $file['name'];
            error_log($errorMsg);
            ob_end_clean();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $errorMsg]);
            exit;
        }

        $jsonData = json_decode($jsonContent, true);
        if (json_last_error() !== JSON_ERROR_NONE || !isset($jsonData['type']) || $jsonData['type'] !== 'FeatureCollection' || !isset($jsonData['features']) || !is_array($jsonData['features'])) {
            $errorMsg = 'Invalid GeoJSON file: ' . $file['name'] . ' (' . json_last_error_msg() . ')';
            error_log($errorMsg);
            ob_end_clean();
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => $errorMsg]);
            exit;
        }

        $filename = "{$basename}_contour.geojson";
        $dest = $uploadDirGeoJson . $filename;

        if (!move_uploaded_file($file['tmp_name'], $dest)) {
            $errorMsg = 'Failed to save GeoJSON file: ' . $file['name'];
            error_log($errorMsg);
            ob_end_clean();
            http_response_code(500);
            echo json_encode(['success' => false, 'error' => $errorMsg]);
            exit;
        }

        $response['geo_url'] = $uploadUrlBaseGeoJson . $filename;
    } else {
        $errorMsg = 'Only .tif, .tiff, .json, or .geojson files are allowed: ' . $file['name'];
        error_log($errorMsg);
        ob_end_clean();
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => $errorMsg]);
        exit;
    }
}

ob_end_clean();
echo json_encode($response);
exit;
?>