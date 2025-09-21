import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import * as GeoTIFF from 'geotiff';
import $ from 'jquery';
window.jQuery = window.$ = $; 

//import Stats from 'three/addons/libs/stats.module.js';
// NEW: For compass

// Helper to get URL param
function getUrlParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}


const dir = new THREE.Vector3();
const sph = new THREE.Spherical();
const compass = document.getElementById('compass');  // Reference to SVG element

let container, stats;
let camera, controls, scene, renderer;
let mesh, texture;
let raycaster, pointer, helper;

let minElevation, maxElevation;
// Global for rotation state
let isRotating = false;

async function loadSubsidenceGeoTIFF(fileOrUrl) {
    let arrayBuffer;
    try {
        // Unified fetch (local or remote URL)
        let response;
        if (typeof fileOrUrl === 'string' && fileOrUrl.startsWith('http')) {
            // Remote URL
            response = await fetch(fileOrUrl);
        } else {
            // Local file (default)
            response = await fetch(fileOrUrl);
        }
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status} for ${fileOrUrl}`);
        }
        arrayBuffer = await response.arrayBuffer();
    } catch (error) {
        console.error('Error fetching subsidence GeoTIFF:', error);
        throw error;
    }

    try {
        const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        
        // Log image metadata for debugging (removed getPlanarConfiguration)
        console.log('Subsidence Image metadata:', {
            width: image.getWidth(),
            height: image.getHeight(),
            samplesPerPixel: image.getSamplesPerPixel(),
            tileWidth: image.getTileWidth(),
            tileHeight: image.getTileHeight(),
            bbox: image.getBoundingBox()
        });
        
        // Get bbox
        const bbox = image.getBoundingBox();
        
        // Read rasters with error handling
        let rasters;
        try {
            rasters = await image.readRasters();
            console.log('Rasters loaded:', rasters.length, 'bands');
            if (rasters.length === 0) {
                throw new Error('No rasters returned (empty array)');
            }
        } catch (rasterError) {
            console.error('Error reading rasters:', rasterError);
            throw rasterError;
        }
        
        const width = image.getWidth();
        const height = image.getHeight();
        const subsidenceData = rasters[0];  // Single band: TypedArray (e.g., Float32Array)
        
        // Validate data (handle TypedArray, not just Array)
        if (!subsidenceData || subsidenceData.length === 0) {
            throw new Error(`Invalid subsidenceData: length ${subsidenceData ? subsidenceData.length : 'undefined'}`);
        }
        // Check if it's array-like (TypedArray or Array)
        if (!Array.isArray(subsidenceData) && !(subsidenceData.buffer instanceof ArrayBuffer)) {
            throw new Error(`Unexpected subsidenceData type: ${typeof subsidenceData}`);
        }
        
        // Check for NaN/NoData (common in Float32; assume NaN = NoData)
        const hasNaN = subsidenceData.some(v => isNaN(v));
        console.log('Subsidence data sample (first 5):', Array.from(subsidenceData.slice(0, 5)), { hasNaN, totalLength: subsidenceData.length });
        
        // Filter NaN/NoData before reduce
        const validData = Array.from(subsidenceData).filter(v => !isNaN(v));
        if (validData.length === 0) {
            throw new Error('No valid (non-NaN) data in raster');
        }
        
        const minSub = validData.reduce((min, val) => Math.min(min, val), Infinity);
        const maxSub = validData.reduce((max, val) => Math.max(max, val), -Infinity);
        console.log(`Subsidence range (valid data): ${minSub} to ${maxSub}`);

        return {
            data: subsidenceData,  // Keep the TypedArray (with NaN for transparency in texture gen)
            width,
            height,
            bbox,
            min: minSub,
            max: maxSub
        };
    } catch (error) {
        console.error(`Failed to load subsidence GeoTIFF ${fileOrUrl}:`, error);
        // Fallback: Dummy object with defined width/height (hardcoded from gdalinfo)
        const fallbackWidth = 1372;
        const fallbackHeight = 1134;
        const fallbackBbox = [85.1708333, 27.5355556, 85.5519444, 27.8505556];  // west, south, east, north
        return {
            data: new Float32Array(fallbackWidth * fallbackHeight).fill(0),  // Zero-filled TypedArray
            width: fallbackWidth,
            height: fallbackHeight,
            bbox: fallbackBbox,
            min: 0,
            max: 0
        };
    }
}

async function loadGeoTIFF(fileOrUrl) {
    let arrayBuffer;
    try {
        // Unified fetch (local or remote URL)
        let response;
        if (typeof fileOrUrl === 'string' && fileOrUrl.startsWith('http')) {
            // Remote URL
            response = await fetch(fileOrUrl);
        } else {
            // Local file (default)
            response = await fetch(fileOrUrl);
        }
        if (!response.ok) {
            throw new Error(`HTTP error: ${response.status} for ${fileOrUrl}`);
        }
        arrayBuffer = await response.arrayBuffer();
    } catch (error) {
        console.error('Error fetching GeoTIFF:', error);
        throw error;
    }

    try {
        const tiff = await GeoTIFF.fromArrayBuffer(arrayBuffer);
        const image = await tiff.getImage();
        
        // Get geographic bounding box [westLng, southLat, eastLng, northLat]
        const bbox = image.getBoundingBox();  // Assumes WGS84; returns [minX, minY, maxX, maxY]
        
        // Get raster data
        const rasters = await image.readRasters();
        const width = image.getWidth();
        const height = image.getHeight();
        
        const elevationData = rasters[0];
        
        // Normalize elevation data
        minElevation = elevationData.reduce((min, val) => Math.min(min, val), Infinity);
        maxElevation = elevationData.reduce((max, val) => Math.max(max, val), -Infinity);
        console.log(`Elevation range: ${minElevation} to ${maxElevation}`);

        return {
            data: elevationData,
            width,
            height,
            bbox  // Add this
        };
    } catch (error) {
        console.error(`Failed to load GeoTIFF ${fileOrUrl}:`, error);
        // Optional fallback: Return dummy data (similar to subsidence)
        const fallbackWidth = 1372;  // Adjust based on default
        const fallbackHeight = 1134;
        const fallbackBbox = [85.1708333, 27.5355556, 85.5519444, 27.8505556];
        const fallbackData = new Float32Array(fallbackWidth * fallbackHeight).fill(0);
        minElevation = 0;
        maxElevation = 0;
        return {
            data: fallbackData,
            width: fallbackWidth,
            height: fallbackHeight,
            bbox: fallbackBbox
        };
    }
}

function latLngToTile(lat, lng, zoom) {
    const n = Math.pow(2, zoom);
    const x = ((lng + 180) / 360) * n;
    const y = ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * n;
    return [Math.floor(x), Math.floor(y)];
}

function tileToLatLng(x, y, zoom) {
    const n = Math.pow(2, zoom);
    const lng = (x / n) * 360 - 180;
    const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y / n))));
    const lat = (latRad * 180) / Math.PI;
    return [lat, lng];
}

function getColormapColor(normalized, colormap = 'hot') {
    let r = 0, g = 0, b = 0;
    if (colormap === 'hot') {
        if (normalized < 0.25) {
            b = Math.round(255 * (normalized / 0.25));
        } else if (normalized < 0.5) {
            b = 255;
            g = Math.round(255 * ((normalized - 0.25) / 0.25));
        } else if (normalized < 0.75) {
            g = 255;
            r = Math.round(255 * ((normalized - 0.5) / 0.25));
            b = Math.round(255 * (1 - ((normalized - 0.5) / 0.25)));
        } else {
            r = 255;
            g = Math.round(255 * (1 - ((normalized - 0.75) / 0.25)));
            b = 0;
        }
    }
    return { r: Math.floor(r), g: Math.floor(g), b: Math.floor(b), a: 200 };  // Semi-transparent
}

function generateSubsidenceTexture(data, width, height, min, max) {
    if (max === min) {
        console.warn('Subsidence min == max; using flat gray texture.');
        // Fallback: Create a uniform gray canvas
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = 'rgba(128, 128, 128, 0.5)';
        ctx.fillRect(0, 0, width, height);
        return canvas;
    }

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const image = ctx.createImageData(width, height);
    const imageData = image.data;

    for (let i = 0, j = 0, l = imageData.length; i < l; i += 4, j++) {
        const value = data[j];
        if (value === undefined || isNaN(value)) {
            imageData[i + 3] = 0;  // Transparent for NoData
            continue;
        }
        const normalized = (value - min) / (max - min);
        const color = getColormapColor(normalized);
        imageData[i] = color.r;     // R
        imageData[i + 1] = color.g; // G
        imageData[i + 2] = color.b; // B
        imageData[i + 3] = color.a; // Alpha
    }

    ctx.putImageData(image, 0, 0);
    return canvas;
}


async function generateTileTexture(baseUrl, bbox, width, height, zoom = 12) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');

    // Calculate min/max tiles covering the bbox
    const [west, south, east, north] = bbox;
    const [minX, minY] = latLngToTile(north, west, zoom); // Top-left tile
    const [maxX, maxY] = latLngToTile(south, east, zoom); // Bottom-right tile

    const promises = [];
    for (let ty = minY; ty <= maxY; ty++) {
        for (let tx = minX; tx <= maxX; tx++) {
            const url = baseUrl
                .replace('{x}', tx)
                .replace('{y}', ty)
                .replace('{z}', zoom)
                .replace('{r}', '@2x'); // Stamen uses {r} for retina; Google ignores it
            promises.push(
                fetch(url, { mode: 'cors' })
                    .then(res => {
                        if (!res.ok) throw new Error(`Tile ${tx}/${ty} failed: ${res.status}`);
                        return res.blob();
                    })
                    .then(blob => createImageBitmap(blob))
                    .then(img => {
                        // Project tile onto canvas (simple bilinear scaling per tile)
                        const tileW = width / (maxX - minX + 1);
                        const tileH = height / (maxY - minY + 1);
                        const x = (tx - minX) * tileW;
                        const y = (ty - minY) * tileH;
                        ctx.drawImage(img, x, y, tileW, tileH);
                    })
                    .catch(err => console.warn(`Failed to load tile ${tx}/${ty}:`, err))
            );
        }
    }

    await Promise.all(promises);
    return canvas;
}

function addColorbar(min, max) {
    const container = document.getElementById('colorbar-container');
    const gradientHeight = 100;
    const labelHeight = 12;
    const labelSpacing = 5;
    const topMargin = labelHeight + labelSpacing;
    const barWidth = 30;
    const canvasWidth = 70; // wider for labels
    const centerX = canvasWidth / 2;
    const barX = (canvasWidth - barWidth) / 2;
    const canvasHeight = topMargin + gradientHeight + labelSpacing + labelHeight * 2;
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    // Draw gradient centered in canvas
    const gradient = ctx.createLinearGradient(0, topMargin, 0, topMargin + gradientHeight);
    for (let i = 0; i <= 10; i++) {
        const normalized = i / 10;
        const color = getColormapColor(normalized);
        gradient.addColorStop(i / 10, `rgba(${color.r}, ${color.g}, ${color.b}, 1)`);
    }
    ctx.fillStyle = gradient;
    ctx.fillRect(barX, topMargin, barWidth, gradientHeight);

    ctx.font = 'bold 10px Arial';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'black';

    // Top label

    ctx.fillText(min.toFixed(1) + ' mm', centerX, labelHeight);

    // Bottom label

    const bottomY = topMargin + gradientHeight + labelSpacing + labelHeight / 2;
    ctx.fillText(max.toFixed(1) + ' mm', centerX, bottomY);

    container.appendChild(canvas);
}

function computeHorizontalScale(bbox) {
    const [west, south, east, north] = bbox;
    const R = 6371000;  // Earth radius in meters

    // Accurate distances
    const midLat = (north + south) / 2 * (Math.PI / 180);
    const latDist = (north - south) * (Math.PI / 180) * R;
    const lonDist = (east - west) * (Math.PI / 180) * R * Math.cos(midLat);

    return { width: Math.abs(lonDist), height: Math.abs(latDist), avg: (lonDist + latDist) / 2 };
}


function bboxToMeters(bbox) {
    const [west, south, east, north] = bbox;
    const R = 6371000; // Earth radius in meters

    // Longitude distance (east-west), corrected for latitude
    const midLat = ((north + south) / 2) * Math.PI / 180;
    const dLon = (east - west) * Math.PI / 180;
    const width = R * dLon * Math.cos(midLat);

    // Latitude distance (north-south)
    const dLat = (north - south) * Math.PI / 180;
    const height = R * dLat;

    return { width: Math.abs(width), height: Math.abs(height) };
}

// Add after the horizontal scale function
function computeAdaptiveExaggeration(elevationRange, horizontalAvg, desiredReliefRatio = 0.1) {
    // Base exaggeration: Scale to desired visual height relative to horizontal
    let baseVE = (horizontalAvg * desiredReliefRatio) / elevationRange;

    // Adaptive boost for flat areas (if range < 100m, amplify up to 3x; taper for hilly)
    const flatThreshold = 100;  // Meters; adjust based on your data
    const maxBoost = 3.0;
    if (elevationRange < flatThreshold) {
        const flatness = 1 - (elevationRange / flatThreshold);
        baseVE *= (1 + (flatness * (maxBoost - 1)));  // e.g., 50m range → ~1.75x boost
    } else if (elevationRange > 1000) {
        baseVE = Math.max(baseVE, 0.5);  // Cap for extreme hills to avoid stretching
    }

    // Clamp to reasonable range (0.1-5.0)
    return Math.max(0.1, Math.min(5.0, baseVE));
}

let googleTexture, stamenTexture, subsidenceTexture;



async function initTerrain(terrainData, subsidenceData) {
    if (scene) {
        scene.remove(mesh);
    }

    try {
        const { width: meshWidth, height: meshHeight } = bboxToMeters(terrainData.bbox);
        console.log('Mesh dimensions:', meshWidth, meshHeight);

        const horizontalAvg = (meshWidth + meshHeight) / 2;
        const elevationRange = maxElevation - minElevation;
        const adaptiveVE = computeAdaptiveExaggeration(elevationRange, horizontalAvg, 0.05);

        const geometry = new THREE.PlaneGeometry(
            meshWidth / 2,
            meshHeight / 2,
            terrainData.width - 1,
            terrainData.height - 1
        );
        geometry.rotateX(-Math.PI / 2);
        const verticalScale = 0.1;
        const vertices = geometry.attributes.position.array;
        for (let i = 0, j = 0, l = vertices.length; i < l; i++, j += 3) {
            vertices[j + 1] = (terrainData.data[i] || 0) * adaptiveVE;
        }
        geometry.computeVertexNormals();

        // Load textures
        // 1. Google Tiles (base)
        const arcgisCanvas = await generateTileTexture(
            'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            terrainData.bbox,
            terrainData.width,
            terrainData.height,
            12
        );
        googleTexture = new THREE.CanvasTexture(arcgisCanvas);
        googleTexture.wrapS = googleTexture.wrapT = THREE.ClampToEdgeWrapping;
        googleTexture.colorSpace = THREE.SRGBColorSpace;

        // 2. Stamen Toner Labels (middle)
        const stamenCanvas = await generateTileTexture(
            'https://tiles.stadiamaps.com/tiles/stamen_toner_labels/{z}/{x}/{y}{r}.png?api_key=6012e2e6-5979-45d8-af3f-a8e89499b00a',
            terrainData.bbox,
            terrainData.width,
            terrainData.height,
            12
        );
        stamenTexture = new THREE.CanvasTexture(stamenCanvas);
        stamenTexture.wrapS = stamenTexture.wrapT = THREE.ClampToEdgeWrapping;
        stamenTexture.colorSpace = THREE.SRGBColorSpace;

        // 3. Subsidence (top, null-safe)
        if (subsidenceData && subsidenceData.data && subsidenceData.data.length > 0 && !isNaN(subsidenceData.min) && !isNaN(subsidenceData.max)) {
            console.log('Generating subsidence texture...');
            const subCanvas = generateSubsidenceTexture(
                subsidenceData.data,
                subsidenceData.width,
                subsidenceData.height,
                subsidenceData.min,
                subsidenceData.max
            );
            subsidenceTexture = new THREE.CanvasTexture(subCanvas);
            subsidenceTexture.wrapS = subsidenceTexture.wrapT = THREE.ClampToEdgeWrapping;
            subsidenceTexture.colorSpace = THREE.SRGBColorSpace;
            console.log('Subsidence texture generated successfully');
        } else {
            console.warn('Skipping subsidence overlay (invalid data):', subsidenceData);
            subsidenceTexture = null;
        }

        // ShaderMaterial for three-layer blending
        const material = new THREE.ShaderMaterial({
            uniforms: {
                googleTexture: { value: googleTexture },
                stamenTexture: { value: stamenTexture },
                subsidenceTexture: { value: subsidenceTexture },
                googleOpacity: { value: 1.0 }, // Toggle Google
                stamenOpacity: { value: 1.0 }, // Toggle Stamen
                subsidenceOpacity: { value: 0.8 }, // Toggle subsidence
                showGoogle: { value: 1.0 },
                showStamen: { value: 1.0 },
                showSubsidence: { value: subsidenceTexture ? 1.0 : 0.0 }
            },
            vertexShader: `
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D googleTexture;
                uniform sampler2D stamenTexture;
                uniform sampler2D subsidenceTexture;
                uniform float googleOpacity;
                uniform float stamenOpacity;
                uniform float subsidenceOpacity;
                uniform float showGoogle;
                uniform float showStamen;
                uniform float showSubsidence;
                varying vec2 vUv;
                void main() {
                    // Flip Y for correct tile orientation
                    vec2 uv = vec2(1.0 - vUv.x, 1.0 - vUv.y);
                    vec4 google = texture2D(googleTexture, uv); // ArcGIS
                    vec4 color = google * showGoogle * googleOpacity;
                    vec4 stamen = texture2D(stamenTexture, uv);
                    color = mix(color, stamen, stamen.a * showStamen * stamenOpacity);
                    vec4 subsidence = texture2D(subsidenceTexture, uv);
                    color = mix(color, subsidence, subsidence.a * showSubsidence * subsidenceOpacity);
                    gl_FragColor = vec4(color.rgb, 1.0);
                }
            `,
            side: THREE.DoubleSide,
            transparent: true
        });

        mesh = new THREE.Mesh(geometry, material);
        mesh.name = 'terrain-mesh';
        scene.add(mesh);
        console.log('Mesh added successfully!');
        mesh.userData.material = material;

        // Lights (unchanged)
        if (!scene.children.find(light => light.type === 'AmbientLight')) {
            const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(1, 1, 0.5);
            scene.add(directionalLight);
        }

        // Compute the mesh's bounding box
        geometry.computeBoundingBox();
        const bbox = geometry.boundingBox;
        const size = new THREE.Vector3();
        bbox.getSize(size); // Size in world coordinates (x, y, z)
        const center = new THREE.Vector3();
        bbox.getCenter(center); // Center of the mesh

        // Set controls target to the center of the mesh
        controls.target.copy(center);

        // Calculate camera distance to fit the entire mesh
        const fov = camera.fov * (Math.PI / 180); // Convert FOV to radians
        const maxDimension = Math.max(size.x, size.z); // Use x and z (terrain is rotated, y is height)
        const distance = maxDimension / (1.5 * Math.tan(fov / 2)); // Distance to fit width in FOV

        // Define the camera angle (in degrees, relative to vertical; 0 = top-down, 90 = side view)
        const cameraAngleDeg = getUrlParam('camera_angle') ? parseFloat(getUrlParam('camera_angle')) : 40; // Default 45 degrees
        const cameraAngleRad = THREE.MathUtils.degToRad(cameraAngleDeg);

                // Define the azimuthal angle for Northwest (315 degrees = 7π/4 radians)
        const azimuthDeg = getUrlParam('azimuth') ? parseFloat(getUrlParam('azimuth')) : 315; // Northwest
        const azimuthRad = THREE.MathUtils.degToRad(azimuthDeg);

        // Calculate camera position using spherical coordinates relative to the mesh center
        const radius = distance / Math.cos(cameraAngleRad); // Adjust distance to maintain FOV coverage
        const cameraHeight = radius * Math.cos(cameraAngleRad); // Height above mesh center
        const horizontalOffset = radius * Math.sin(cameraAngleRad); // Offset in the x-z plane

        // Position camera (e.g., offset along z-axis for simplicity; adjust for other directions if needed)
        camera.position.set(
            center.x - horizontalOffset * Math.sin(azimuthRad), // Negative x for West
            center.y + cameraHeight, // Height above mesh
            center.z + horizontalOffset * Math.cos(azimuthRad) // Positive z for North
        );
        camera.lookAt(center); // Look at the mesh center

        // Update controls
        controls.update();

        // Set reasonable min/max distances for zooming
        controls.minDistance = Math.min(meshWidth, meshHeight) * 0.05;
        controls.maxDistance = Math.max(meshWidth, meshHeight) * 2.0;
        controls.maxPolarAngle = Math.PI / 2;

        // Colorbar (only if subsidence valid)
        if (subsidenceTexture) {
            addColorbar(subsidenceData.min, subsidenceData.max);
        }
    } catch (error) {
        console.error('Error in initTerrain:', error);
        const fallbackMaterial = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
        mesh = new THREE.Mesh(geometry, fallbackMaterial);
        scene.add(mesh);
    }
}

function generateTexture(data, width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const context = canvas.getContext('2d');
    const image = context.createImageData(width, height);
    const imageData = image.data;

    for (let i = 0, j = 0, l = imageData.length; i < l; i += 4, j++) {    
        
        // /* For Color */
        // const normalized = (data[j] - minElevation) / (maxElevation - minElevation);

        // // Define a gradient from blue (low) to green (mid) to red (high)
        // const r = Math.min(255, Math.max(0, Math.round(255 * normalized))); // Red increases with elevation
        // const g = Math.min(255, Math.max(0, Math.round(255 * (1 - Math.abs(normalized - 0.5) * 2)))); // Green peaks at mid
        // const b = Math.min(255, Math.max(0, Math.round(255 * (1 - normalized)))); // Blue decreases with elevation

        // imageData[i] = r;     // R
        // imageData[i + 1] = g; // G
        // imageData[i + 2] = b; // B
        // imageData[i + 3] = 255; 
        
        
        /* For Grayscale */
        const normalized = (data[j] - minElevation) / (maxElevation - minElevation);

        // Define a gradient from blue (low) to green (mid) to red (high)
        const r = Math.min(255, Math.max(0, Math.round(255 * normalized))); 
        const g = Math.min(255, Math.max(0, Math.round(255 * normalized))); 
        const b = Math.min(255, Math.max(0, Math.round(255 * normalized))); 
        imageData[i] = r;     // R
        imageData[i + 1] = g; // G
        imageData[i + 2] = b; // B
        imageData[i + 3] = 255; 

    }

    context.putImageData(image, 0, 0);
    return canvas;
}


function ajaxLoader(el, options) {
    var defaults = {
        bgColor: '#fff',
        duration: 800,
        opacity: 0.7,
        classOveride: false
    };
    this.options = jQuery.extend(defaults, options);
    this.container = jQuery(el);

    this.init = function() {
        var container = this.container;
        this.remove();

        var overlay = jQuery('<div></div>').css({
            'background-color': this.options.bgColor,
            'opacity': this.options.opacity,
            'width': container.width(),
            'height': container.height(),
            'position': 'absolute',
            'top': '0px',
            'left': '0px',
            'z-index': 99999
        }).addClass('ajax_overlay');

        if (this.options.classOveride) {
            overlay.addClass(this.options.classOveride);
        }

        container.append(
            overlay.append(
                jQuery('<div></div>').addClass('ajax_loader')
            ).fadeIn(this.options.duration)
        );
    };

    this.remove = function() {
        var overlay = this.container.children('.ajax_overlay');
        if (overlay.length) {
            overlay.fadeOut(this.options.duration, function() {
                overlay.remove();
            });
        }
    };

    this.init();
}


async function init() {
    container = document.getElementById('terrain-container');
    container.innerHTML = '';



    // Renderer
    const compass = document.getElementById('compass');

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setAnimationLoop(animate);
    container.appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xbfd1e5);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 10, 20000);

    // Controls
    controls = new OrbitControls(camera, renderer.domElement);
    controls.minDistance = 1000;
    controls.maxDistance = 10000;
    controls.maxPolarAngle = Math.PI / 2;



    // Raycaster for interaction
    raycaster = new THREE.Raycaster();
    pointer = new THREE.Vector2();

    // Helper
    const geometryHelper = new THREE.ConeGeometry(20, 100, 3);
    geometryHelper.translate(0, 50, 0);
    geometryHelper.rotateX(Math.PI / 2);
    helper = new THREE.Mesh(geometryHelper, new THREE.MeshNormalMaterial());
    scene.add(helper);

    // Event listeners
    container.addEventListener('pointermove', onPointerMove);
    window.addEventListener('resize', onWindowResize);

    // Stats
    //stats = new Stats();
    //container.appendChild(stats.dom);

        // Initialize preloader
    const loader = new ajaxLoader('#terrain-container', {
        bgColor: '#000',
        opacity: 0.8,
        duration: 400 // Faster fade-in/out
    });

    try {
        const demUrl = getUrlParam('dem_url') || '20250921_031901_683826_dem.tif';
        const losUrl = getUrlParam('los_url') || '20250921_031901_683826_resample.tif';
        console.log('Using DEM URL:', demUrl, 'LOS URL:', losUrl);

        const terrainData = await loadGeoTIFF(demUrl);  // Now accepts URL or local path
        console.log('Terrain loaded successfully');

        let subsidenceData = null;
        if (losUrl) {
            subsidenceData = await loadSubsidenceGeoTIFF(losUrl);  // Accepts URL
            console.log('Subsidence loaded successfully');
        } else {
            console.log('No LOS URL—skipping subsidence');
        }
        await initTerrain(terrainData, subsidenceData);

        createLeafletMap(terrainData);
        setupLayersToggle();
        loader.remove();

    } catch (error) {
        console.error('Error loading files:', error);
        // Fallback: Load only terrain
        const terrainData = await loadGeoTIFF('study_area.tif');
        await initTerrain(terrainData, null);
        setupLayersToggle();
        loader.remove();
    }
}

// NEW: Global ref for Leaflet map
let leafletMap;

// Function to create standalone Leaflet map (call after terrainData loaded)
function createLeafletMap(terrainData) {
    const container = document.getElementById('stats-container');
    if (!container || !terrainData.bbox) {
        console.warn('Cannot create Leaflet map: container or bbox missing');
        return;
    }

    // Compute center from bbox [west, south, east, north]
    const [west, south, east, north] = terrainData.bbox;
    const centerLat = (north + south) / 2;
    const centerLng = (west + east) / 2;
    const center = [centerLat, centerLng];
    console.log('Leaflet map center:', center);

    // Create map in container
    leafletMap = L.map(container.id, {
        center: center,
        zoom: 0,  // Initial zoom (auto-adjusted by fitBounds)
        zoomControl: false,  // No zoom buttons (small map)
        attributionControl: false,  // No attribution (space-saving)
        dragging: true,  // Enable pan (optional: false for static)
        scrollWheelZoom: false,  // Disable zoom on scroll (avoids 3D conflict)
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        tap: false
    });

    // OSM tile layer
    const osmUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
    const osmAttrib = 'Map data © OpenStreetMap contributors';
    const osmLayer = L.tileLayer(osmUrl, {
        minZoom: 5,
        maxZoom: 18,
        attribution: osmAttrib,
        opacity: 0.8  // Slight transparency if desired
    }).addTo(leafletMap);

    // // Fit map to bbox bounds
    // const bounds = L.latLngBounds([
    //     [south, west],  // SW corner
    //     [north, east]   // NE corner
    // ]);
    // leafletMap.fitBounds(bounds, {
    //     padding: [5, 5],  // Small padding for overview
    //     maxZoom: 15  // Prevent over-zoom on small areas
    // });

    L.marker(center).addTo(leafletMap);  // Auto-open if desired (remove for closed)

    console.log('Leaflet map created and fitted to bbox');
}



function setupLayersToggle() {
    const mesh = scene.getObjectByName('terrain-mesh');
    if (!mesh || !mesh.userData.material) {
        console.warn('Mesh or material not found for layer toggles');
        return;
    }

    // Subsidence toggle
    const subsidenceToggle = document.getElementById('subsidence-toggle');
    if (subsidenceToggle) {
        subsidenceToggle.addEventListener('change', (event) => {
            mesh.userData.material.uniforms.showSubsidence.value = event.target.checked ? 1.0 : 0.0;
            mesh.userData.material.needsUpdate = true;
            console.log(`Subsidence layer: ${event.target.checked ? 'ON' : 'OFF'}`);
        });
    }

    // Google toggle
    const googleToggle = document.getElementById('google-toggle');
    if (googleToggle) {
        googleToggle.addEventListener('change', (event) => {
            mesh.userData.material.uniforms.showGoogle.value = event.target.checked ? 1.0 : 0.0;
            mesh.userData.material.needsUpdate = true;
            console.log(`Google layer: ${event.target.checked ? 'ON' : 'OFF'}`);
        });
    }

    // Stamen toggle
    const stamenToggle = document.getElementById('stamen-toggle');
    if (stamenToggle) {
        stamenToggle.addEventListener('change', (event) => {
            mesh.userData.material.uniforms.showStamen.value = event.target.checked ? 1.0 : 0.0;
            mesh.userData.material.needsUpdate = true;
            console.log(`Stamen layer: ${event.target.checked ? 'ON' : 'OFF'}`);
        });
    }

        // Rotation toggle (NEW: Use OrbitControls.autoRotate)
    const rotateToggle = document.getElementById('rotate-toggle');
    if (rotateToggle && controls) {
        rotateToggle.addEventListener('change', (event) => {
            controls.autoRotate = event.target.checked; // Enable/disable auto rotation
            controls.autoRotateSpeed = 1.0; // Speed: 1.0 = full 360° in ~6 seconds (adjust 0.5 for slower, 2.0 for faster)
            console.log(`Camera auto-rotate: ${event.target.checked ? 'ON' : 'OFF'}`);
        });
    }
}


function onWindowResize() {
    // Existing camera/renderer resize
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);

    // Optional: Scale panel font for mobile
    const panel = document.getElementById('layers-panel');
    panel.style.fontSize = window.innerWidth < 600 ? '10px' : '12px';
    // NEW: Resize minimap
    if (miniMap) {
        miniMap._miniMap.invalidateSize();
    }
}

function animate() {
    // NEW: Compass update (before render)
    if (compass) {
        camera.getWorldDirection(dir);
        sph.setFromVector3(dir);
        compass.style.transform = `rotate(${THREE.MathUtils.radToDeg(sph.theta) - 180}deg)`;
    }

        // Camera rotation
    controls.update(); // This applies autoRotate if enabled

    render();  // Your existing render()
    //stats.update();
}
function render() {
    renderer.render(scene, camera);
}

function onPointerMove(event) {
    pointer.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
    pointer.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    // See if the ray from the camera into the world hits our mesh
    const intersects = raycaster.intersectObject(mesh);

    // Update helper position
    if (intersects.length > 0) {
        helper.position.set(0, 0, 0);
        helper.lookAt(intersects[0].face.normal);
        helper.position.copy(intersects[0].point);
    }
}

// Initialize the scene
init();