import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

const Map = () => {
  const mapRef = useRef(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    // Initialize map
    const map = L.map(mapRef.current).setView([30.0444, 31.2357], 10); // Cairo coordinates

    // Add base layers
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Initialize draw controls
    const drawnItems = new L.FeatureGroup();
    map.addLayer(drawnItems);

    const drawControl = new L.Control.Draw({
      draw: {
        polygon: true,
        marker: false,
        circle: false,
        circlemarker: false,
        rectangle: true,
        polyline: false
      },
      edit: {
        featureGroup: drawnItems
      }
    });
    map.addControl(drawControl);

    // Handle draw events
    map.on('draw:created', (e) => {
      drawnItems.clearLayers();
      drawnItems.addLayer(e.layer);

      if (selectedFile) {
        handleClassification(e.layer.toGeoJSON());
      }
    });

    return () => map.remove();
  }, [selectedFile]);

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files[0]);
  };

  const handleClassification = async (roi) => {
    setLoading(true);
    try {
      const formData = new FormData();
      formData.append('roi', JSON.stringify(roi));
      formData.append('input_tif_key', selectedFile.name); // Assuming file is already in S3

      const response = await fetch('http://localhost:8000/predict', {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      setResult(data);

      // Add classified image overlay
      if (data.result_url) {
        const bounds = L.latLngBounds([
          [data.metadata.bounds[1], data.metadata.bounds[0]],
          [data.metadata.bounds[3], data.metadata.bounds[2]]
        ]);

        L.imageOverlay(data.result_url, bounds, {
          opacity: 0.7
        }).addTo(map);
      }
    } catch (error) {
      console.error('Classification failed:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-screen flex flex-col">
      <div className="p-4 bg-white shadow">
        <input
          type="file"
          accept=".tif,.tiff"
          onChange={handleFileChange}
          className="block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-blue-50 file:text-blue-700
            hover:file:bg-blue-100"
        />
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