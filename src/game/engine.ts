// Garden Guard: the rules of the game.
// This file is plain TypeScript with no browser code, so the rules can be
// tested without drawing anything.

// ---------- The lawn ----------
export const COLS = 9
export const ROWS = 5
export const CELL = 100 // size of one square, in game units
export const WIDTH = COLS * CELL
export const HEIGHT = ROWS * CELL

// ---------- Defenders (the things you plant) ----------
export type DefenderKind = 'shooter' | 'bloom'

export type DefenderSpec = {
  name: string
  emoji: string // written as an escape code so the file stays plain text
  cost: number
  health: number
  cooldown: number // seconds before you can plant another of this kind
  description: string
}

export const DEFENDER_KINDS: DefenderKind[] = ['shooter', 'bloom']

export const DEFENDER_SPECS: Record<DefenderKind, DefenderSpec> = {
  shooter: {
    name: 'Pod Shooter',
    emoji: '\u{1F33F}', // herb
    cost: 100,
    health: 100,
    cooldown: 4,
    description: 'Fires pods down its lane',
  },
  bloom: {
    name: 'Glow Bloom',
    emoji: '\u{1F33C}', // blossom
    cost: 50,
    health: 80,
    cooldown: 3,
    description: 'Makes glow energy',
  },
}

export const ZOMBIE_EMOJI = '\u{1F9DF}' // zombie

// ---------- Numbers you can tweak to change how hard the game is ----------
const START_GLOW = 150
const TRICKLE_INTERVAL = 8 // seconds between free glow drops
const TRICKLE_GLOW = 25
const BLOOM_INTERVAL = 7 // seconds between a bloom making glow
const BLOOM_GLOW = 25
const SHOOT_INTERVAL = 1.3 // seconds between shots
const POD_SPEED = 320 // game units per second
const POD_DAMAGE = 20
export const ZOMBIE_HEALTH = 220
const ZOMBIE_SPEED = 24 // game units per second
const ZOMBIE_BITE_DAMAGE = 25
const ZOMBIE_BITE_INTERVAL = 1 // seconds between bites
const ZOMBIE_REACH = 25 // how far in front of its centre a zombie can bite
const MAX_STEP = 0.05 // never simulate more than this many seconds at once

// ---------- Things in the game ----------
export type Defender = {
  id: number
  kind: DefenderKind
  row: number
  col: number
  health: number
  timer: number // counts up to the next shot or glow drop
}

export type Zombie = {
  id: number
  row: number
  x: number // centre of the zombie, in game units
  health: number
  biting: boolean
  biteTimer: number
}

export type Pod = { id: number; row: number; x: number }

export type Spawn = { at: number; row: number } // at = seconds after the start

export type GameStatus = 'playing' | 'won' | 'lost'

export type GameState = {
  status: GameStatus
  time: number
  glow: number
  trickleTimer: number
  defenders: Defender[]
  zombies: Zombie[]
  pods: Pod[]
  spawns: Spawn[] // zombies that have not arrived yet, earliest first
  totalZombies: number
  defeated: number
  cooldowns: Record<DefenderKind, number>
  nextId: number
}

// ---------- Level 1: when and where zombies arrive ----------
export const LEVEL_ONE: Spawn[] = [
  { at: 12, row: 2 },
  { at: 26, row: 1 },
  { at: 38, row: 3 },
  { at: 48, row: 0 },
  { at: 54, row: 4 },
  { at: 60, row: 2 },
  { at: 64, row: 1 },
  { at: 66, row: 3 },
  { at: 70, row: 2 },
  { at: 72, row: 0 },
  { at: 74, row: 4 },
  { at: 78, row: 2 },
  { at: 80, row: 1 },
  { at: 82, row: 3 },
  { at: 86, row: 2 },
  { at: 88, row: 4 },
  { at: 90, row: 0 },
  { at: 92, row: 1 },
  { at: 94, row: 3 },
  { at: 96, row: 2 },
  // the final wave: every lane at once, then a second push
  { at: 105, row: 0 },
  { at: 105, row: 1 },
  { at: 105, row: 2 },
  { at: 105, row: 3 },
  { at: 105, row: 4 },
  { at: 113, row: 1 },
  { at: 113, row: 2 },
  { at: 113, row: 3 },
]

export function createGame(level: Spawn[] = LEVEL_ONE): GameState {
  const spawns = [...level].sort((a, b) => a.at - b.at)
  return {
    status: 'playing',
    time: 0,
    glow: START_GLOW,
    trickleTimer: 0,
    defenders: [],
    zombies: [],
    pods: [],
    spawns,
    totalZombies: spawns.length,
    defeated: 0,
    cooldowns: { shooter: 0, bloom: 0 },
    nextId: 1,
  }
}

