/**
 * Centralized FFmpeg production settings
 * All encoding settings used by the app should be defined here
 */

/**
 * Settings for still image + audio videos
 */
export const STILL_IMAGE_SETTINGS = {
  // Video encoding
  framerate: 1,
  preset: 'ultrafast',
  crf: 23,
  gopSize: 250,  // Default GOP size
  tuneStillImage: false,  // -tune stillimage flag
  threads: 0,  // 0 = auto

  // Audio encoding
  audioCodec: 'aac',
  audioBitrate: '128k',
  audioSampleRate: '44100',
  audioChannels: 2,

  // Optimization flags
  pixelFormat: 'yuv420p',
  movFlags: '+faststart',
  shortest: true,
  fflags: '+shortest',
  maxInterleaveDelta: '0',
} as const;

/**
 * Settings for waveform visualization videos
 */
export const WAVEFORM_SETTINGS = {
  // Frame generation
  fps: 10,
  barWidth: 4,  // pixels
  barGap: 0.2,  // 20% of bar width

  // Visual appearance
  backgroundColor: '#000000',
  waveformColor: '#00bfff',
  playheadColor: '#ffffff',
  waveformPosition: 'bottom' as const,
  waveformHeight: 0.10,  // 10% of canvas height

  // Video encoding (when converting frames to video)
  videoPreset: 'fast',
  videoCrf: 23,

  // Audio encoding
  audioCodec: 'aac',
  audioBitrate: '128k',
  audioSampleRate: '44100',
  audioChannels: 2,

  // Optimization flags
  pixelFormat: 'yuv420p',
  movFlags: '+faststart',
  shortest: true,
} as const;

/**
 * Canvas dimensions - 9:16 portrait for mobile viewing.
 *
 * Bluesky recommends 1080×1920, but we use 720×1280 to keep in-browser
 * encoding fast. Higher resolution = more pixels per frame = slower canvas
 * rendering and slower FFmpeg encoding. 720p is a deliberate tradeoff.
 */
export const VIDEO_DIMENSIONS = {
  width: 720,
  height: 1280,
} as const;
