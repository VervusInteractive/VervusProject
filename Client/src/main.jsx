import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { apiPlugin, storyblokInit } from '@storyblok/react'
import './i18n.js'
import './index.css'
import App from './App.jsx'
import {
  STORYBLOK_ACCESS_TOKEN,
  STORYBLOK_REGION
} from './storyblok/config.js'

if (STORYBLOK_ACCESS_TOKEN) {
  storyblokInit({
    accessToken: STORYBLOK_ACCESS_TOKEN,
    use: [apiPlugin],
    apiOptions: {
      region: STORYBLOK_REGION,
    },
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