// ---------- Planting ----------
export type PlaceResult =
  | 'ok'
  | 'not-playing'
  | 'out-of-bounds'
  | 'occupied'
  | 'too-expensive'
  | 'recharging'

export function placeDefender(
  state: GameState,
  kind: DefenderKind,
  row: number,
  col: number,
): PlaceResult {
  const spec = DEFENDER_SPECS[kind]
  if (state.status !== 'playing') return 'not-playing'
  if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return 'out-of-bounds'
  if (state.defenders.some((d) => d.row === row && d.col === col)) return 'occupied'
  if (state.cooldowns[kind] > 0) return 'recharging'
  if (state.glow < spec.cost) return 'too-expensive'

  state.glow -= spec.cost
  state.cooldowns[kind] = spec.cooldown
  state.defenders.push({
    id: state.nextId++,
    kind,
    row,
    col,
    health: spec.health,
    timer: 0,
  })
  return 'ok'
}

// ---------- One tick of the game ----------
export function step(state: GameState, seconds: number): void {
  if (state.status !== 'playing') return
  const dt = Math.min(Math.max(seconds, 0), MAX_STEP)
  state.time += dt

  // Free glow now and then
  state.trickleTimer += dt
  if (state.trickleTimer >= TRICKLE_INTERVAL) {
    state.trickleTimer -= TRICKLE_INTERVAL
    state.glow += TRICKLE_GLOW
  }

  // Cards recharge
  for (const kind of DEFENDER_KINDS) {
    state.cooldowns[kind] = Math.max(0, state.cooldowns[kind] - dt)
  }

  // Zombies arrive
  while (state.spawns.length > 0 && state.spawns[0].at <= state.time) {
    const next = state.spawns.shift()
    if (!next) break
    state.zombies.push({
      id: state.nextId++,
      row: next.row,
      x: WIDTH + 30,
      health: ZOMBIE_HEALTH,
      biting: false,
      biteTimer: 0,
    })
  }

  // Defenders work
  for (const defender of state.defenders) {
    if (defender.kind === 'bloom') {
      defender.timer += dt
      if (defender.timer >= BLOOM_INTERVAL) {
        defender.timer -= BLOOM_INTERVAL
        state.glow += BLOOM_GLOW
      }
    } else {
      const centreX = defender.col * CELL + CELL / 2
      const hasTarget = state.zombies.some(
        (z) => z.row === defender.row && z.x > centreX && z.x <= WIDTH,
      )
      defender.timer = Math.min(defender.timer + dt, SHOOT_INTERVAL)
      if (hasTarget && defender.timer >= SHOOT_INTERVAL) {
        defender.timer = 0
        state.pods.push({ id: state.nextId++, row: defender.row, x: centreX + 30 })
      }
    }
  }

  // Pods fly and hit
  for (const pod of state.pods) {
    pod.x += POD_SPEED * dt
    const target = state.zombies.find(
      (z) => z.row === pod.row && z.x <= WIDTH && Math.abs(z.x - pod.x) < 30,
    )
    if (target) {
      target.health -= POD_DAMAGE
      pod.x = WIDTH + 1000 // used up: removed below
    }
  }
  state.pods = state.pods.filter((p) => p.x <= WIDTH + 20)

  // Zombies walk and bite
  for (const zombie of state.zombies) {
    const mouth = zombie.x - ZOMBIE_REACH
    let victim: Defender | undefined
    for (const defender of state.defenders) {
      if (defender.row !== zombie.row) continue
      const left = defender.col * CELL
      const right = left + CELL
      if (mouth <= right - 20 && mouth >= left - 10) {
        if (!victim || defender.col > victim.col) victim = defender
      }
    }
    if (victim) {
      zombie.biting = true
      zombie.biteTimer += dt
      if (zombie.biteTimer >= ZOMBIE_BITE_INTERVAL) {
        zombie.biteTimer -= ZOMBIE_BITE_INTERVAL
        victim.health -= ZOMBIE_BITE_DAMAGE
      }
    } else {
      zombie.biting = false
      zombie.biteTimer = 0
      zombie.x -= ZOMBIE_SPEED * dt
    }
  }

  // Clear away anything that was destroyed
  state.defenders = state.defenders.filter((d) => d.health > 0)
  const before = state.zombies.length
  state.zombies = state.zombies.filter((z) => z.health > 0)
  state.defeated += before - state.zombies.length

  // Win or lose
  if (state.zombies.some((z) => z.x - ZOMBIE_REACH <= 0)) {
    state.status = 'lost'
  } else if (state.spawns.length === 0 && state.zombies.length === 0) {
    state.status = 'won'
  }
}