# DrumsVR — Neon Beats VR

An immersive browser-based virtual drum kit built with A-Frame and the Web Audio API. It lets users play a 3D drum set in VR with motion controllers or use keyboard controls on desktop.

## What it is for

DrumsVR is an interactive WebXR/audio experiment combining virtual instruments, spatial 3D interaction, real-time audio, recording, visual effects, and practice tools.

## Features

- VR drum kit with controller interaction
- Desktop keyboard controls (`1`–`8`) and spacebar pedal
- Multiple drum-kit sound modes
- Adjustable metronome
- Session recording and WAV export
- AI drum trainer and session analytics
- 3D studio environment and visualizer effects

## Tech stack

- HTML, CSS, JavaScript
- A-Frame 1.4.2
- Web Audio API
- WebXR-compatible VR controllers

## Run locally

Serve the project from a local web server rather than opening `index.html` directly:

```bash
npx serve -l 5173 .
```

Open `http://localhost:5173` in a WebXR-capable browser/device.

## Controls

- `1`–`8`: individual drum sounds
- `Space`: foot pedal
- VR controllers: play drums in VR

## Author

Muhammed Dilshan Cheerangan
