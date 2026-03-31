# Reaction Speed Trainer (PWA)

A Progressive Web App for testing and training reaction speed across **three sensory modalities**:
- **Visual** (screen signal)
- **Auditory** (tone playback)
- **Tactile** (vibration)

And **two response modes**:
- **Tap** (pointer/touch)
- **Microphone** (loud-sound detection)

The app runs multiple rounds per session and computes average performance to reduce outlier/lucky wins.

---

## What the app does

- Runs randomized reaction-time rounds with configurable round count.
- Supports test/training session modes.
- Captures raw response times and computes latency-compensated times.
- Lets users tune latency offsets (visual/audio/tactile output + tap/mic input).
- Includes automatic audio/mic latency estimation from the Web Audio pipeline.
- Includes optional backend clock sync to estimate network jitter contribution.
- Saves sessions persistently on-device and lets users review/delete old sessions.
- Works as an installable PWA (manifest + service worker + offline cache).

---

## How it was implemented

### Frontend (PWA)
- Plain HTML/CSS/JavaScript (no framework).
- `index.html` defines controls, live session panel, and history UI.
- `styles.css` applies the requested visual system:
  - Colors: `#006080`, `#363636`, `#F1F1F1`
  - Fonts: **Montserrat** for headings/buttons and **Source Sans** for body text.
- `app.js` implements:
  - stimulus scheduling and random pre-signal delays,
  - tap/mic response capture,
  - per-round latency compensation,
  - multi-round averaging,
  - local persistence of sessions and calibration offsets.

### Backend (optional but included)
- Minimal Node.js + Express backend in `backend/server.js`.
- Endpoints:
  - `GET /api/health`
  - `POST /api/ping` (used for repeated clock/RTT sampling)

### PWA assets
- `manifest.webmanifest` for install metadata.
- `service-worker.js` for caching core assets and offline fallback behavior.
- SVG icons for app install branding.

---

## Run locally (from cloned repo)

### Requirements
- Node.js 18+
- npm
- Python 3

### One command
```bash
./scripts/run-local.sh
```

This script:
1. installs backend dependencies (`npm install`),
2. starts backend at `http://localhost:8787`,
3. starts frontend static server at `http://localhost:4173`.

---

## Run directly from GitHub with prepared script

If you want a single bootstrap script that clones + installs + runs:

```bash
bash scripts/bootstrap-and-run.sh <git_repo_url> [target_dir]
```

Example:
```bash
bash scripts/bootstrap-and-run.sh https://github.com/your-org/reaction-speed-trainer.git
```

This bootstrap script clones the repository and then runs `scripts/run-local.sh`.

---

## Accuracy & latency compensation notes

No browser-based app can fully eliminate all hardware/OS/driver latency differences on every device.
This implementation improves practical accuracy by combining:
- high-resolution timing (`performance.now()`),
- configurable per-channel offsets,
- Web Audio-based auto-estimates,
- multi-round averaging,
- optional backend ping/clock sync sampling for additional jitter awareness.

For best results, run in a quiet environment, grant microphone permission, and perform several sessions.
