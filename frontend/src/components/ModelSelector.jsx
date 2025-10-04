import React from 'react'

export default function ModelSelector({value, onChange}){
  const models = ['XGBoost','Random Forest','LightGBM']
  return (
    <div>
      <label className="block text-sm font-medium">Model</label>
      <select value={value} onChange={(e)=>onChange(e.target.value)} className="mt-1 w-full rounded p-2 border">
        {models.map(m=> <option key={m} value={m}>{m}</option>)}
      </select>
    </div>
  )
}