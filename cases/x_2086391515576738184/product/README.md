# Hill Climb — Browser Edition

A Hill Climb Racing-style browser game in a single HTML file. No dependencies, no build step.

## Run

Open `index.html` directly in a browser, or serve the folder:

```bash
cd round_1/workspace   # this directory
python3 -m http.server 8000
# then visit http://localhost:8000
```

## How to play

- **Gas:** `→` / `D` or right half of the screen (touch)
- **Brake:** `←` / `A` or left half of the screen (touch)
- **Mid-air tilt:** gas pitches the nose down, brake pitches it up (on the ground, throttle wheelies — feather it like a real driver)
- **R:** restart run · **M:** mute · **P / Esc:** pause

## Features

- Custom rigid-body car physics: raycast suspension, wheelie torque, belly/chassis collision, driver's-head crash detection
- Procedural endless terrain with distance-scaled difficulty and a gentle uphill trend
- Fuel management: the tank drains as you drive; red jerry cans refill it
- Coin pickups, frontflip/backflip bonuses (+2 coins per rotation)
- Day → sunset → night → dawn → forest palette cycle every 800 m, with parallax mountains, drifting clouds and stars
- Web Audio engine hum tied to RPM, coin/fuel/flip/crash sound effects (starts after first input, per browser autoplay policy)
- HUD: distance, coins, speed, fuel gauge, pedal indicators; menu and game-over screens; best distance and coin bank persisted in `localStorage`

## Development

`test-harness.js` is a Node smoke test that stubs the DOM/canvas/audio APIs, drives the game loop with a synthetic driver, and asserts core behaviors (spawning, suspension settle, driving progress, pickups, both death modes, restart, 90 s stability soak, flip reward).

```bash
node test-harness.js
```
