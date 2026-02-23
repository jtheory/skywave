# SkyWave OSS — Project Plan

## Overview

An open-source, static web app that lets musicians (and other audio creators) turn audio files into video posts with waveform visualizations for Bluesky. No backend required — encoding happens in-browser via FFmpeg WASM. Hosted on Netlify.

## Current State

**Working:** Audio file selection, optional background image, markdown text overlay, waveform with playhead generation, in-browser FFmpeg video encoding, posting to Bluesky with optional text.

**Gap being filled:** No existing OSS tool does audio → visualization video → Bluesky post as a single workflow. Headliner/Wavve are paid SaaS and platform-agnostic. Bluecast is live streaming only.

---

## Bluesky Platform Specs

| Spec | Value |
|------|-------|
| Video limit | 3 minutes / 100 MB (50 MB if <1 min) |
| Daily upload cap | 25 videos or 10 GB |
| Supported formats | MP4, MPEG, WebM, MOV (MP4 + H.264 recommended) |
| Autoplay behavior | Autoplay on, sound muted by default |
| Target audience | Musicians on Bluesky (752+ starter packs, 2800+ cataloged) |
| Architecture | Static site (Netlify), no backend, in-browser FFmpeg |
| Competitors | Headliner (free tier), Wavve ($10+/mo), Wav2Bar (OSS desktop) |

---

## Name Candidates

Ranked roughly by strength. Decision TBD.

| Name | Vibe | Notes |
|------|------|-------|
| Skywave | Audio + sky, clean | Best all-rounder. Also a radio propagation term — check domain. |
| Airwav | Short, open, audio | air (sky/open) + wav. Hints at openness. |
| Sonoblue | Polished, premium | sono (sound) + blue. Brandable. |
| Airgram | Format-aware | air + audiogram. More podcast-y than musical. |
| Opensky | OSS signal, sky | Missing audio connotation. Could work with tagline. |
| Vaportrail | Evocative, sky | Poetic but no audio signal. Longer. |
| Bluwav | Short, punchy | Obvious meaning. Easy to type. |
| Skeetwave | Community, playful | "skeet" may age poorly as slang. |
| Audiograph | Premium, broad | Less Bluesky-specific. |
| Sonicsky | Sound + sky | Clear but a bit long. |
| Skytrack | Sky + music term | Could imply GPS. |
| Waverly | Brandable, airy | wav + airy. Less literal. |
| Wavepost | Literal, functional | Clear but generic. |

**Decision:** SkyWave OSS (tentative)

---

## Roadmap

Priority-ordered. Phase 1 ships before anything else. Phases 2–3 can interleave. STRETCH items are nice-to-haves.

### Phase 1: Branding & Identity

- [ ] 1.1 — Choose project name — Finalize from candidates above
- [ ] 1.2 — Logo / icon — Waveform motif + blue palette
- [ ] 1.3 — Color palette & type — Primary blue, dark bg, accent color
- [ ] 1.4 — Landing page — Hero demo video, feature list, CTA
- [ ] 1.5 — Deploy to Netlify — name.netlify.app or custom domain

### Phase 2: Core Polish

- [ ] 2.1 — Visualization options — Bar visualizer, radial, spectrum analyzer (bars most popular)
- [ ] 2.2 — Layout presets/templates — Dark minimal, album-art-focused, bold text overlay (2–3 presets)
- [ ] 2.3 — Aspect ratio selector — Square (1:1), portrait (9:16), landscape (16:9)
- [ ] 2.4 — Encoding UX — Progress bar, preview before post, estimated time
- [ ] 2.5 — Error handling — Auth failures, encoding errors, file size warnings

### Phase 3: Features

- [ ] 3.1 — Audio trimming — Select start/end within audio file (up to 3 min)
- [ ] 3.2 — Caption/subtitle support — Auto-gen or manual .vtt overlay `STRETCH`
- [ ] 3.3 — Batch/queue posting — Generate multiple clips from one track `STRETCH`
- [ ] 3.4 — Shareable templates — URL-encoded preset configs `STRETCH`

### Phase 4: Community & Growth

- [ ] 4.1 — Bluesky starter pack — Curate list of musicians using the tool
- [ ] 4.2 — Open source repo — README, contributing guide, license
- [ ] 4.3 — Gallery / showcase — Examples of posts made with the tool `STRETCH`

---

## Design Notes

### Visualization Priorities

Based on what's most popular in audiograms and music-sharing contexts:

1. **Animated bar visualizer** — the default for Headliner/Wavve. Immediately signals "audio content." Most recognizable.
2. **Waveform with playhead** — already implemented. Good for showing full track structure.
3. **Radial/circular visualizer** — eye-catching, popular with electronic/EDM creators.
4. **Spectrum analyzer** — frequency-domain visualization. More niche but visually distinctive.

### Template Ideas

- **Dark Minimal:** Black bg, white/blue waveform, small text. Works for any genre.
- **Album Art Focus:** Large background image (album art), semi-transparent overlay, waveform at bottom.
- **Bold Text:** Large track name / artist, prominent waveform, solid color bg. Good for promo clips.

### Architecture Decisions

- **In-browser FFmpeg:** Already working. Key advantage: no server costs, no upload latency, privacy-friendly.
- **Static hosting (Netlify):** No backend needed. Auth happens client-side via Bluesky's atproto OAuth or app password.
- **Output format:** MP4 + H.264 for maximum Bluesky compatibility. Target <100 MB.

---

## Open Questions

1. Should the app support posting to other platforms (Mastodon, Threads) or stay Bluesky-focused?
2. PWA / installable app, or web-only?

## Decisions Made

- **License:** AGPL
- **Auth:** App passwords stored in localStorage (opt-in via "remember on this device" checkbox). See security notes below.
- **Name:** SkyWave OSS (tentative)

### Auth Security Notes

**localStorage threat model:**
- Safe from: remote attacks, cross-origin reads (same-origin policy), network interception
- Vulnerable to: XSS on our domain, browser extensions with host permissions, physical/local device access

**Comparison to official Bluesky web app:**
The official app also stores tokens in localStorage, but uses OAuth with scoped, revocable, expiring session tokens. App passwords are unscoped (full account access) and don't expire until manually revoked. For a static Netlify site with no user-generated content and no third-party scripts, the XSS attack surface is small.

**Mitigations (current):**
- UI prominently says: "Use a dedicated app password (Settings → App Passwords in Bluesky). Never enter your main password."
- Don't store by default — opt-in "remember on this device" checkbox
- App passwords are individually revocable without changing main password

**Mitigations (future):**
- [ ] Migrate to OAuth when atproto's client-side OAuth flow matures (roadmap item)
