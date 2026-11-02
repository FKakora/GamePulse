// Draws the game on a canvas. It only reads the game state, it never changes it.
import {
  CELL,
  COLS,
  DEFENDER_SPECS,
  HEIGHT,
  ROWS,
  WIDTH,
  ZOMBIE_EMOJI,
  ZOMBIE_HEALTH,
} from './engine'
import type { DefenderKind, GameState } from './engine'

export type HoverCell = { row: number; col: number } | null

const EMOJI_FONT = '"Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif'

function drawEmoji(ctx: CanvasRenderingContext2D, emoji: string, x: number, y: number, size: number) {
  // Reset to a solid colour first, so an earlier see-through fill cannot fade the emoji.
  ctx.fillStyle = '#ffffff'
  ctx.font = `${size}px ${EMOJI_FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(emoji, x, y)
}

// A light round pad under a defender, so a green plant stands out on the green lawn.
function drawPad(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath()
  ctx.arc(x, y + 4, 40, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.stroke()
}

// A soft shadow on the ground under a character.
function drawShadow(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.beginPath()
  ctx.ellipse(x, y + 34, 26, 8, 0, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)'
  ctx.fill()
}

function drawHealthBar(ctx: CanvasRenderingContext2D, x: number, y: number, fraction: number) {
  const width = 46
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)'
  ctx.fillRect(x - width / 2, y, width, 6)
  ctx.fillStyle = fraction > 0.5 ? '#7bd66b' : fraction > 0.25 ? '#f2c94c' : '#eb5757'
  ctx.fillRect(x - width / 2, y, width * Math.max(0, fraction), 6)
}

export function draw(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  selected: DefenderKind,
  hover: HoverCell,
): void {
  ctx.clearRect(0, 0, WIDTH, HEIGHT)

  // Lawn
  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      ctx.fillStyle = (row + col) % 2 === 0 ? '#3a8a4c' : '#44965a'
      ctx.fillRect(col * CELL, row * CELL, CELL, CELL)
    }
  }

  // The danger zone at the left edge (zombies reaching it means you lose)
  const danger = ctx.createLinearGradient(0, 0, 40, 0)
  danger.addColorStop(0, 'rgba(235, 87, 87, 0.65)')
  danger.addColorStop(1, 'rgba(235, 87, 87, 0)')
  ctx.fillStyle = danger
  ctx.fillRect(0, 0, 40, HEIGHT)

  // Hover highlight and a ghost of the selected defender (desktop only)
  if (hover && state.status === 'playing') {
    const inside = hover.row >= 0 && hover.row < ROWS && hover.col >= 0 && hover.col < COLS
    if (inside) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.22)'
      ctx.fillRect(hover.col * CELL, hover.row * CELL, CELL, CELL)
      ctx.globalAlpha = 0.5
      drawPad(ctx, hover.col * CELL + CELL / 2, hover.row * CELL + CELL / 2)
      drawEmoji(
        ctx,
        DEFENDER_SPECS[selected].emoji,
        hover.col * CELL + CELL / 2,
        hover.row * CELL + CELL / 2,
        54,
      )
      ctx.globalAlpha = 1
    }
  }

  // Defenders
  for (const defender of state.defenders) {
    const spec = DEFENDER_SPECS[defender.kind]
    const x = defender.col * CELL + CELL / 2
    const y = defender.row * CELL + CELL / 2
    drawPad(ctx, x, y)
    drawEmoji(ctx, spec.emoji, x, y, 56)
    if (defender.health < spec.health) {
      drawHealthBar(ctx, x, y + 38, defender.health / spec.health)
    }
  }

  // Pods
  for (const pod of state.pods) {
    const y = pod.row * CELL + CELL / 2 - 6
    ctx.beginPath()
    ctx.arc(pod.x, y, 9, 0, Math.PI * 2)
    ctx.fillStyle = '#e6ff9a'
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#5d9b2a'
    ctx.stroke()
  }

  // Zombies
  for (const zombie of state.zombies) {
    const wobble = zombie.biting ? Math.sin(state.time * 22) * 3 : 0
    const x = zombie.x + wobble
    const y = zombie.row * CELL + CELL / 2
    drawShadow(ctx, x, y)
    drawEmoji(ctx, ZOMBIE_EMOJI, x, y, 58)
    drawHealthBar(ctx, x, y + 38, zombie.health / ZOMBIE_HEALTH)
  }
}