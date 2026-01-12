import { useState } from 'react'
import './App.css'
import CV3D from './pages/CV3D'
import { useEffect } from 'react'

function App() {
  const [view3D, setView3D] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && view3D) setView3D(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [view3D])

  return (
    <div className="root">
      <header className="app-header">
        <h1>Mon CV</h1>
        <div>
          <button onClick={() => setView3D(v => !v)}>
            {view3D ? 'Retour' : 'Afficher en 3D'}
          </button>
        </div>
      </header>

      <main className="main">
        {view3D ? (
          <div className="fullscreen3d" role="dialog">
            <button className="fullscreen-close" onClick={() => setView3D(false)} aria-label="Fermer la vue 3D">✕</button>
            <CV3D />
          </div>
        ) : (
          <section className='p-20'>
            <h2>Bienvenue</h2>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
