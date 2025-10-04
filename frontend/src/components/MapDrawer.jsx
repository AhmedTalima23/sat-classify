import React, { useEffect } from 'react'
import { MapContainer, TileLayer, FeatureGroup, useMap } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import 'leaflet-draw/dist/leaflet.draw.css'
import L from 'leaflet'
import 'leaflet-draw'

function DrawControl({onChange}){
  const map = useMap()
  useEffect(()=>{
    const drawnItems = new L.FeatureGroup()
    map.addLayer(drawnItems)

    const drawControl = new L.Control.Draw({
      draw: { polyline:false, circle:false, marker:false },
      edit: { featureGroup: drawnItems }
    })
    map.addControl(drawControl)

    map.on(L.Draw.Event.CREATED, function(e){
      drawnItems.clearLayers()
      const layer = e.layer
      drawnItems.addLayer(layer)
      const geojson = layer.toGeoJSON()
      onChange(geojson)
    })

    map.on(L.Draw.Event.EDITED, function(e){
      const layers = e.layers
      layers.eachLayer((l)=>{
        onChange(l.toGeoJSON())
      })
    })
  }, [map, onChange])
  return null
}

export default function MapDrawer({onRoiChange, overlayUrl}){
  return (
    <div className="h-[600px] rounded overflow-hidden border">
      <MapContainer center={[30,31]} zoom={6} style={{height:'100%', width:'100%'}}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FeatureGroup>
          <DrawControl onChange={(geojson)=>onRoiChange(geojson)} />
        </FeatureGroup>
        {overlayUrl && (
          <TileLayer url={overlayUrl} />
        )}
      </MapContainer>
    </div>
  )
}