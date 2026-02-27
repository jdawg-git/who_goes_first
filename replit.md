# Who Goes First? - Face-Detection First Player Picker

## Overview
A "magic mirror" style web application that captures a group photo and uses on-device AI (face-api.js) to select a starting player. Features a high-energy spin-down animation that builds tension before crowning a winner.

## Current State
- MVP complete with full game flow: Landing -> Camera -> Detection -> Spin Animation -> Winner Coronation
- All processing is on-device (privacy-first, works in airplane mode once cached)
- Stats dashboard at /stats tracking photos taken, uploaded, and respins
- Respin excludes previous winner from selection pool

## Tech Stack
- Frontend: React + TypeScript + Tailwind CSS + Shadcn UI
- Face Detection: face-api.js with TinyFaceDetector model (~200KB)
- Rendering: HTML5 Canvas for frame capture, CSS for animations
- Backend: Express.js with PostgreSQL (Drizzle ORM) for stats tracking
- Database: PostgreSQL with `stats_events` table

## Project Architecture
- `client/src/pages/game.tsx` - Main game component with all phases (landing, camera, detecting, spinning, winner)
- `client/src/pages/stats.tsx` - Stats dashboard showing usage metrics
- `client/public/models/` - TinyFaceDetector model weights (manifest + shard)
- `shared/schema.ts` - Database schema (stats_events table)
- `server/routes.ts` - API routes: POST /api/stats/event, GET /api/stats
- `server/storage.ts` - Database storage layer
- `server/db.ts` - Database connection

## Key Design Decisions
- Dark theme by default for immersive game feel
- Fonts: Outfit (sans) + Space Grotesk (mono)
- Gold/amber accent for winner crown and primary actions
- Cyan accent for spin-down highlighting
- Spin animation duration scales with face count: 1 face = instant winner (no spin), 2 faces = 1.5s, +1s per extra face, capped at 5s for 6+. Quadratic easing, guaranteed to land on pre-chosen winner
- Full-screen photo/video layout: object-contain preserves full image, controls overlaid with backdrop-blur
- Confetti effect (canvas-confetti) fires on winner selection
- "Player N" labels displayed under each face circle during spin and winner phases

## User Preferences
- Privacy-first: zero data transmission
- Speed: app open to winner crowned in ~10 seconds
- Visual excitement: neon highlights, golden glow, crown SVG overlay
