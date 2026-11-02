import { useEffect, useRef, useState } from 'react'
import type { PointerEvent } from 'react'
import {
  CELL,
  DEFENDER_KINDS,
  DEFENDER_SPECS,
  HEIGHT,
  WIDTH,
  createGame,
  placeDefender,
  step,
} from '../game/engine'
import type { DefenderKind, GameState, GameStatus, PlaceResult } from '../game/engine'
import { draw } from '../game/render'
import type { HoverCell } from '../game/render'

// The numbers shown around the lawn. They are copied out of the game several
// times a second, so the page does not redraw on every single frame.
type Hud = {
  status: GameStatus
  glow: number
  defeated: number
  total: number
  cooldowns: Record<DefenderKind, number>
}

function takeSnapshot(state: GameState): Hud {
  return {
    status: state.status,
    glow: Math.floor(state.glow),
    defeated: state.defeated,
    total: state.totalZombies,
    cooldowns: {
      shooter: Math.ceil(state.cooldowns.shooter * 10) / 10,
      bloom: Math.ceil(state.cooldowns.bloom * 10) / 10,
    },
  }
}

function sameHud(a: Hud, b: Hud): boolean {
  return (
    a.status === b.status &&
    a.glow === b.glow &&
    a.defeated === b.defeated &&
    a.total === b.total &&
    a.cooldowns.shooter === b.cooldowns.shooter &&
    a.cooldowns.bloom === b.cooldowns.bloom
  )
}

const MESSAGES: Record<PlaceResult, string> = {
  ok: '',
  'not-playing': '',
  'out-of-bounds': '',
  occupied: 'That square is taken. Pick an empty one.',
  'too-expensive': 'Not enough glow yet. Blooms make more.',
  recharging: 'That seed is still recharging.',
}

function GameScreen() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const gameRef = useRef<GameState>(createGame())
  const selectedRef = useRef<DefenderKind>('shooter')
  const hoverRef = useRef<HoverCell>(null)

  const [selected, setSelected] = useState<DefenderKind>('shooter')
  const [hud, setHud] = useState<Hud>(() => takeSnapshot(createGame()))
  const [message, setMessage] = useState('')

  // The game loop: runs about 60 times a second while the screen is open.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    if (!context) return

    // Draw at the screen's real resolution so it stays sharp on phones.
    const ratio = Math.min(window.devicePixelRatio || 1, 2)
    canvas.width = WIDTH * ratio
    canvas.height = HEIGHT * ratio

    let last = performance.now()
    let lastHudUpdate = 0
    let frame = 0

    const loop = (now: number) => {
      const seconds = (now - last) / 1000
      last = now

      step(gameRef.current, seconds)
      context.setTransform(ratio, 0, 0, ratio, 0, 0)
      draw(context, gameRef.current, selectedRef.current, hoverRef.current)

      if (now - lastHudUpdate > 100) {
        lastHudUpdate = now
        const next = takeSnapshot(gameRef.current)
        setHud((previous) => (sameHud(previous, next) ? previous : next))
      }
      frame = requestAnimationFrame(loop)
    }
    frame = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(frame)
  }, [])

  function cellAt(event: PointerEvent<HTMLCanvasElement>) {
    const box = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - box.left) / box.width) * WIDTH
    const y = ((event.clientY - box.top) / box.height) * HEIGHT
    return { row: Math.floor(y / CELL), col: Math.floor(x / CELL) }
  }

  function handlePointerDown(event: PointerEvent<HTMLCanvasElement>) {
    const { row, col } = cellAt(event)
    const result = placeDefender(gameRef.current, selectedRef.current, row, col)
    setMessage(MESSAGES[result])
    setHud(takeSnapshot(gameRef.current))
  }

  function handlePointerMove(event: PointerEvent<HTMLCanvasElement>) {
    // Only a mouse "hovers". On a touch screen this would leave a ghost behind.
    hoverRef.current = event.pointerType === 'mouse' ? cellAt(event) : null
  }

  function chooseDefender(kind: DefenderKind) {
    selectedRef.current = kind
    setSelected(kind)
    setMessage('')
  }

  function restart() {
    gameRef.current = createGame()
    setHud(takeSnapshot(gameRef.current))
    setMessage('')
  }

  return (
    <section className="game" aria-label="Garden Guard">
      <div className="hud">
        <div className="hud-stat">
          <span className="hud-label">Glow</span>
          <span className="hud-value">{hud.glow}</span>
        </div>
        <div className="hud-stat">
          <span className="hud-label">Defeated</span>
          <span className="hud-value">
            {hud.defeated} / {hud.total}
          </span>
        </div>
        <button type="button" className="restart" onClick={restart}>
          Restart
        </button>
      </div>

      <div className="board">
        <canvas
          ref={canvasRef}
          className="lawn"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerLeave={() => {
            hoverRef.current = null
          }}
          aria-label="The lawn. Tap a square to plant the selected seed."
        />
        {hud.status !== 'playing' && (
          <div className="overlay" role="alertdialog" aria-live="assertive">
            <h2>{hud.status === 'won' ? 'Garden saved!' : 'The shamblers got in!'}</h2>
            <p>
              {hud.status === 'won'
                ? 'You held the lawn through the final wave.'
                : 'A zombie reached your house. Blooms early, shooters in every lane.'}
            </p>
            <button type="button" className="play-again" onClick={restart}>
              Play again
            </button>
          </div>
        )}
      </div>

      <div className="seeds" role="radiogroup" aria-label="Choose a seed">
        {DEFENDER_KINDS.map((kind) => {
          const spec = DEFENDER_SPECS[kind]
          const wait = hud.cooldowns[kind]
          const cannotAfford = hud.glow < spec.cost
          const classes = [
            'seed',
            selected === kind ? 'selected' : '',
            cannotAfford || wait > 0 ? 'unavailable' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button
              key={kind}
              type="button"
              role="radio"
              aria-checked={selected === kind}
              className={classes}
              onClick={() => chooseDefender(kind)}
            >
              <span className="seed-emoji" aria-hidden="true">
                {spec.emoji}
              </span>
              <span className="seed-name">{spec.name}</span>
              <span className="seed-cost">{spec.cost} glow</span>
              <span className="seed-note">{spec.description}</span>
              {wait > 0 && (
                <span
                  className="seed-recharge"
                  style={{ width: `${(wait / spec.cooldown) * 100}%` }}
                />
              )}
            </button>
          )
        })}
      </div>

      <p className="message" aria-live="polite">
        {message}
      </p>
    </section>
  )
}

export default GameScreen