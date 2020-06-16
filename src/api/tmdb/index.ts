import axios from 'axios';
import conf from './conf.json';

const api = axios.create({
  baseURL: 'https://api.themoviedb.org/3/',
  params: {
    language: 'en-US'
  },
  headers: {
    'Accept': 'application/json',
    'Accept-Language': 'en',
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${conf.authToken}`
  }
});

export default api;
export * from './models';