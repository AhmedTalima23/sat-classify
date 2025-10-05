import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

const Map = () => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const imageOverlay = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [imageBounds, setImageBounds] = useState(null);

  useEffect(() => {
    // Initialize map
    mapInstance.current = L.map(mapRef.current).setView([30.0444, 31.2357], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(mapInstance.current);

    return () => mapInstance.current.remove();
  }, []);

  const handleFileChange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setSelectedFile(file);

    // Read the GeoTIFF metadata using rasterio or similar service
    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('http://localhost:8000/upload', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      const bounds = L.latLngBounds([
        [data.bounds[1], data.bounds[0]],
        [data.bounds[3], data.bounds[2]]
      ]);

      setImageBounds(bounds);

      // Remove previous overlay if exists
      if (imageOverlay.current) {
        imageOverlay.current.remove();
      }

      // Add new image overlay
      imageOverlay.current = L.imageOverlay(data.url, bounds, {
        opacity: 0.7
      }).addTo(mapInstance.current);

      // Zoom to image bounds
      mapInstance.current.fitBounds(bounds);
    } catch (error) {
      console.error('Error uploading file:', error);
    }
  };

  const handleClassify = async () => {
    if (!selectedFile || !imageBounds) return;

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('input_tif_key', selectedFile.name);
      // Use the full image bounds instead of ROI
      formData.append('roi', JSON.stringify({
        type: 'Feature',
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [imageBounds.getWest(), imageBounds.getSouth()],
            [imageBounds.getEast(), imageBounds.getSouth()],
            [imageBounds.getEast(), imageBounds.getNorth()],
            [imageBounds.getWest(), imageBounds.getNorth()],
            [imageBounds.getWest(), imageBounds.getSouth()]
          ]]
        }
      }));

      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      // Remove input image overlay
      if (imageOverlay.current) {
        imageOverlay.current.remove();
      }

      // Add classified image overlay
      imageOverlay.current = L.imageOverlay(data.result_url, imageBounds, {
        opacity: 0.7
      }).addTo(mapInstance.current);

    } catch (error) {
      console.error('Classification failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="p-4 bg-white shadow flex items-center space-x-4">
        <input
          type="file"
          accept=".tif,.tiff"
          onChange={handleFileChange}
          className="block text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
        <button
          onClick={handleClassify}
          disabled={!selectedFile || loading}
          className={`px-4 py-2 rounded-full font-semibold
            ${!selectedFile || loading
              ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'}`}
        >
          Classify
        </button>
      </div>

      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0"></div>
      </div>

      {loading && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="text-white">Processing...</div>
        </div>
      )}
    </div>
  );
};

export default Map;