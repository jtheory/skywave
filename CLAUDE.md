# Claude Code Instructions

## Project Overview

**SkyWave OSS** — An open-source, static web app that lets musicians turn audio files into video posts with waveform visualizations for Bluesky.

### What It Does
- Load audio files and optional background images
- Generate waveform visualizations with playhead animation
- Add markdown text overlays
- Encode video in-browser using FFmpeg WASM
- Post directly to Bluesky with optional caption text

### Architecture
- Static web app (Vite + TypeScript)
- In-browser FFmpeg WASM for video encoding (no backend needed)
- Direct Bluesky API integration via @atproto/api
- Deployed on Netlify
- Auth: App passwords stored in localStorage (opt-in)

### Current State
**Working:** Audio file selection, optional background image, markdown text overlay, waveform with playhead generation, in-browser FFmpeg video encoding, posting to Bluesky with optional text.

**Next priorities:** Branding & identity (Phase 1), visualization options (Phase 2), polish & error handling.

## Important Rules

- **NEVER commit changes unless explicitly asked** - Always let the user test first before committing
- Only create git commits when the user specifically requests it
- **NEVER proactively create documentation files** unless explicitly requested

## Current Focus

Phase 1 (Branding & Identity) and Phase 2 (Core Polish) — see project_plan.md for full roadmap.