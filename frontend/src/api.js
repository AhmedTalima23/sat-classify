import axios from 'axios'
const api = axios.create({ baseURL: process.env.REACT_APP_API_URL || 'http://54.167.11.46:8000' })
export default api