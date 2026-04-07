import { createRoot } from 'react-dom/client'
import ImageProcessor from './ImageProcessor.jsx'

createRoot(document.getElementById('root')).render(
  // Drop src/lutSrc as props or replace with your own asset paths
  <ImageProcessor
    src="/images/photo.jpg"
    lutSrc="/luts/film.cube"
  />
)
