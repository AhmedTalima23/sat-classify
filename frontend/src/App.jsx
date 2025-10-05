import React, { useState, useRef } from 'react'
import ModelSelector from './components/ModelSelector'
import MapDrawer from './components/MapDrawer'
import api from './api'
import Map from './components/Map';

export default function App(){
  const [selectedModel, setSelectedModel] = useState('XGBoost')
  const [tifUrl, setTifUrl] = useState('')
  const [resultUrl, setResultUrl] = useState(null)
  const [processing, setProcessing] = useState(false)
  const roiRef = useRef(null)

  async function handleClassify(){
    if(!roiRef.current){
      alert('Please draw a region of interest (ROI) on the map.')
      return
    }
    setProcessing(true)
    try{
      const roiGeoJSON = roiRef.current
      const payload = new FormData()
      payload.append('model_name', selectedModel)
      payload.append('roi', JSON.stringify(roiGeoJSON))
      payload.append('tif_url', tifUrl)

      const res = await api.post('/predict', payload)
      setResultUrl(res.data.result_url)
    }catch(err){
      console.error(err)
      alert('Prediction failed: ' + (err.response?.data?.detail || err.message))
    }finally{
      setProcessing(false)
    }
  }

  return (
    <div className="min-h-screen">
      <nav className="bg-blue-600 text-white p-4">
        <h1 className="text-xl font-bold">Satellite Classification Portal</h1>
      </nav>
      <div className="max-w-6xl mx-auto bg-white rounded-2xl shadow p-6">
        <p className="text-sm text-gray-500 mt-1">Select model, draw ROI, and classify.</p>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="col-span-1">
            <ModelSelector value={selectedModel} onChange={setSelectedModel} />
            <label className="block text-sm font-medium mt-4">GeoTIFF URL (S3 / Hugging Face)</label>
            <input className="mt-1 block w-full rounded p-2 border" value={tifUrl} onChange={(e)=>setTifUrl(e.target.value)} placeholder="https://.../image.tif" />

            <button className="mt-4 w-full bg-blue-600 text-white p-2 rounded" onClick={handleClassify} disabled={processing}>
              {processing ? 'Classifying...' : 'Classify Region'}
            </button>

            {resultUrl && (
              <div className="mt-4">
                <a href={resultUrl} target="_blank" rel="noreferrer" className="text-blue-600 underline">Download Classified GeoTIFF</a>
              </div>
            )}
          </div>

          <div className="md:col-span-2">
            <MapDrawer onRoiChange={(geojson)=>{ roiRef.current = geojson }} overlayUrl={resultUrl} />
          </div>
        </div>

      </div>
      <Map />
    </div>
  )
}