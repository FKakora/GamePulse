import './App.css'
import GameScreen from './components/GameScreen'

function App() {
  return (
    <div className="app">
      <header className="topbar">
        <div className="logo" aria-hidden="true">
          GP
        </div>
        <div>
          <h1 className="title">GamePulse</h1>
          <p className="tagline">Garden Guard: hold the lawn!</p>
        </div>
      </header>

      <main>
        <p className="rotate-hint">Tip: turn your phone sideways for a bigger lawn.</p>
        <GameScreen />
      </main>

      <footer className="how-to">
        <h2>How to play</h2>
        <ol>
          <li>Pick a seed, then tap a square on the lawn to plant it.</li>
          <li>Glow Blooms make glow energy. Pod Shooters fire along their lane.</li>
          <li>Stop every shambler before it reaches the red edge on the left.</li>
        </ol>
      </footer>
    </div>
  )
}

export default App