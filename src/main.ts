import './style.css'
import { Post } from './types'
import { StorageService } from './services/storage'
import { AuthService } from './services/auth'
import { BlueskyService } from './services/bluesky'
import { ImageGeneratorService } from './services/imageGenerator'
import { ThemeService } from './services/theme'
import { stripMarkdown } from './utils/markdown'

// Character limits
const BLUESKY_CHAR_LIMIT = 300

class SkyWaveApp {
  // Services
  private storage: StorageService
  private auth: AuthService
  private bluesky: BlueskyService
  private imageGenerator: ImageGeneratorService

  // Post state
  private parentPost: Post | null = null
  private audioFile: File | null = null
  private convertedVideoBlob: Blob | null = null
  private backgroundImageData: string | null = null
  private encodeStats: { frameCount: number; duration: number; frameGenMs: number; encodeMs: number } | null = null

  constructor() {
    // Initialize theme service first to apply theme early
    new ThemeService() // Creates theme toggle button

    // Initialize services
    this.storage = new StorageService()
    this.auth = new AuthService(this.storage, (authenticated, handle) => {
      this.onAuthChange(authenticated, handle)
    })
    this.bluesky = new BlueskyService(() => this.auth.getAgent())
    this.imageGenerator = new ImageGeneratorService()

    // Initialize UI and restore session
    this.initializeUI()
  }

  private initializeUI(): void {
    const app = document.querySelector<HTMLDivElement>('#app')!
    app.innerHTML = this.getInitialHTML()

    this.attachEventListeners()

    // Restore auth session if available
    const authState = this.auth.getAuthState()
    if (authState) {
      this.auth.restoreSession()
    }

    // Restore saved post data
    this.loadPostData()
  }

  private getInitialHTML(): string {
    return `
      <div class="container">
        <div style="text-align: center; margin-bottom: 2rem;">
          <img src="/logo.svg" alt="SkyWave OSS" style="max-width: 280px; width: 100%; height: auto;" />
        </div>
        <p class="subtitle" style="text-align: center; margin-top: -1rem;">Turn audio into waveform videos for Bluesky</p>

        <div id="auth-section" class="auth-section">
          <h2>Bluesky Authentication</h2>
          <form id="auth-form" class="auth-form">
            <div class="form-group">
              <label for="handle">Handle (e.g., user.bsky.social)</label>
              <input type="text" id="handle" placeholder="your-handle.bsky.social" required />
            </div>

            <div class="form-group">
              <label for="app-password">App Password</label>
              <input type="password" id="app-password" placeholder="xxxx-xxxx-xxxx-xxxx" required />
              <small style="opacity: 0.7">Create at Settings → Advanced → App passwords</small>
            </div>

            <button type="submit" id="auth-button">Connect</button>
          </form>

          <div id="auth-status"></div>
        </div>

        <div id="auth-connected" class="auth-connected" style="display: none;">
          <span class="auth-handle">
            <span style="opacity: 0.7;">Connected as</span>
            <strong id="connected-handle">@handle</strong>
          </span>
          <a href="#" id="logout-button" class="logout-link">Logout</a>
        </div>

        <div id="main-content" style="display: none;">
          <!-- Post type selection (condensed single line) -->
          <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 1.5rem;">
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap;">
              <input type="radio" name="post-type" value="new" id="post-type-new" checked style="cursor: pointer;">
              <span>New post</span>
            </label>
            <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; white-space: nowrap;">
              <input type="radio" name="post-type" value="reply" id="post-type-reply" style="cursor: pointer;">
              <span>Reply to</span>
            </label>
            <div id="reply-url-container" style="display: none; flex: 1; position: relative;">
              <input type="text" id="parent-url" placeholder="https://bsky.app/profile/user/post/..." style="width: 100%; padding-right: 35px;" />
              <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); opacity: 0.5; pointer-events: none; font-size: 1.1em;">↩</span>
            </div>
          </div>

          <div id="parent-status"></div>
          <div id="parent-post-preview" style="display: none; margin-bottom: 2rem; padding: 12px; background: var(--color-bg-secondary); border-radius: 8px; border-left: 3px solid #38bdf8;">
            <div style="font-size: 0.9rem; opacity: 0.7; margin-bottom: 4px;">Replying to:</div>
            <div id="parent-post-content"></div>
          </div>

          <!-- Editor section -->
          <div id="editor-section" class="split-layout">
            <div class="editor-panel">
              <h2>Create Post</h2>

              <div class="form-group">
                <label for="post-text">Post Text (optional, ${BLUESKY_CHAR_LIMIT} chars)</label>
                <textarea id="post-text" placeholder="Optional caption text..." rows="3"></textarea>
                <div id="char-counter" class="char-counter">0 / ${BLUESKY_CHAR_LIMIT}</div>
              </div>

              <div class="form-group">
                <label for="image-text">Image Text (optional, creates an image if filled)</label>
                <textarea id="image-text" placeholder="Text that will be rendered as an image..." rows="5"></textarea>
              </div>

              <div class="form-group">
                <label for="background-image">Background Image (optional)</label>
                <input type="file" id="background-image-input" accept="image/jpeg,image/jpg,image/png,image/webp" style="display: none;">
                <div id="background-image-controls" style="display: flex; gap: 10px; align-items: center;">
                  <button type="button" id="background-image-button" class="secondary-button" style="flex: 0 0 auto;">Choose Image</button>
                  <span id="background-image-name" style="flex: 1; opacity: 0.7; font-size: 0.9rem;">No image selected</span>
                  <button type="button" id="remove-background-button" class="secondary-button" style="display: none; flex: 0 0 auto;">Remove</button>
                </div>

                <small style="opacity: 0.7">JPG, PNG, or WebP. Will be used as video background or image background</small>
              </div>

              <div class="form-group">
                <label for="audio-file">Audio File</label>
                <input type="file" id="audio-file-input" accept="audio/mp3,audio/wav,audio/m4a,audio/mp4,audio/mpeg,audio/x-m4a" style="display: none;">
                <div id="audio-controls" style="display: flex; gap: 10px; align-items: center;">
                  <button type="button" id="audio-file-button" class="secondary-button" style="flex: 0 0 auto;">🎵 Choose Audio</button>
                  <span id="audio-file-name" style="flex: 1; opacity: 0.7; font-size: 0.9rem;">No audio selected</span>
                  <button type="button" id="remove-audio-button" class="secondary-button" style="display: none; flex: 0 0 auto;">Remove</button>
                </div>
                <div id="audio-viz-options" style="margin-top: 10px; padding: 10px; background: var(--color-bg-secondary); border-radius: 4px; display: none;">
                  <span style="font-size: 0.9rem; opacity: 0.8;">🎵 Waveform visualization video will be generated in the preview</span>
                </div>
                <div id="audio-duration-warning" style="display: none; margin-top: 8px; padding: 8px 10px; background: #7c3a00; border-left: 3px solid #f97316; border-radius: 4px; font-size: 0.875rem; color: #fed7aa;"></div>
                <small style="opacity: 0.7">MP3, M4A, or WAV. Will create a video with waveform visualization</small>
              </div>

              <div class="button-group">
                <button id="post-button" class="primary-button">Post to Bluesky</button>
                <button id="clear-editor" class="secondary-button" style="margin-left: 10px;">Clear</button>
              </div>

              <div id="post-status"></div>
            </div>

            <div class="preview-panel">
              <div class="preview-header">
                <h3>Live Preview</h3>
                <div id="preview-status" class="preview-status"></div>
              </div>
              <div id="scene-preview" class="scene-preview">
                <div id="preview-content">
                  <div style="text-align: center; opacity: 0.5; padding: 40px;">
                    Add content to see a preview
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `
  }

  private attachEventListeners(): void {
    // Auth form
    const authForm = document.getElementById('auth-form') as HTMLFormElement
    authForm?.addEventListener('submit', (e) => {
      e.preventDefault()
      this.handleAuth()
    })

    // Logout link
    const logoutButton = document.getElementById('logout-button')
    logoutButton?.addEventListener('click', (e) => {
      e.preventDefault()
      this.handleLogout()
    })

    // Post type radio buttons
    const postTypeNew = document.getElementById('post-type-new') as HTMLInputElement
    const postTypeReply = document.getElementById('post-type-reply') as HTMLInputElement
    const replyUrlContainer = document.getElementById('reply-url-container')

    postTypeNew?.addEventListener('change', () => {
      if (replyUrlContainer) replyUrlContainer.style.display = 'none'
      const parentUrlInput = document.getElementById('parent-url') as HTMLInputElement
      if (parentUrlInput) parentUrlInput.value = ''
      this.clearParentPost()
      this.savePostData()
    })

    postTypeReply?.addEventListener('change', () => {
      if (replyUrlContainer) replyUrlContainer.style.display = 'block'
      const parentUrlInput = document.getElementById('parent-url') as HTMLInputElement
      parentUrlInput?.focus()
    })

    // Parent post URL - load on Enter key
    const parentUrlInput = document.getElementById('parent-url') as HTMLInputElement
    parentUrlInput?.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault()
        const url = parentUrlInput.value.trim()
        if (url) {
          this.loadParentPost(url)
        }
      }
    })

    // Post text character counter
    const postTextArea = document.getElementById('post-text') as HTMLTextAreaElement
    const charCounter = document.getElementById('char-counter')
    postTextArea?.addEventListener('input', () => {
      const length = postTextArea.value.length
      if (charCounter) {
        charCounter.textContent = `${length} / ${BLUESKY_CHAR_LIMIT}`
        charCounter.style.color = length > BLUESKY_CHAR_LIMIT ? 'var(--color-error)' : ''
      }
      this.savePostData()
      this.updatePreview()
    })

    // Image text preview
    const imageTextArea = document.getElementById('image-text') as HTMLTextAreaElement
    imageTextArea?.addEventListener('input', () => {
      if (this.convertedVideoBlob) {
        this.convertedVideoBlob = null
        this.encodeStats = null
        this.updatePostButtonState()
      }
      this.savePostData()
      this.updatePreview()
    })

    // Background image upload
    const bgImageButton = document.getElementById('background-image-button')
    const bgImageInput = document.getElementById('background-image-input') as HTMLInputElement
    const bgImageName = document.getElementById('background-image-name')
    const removeBgButton = document.getElementById('remove-background-button')

    bgImageButton?.addEventListener('click', () => bgImageInput?.click())
    bgImageInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (event) => {
          this.backgroundImageData = event.target?.result as string
          this.convertedVideoBlob = null  // Reset so preview regenerates with new background
          this.encodeStats = null
          if (bgImageName) bgImageName.textContent = file.name
          if (removeBgButton) removeBgButton.style.display = 'block'
          this.savePostData()
          this.updatePreview()
          this.updatePostButtonState()
        }
        reader.readAsDataURL(file)
      }
    })

    removeBgButton?.addEventListener('click', () => {
      this.backgroundImageData = null
      this.convertedVideoBlob = null  // Reset so preview regenerates without background
      this.encodeStats = null
      if (bgImageInput) bgImageInput.value = ''
      if (bgImageName) bgImageName.textContent = 'No image selected'
      if (removeBgButton) removeBgButton.style.display = 'none'
      this.savePostData()
      this.updatePreview()
      this.updatePostButtonState()
    })

    // Audio file upload
    const audioButton = document.getElementById('audio-file-button')
    const audioInput = document.getElementById('audio-file-input') as HTMLInputElement
    const audioName = document.getElementById('audio-file-name')
    const removeAudioButton = document.getElementById('remove-audio-button')
    const audioVizOptions = document.getElementById('audio-viz-options')

    audioButton?.addEventListener('click', () => audioInput?.click())
    audioInput?.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        this.audioFile = file
        this.convertedVideoBlob = null
        this.encodeStats = null
        if (audioName) audioName.textContent = file.name
        if (removeAudioButton) removeAudioButton.style.display = 'block'
        if (audioVizOptions) audioVizOptions.style.display = 'block'
        this.updatePreview()
        this.updatePostButtonState()
        // Check audio duration and show warning if > 3 min
        this.checkAudioDuration(file)
      }
    })

    removeAudioButton?.addEventListener('click', () => {
      this.audioFile = null
      this.convertedVideoBlob = null
      this.encodeStats = null
      if (audioInput) audioInput.value = ''
      if (audioName) audioName.textContent = 'No audio selected'
      if (removeAudioButton) removeAudioButton.style.display = 'none'
      if (audioVizOptions) audioVizOptions.style.display = 'none'
      const durationWarning = document.getElementById('audio-duration-warning')
      if (durationWarning) durationWarning.style.display = 'none'
      this.updatePreview()
      this.updatePostButtonState()
    })

    // Post button
    const postButton = document.getElementById('post-button')
    postButton?.addEventListener('click', () => this.postToBluesky())

    // Clear button
    const clearButton = document.getElementById('clear-editor')
    clearButton?.addEventListener('click', () => this.clearForm())
  }

  private async handleAuth(): Promise<void> {
    const handleInput = document.getElementById('handle') as HTMLInputElement
    const passwordInput = document.getElementById('app-password') as HTMLInputElement
    const authButton = document.getElementById('auth-button') as HTMLButtonElement
    const statusDiv = document.getElementById('auth-status')!

    const handle = handleInput.value.trim()
    const appPassword = passwordInput.value.trim()

    if (!handle || !appPassword) {
      this.showStatus(statusDiv, 'Please enter both handle and app password', 'error')
      return
    }

    authButton.disabled = true
    this.showStatus(statusDiv, 'Connecting...', 'info')

    try {
      await this.auth.login(handle, appPassword)
      passwordInput.value = ''
      this.showStatus(statusDiv, 'Connected successfully!', 'success')
    } catch (error: any) {
      console.error('Auth error:', error)

      let errorMessage = 'Authentication failed'
      if (error.message?.includes('Invalid identifier or password')) {
        errorMessage = 'Invalid handle or app password. Please check your credentials.'
      } else if (error.message) {
        errorMessage = error.message
      }

      this.showStatus(statusDiv, errorMessage, 'error')
    } finally {
      authButton.disabled = false
    }
  }

  private handleLogout(): void {
    this.storage.clearAll()
    this.auth.logout()
    this.parentPost = null
    this.clearForm()

    // Reset UI visibility
    const authSection = document.getElementById('auth-section')
    const authConnected = document.getElementById('auth-connected')
    const mainContent = document.getElementById('main-content')

    if (authSection) authSection.style.display = 'block'
    if (authConnected) authConnected.style.display = 'none'
    if (mainContent) mainContent.style.display = 'none'

    // Clear form inputs
    const handleInput = document.getElementById('handle') as HTMLInputElement
    const passwordInput = document.getElementById('app-password') as HTMLInputElement
    if (handleInput) handleInput.value = ''
    if (passwordInput) passwordInput.value = ''
  }

  private onAuthChange(authenticated: boolean, handle?: string): void {
    const authSection = document.getElementById('auth-section')
    const authConnected = document.getElementById('auth-connected')
    const connectedHandle = document.getElementById('connected-handle')
    const mainContent = document.getElementById('main-content')

    if (authenticated && handle) {
      if (authSection) authSection.style.display = 'none'
      if (authConnected) authConnected.style.display = 'flex'
      if (connectedHandle) {
        connectedHandle.innerHTML = `<a href="https://bsky.app/profile/${handle}" target="_blank" style="color: #00bfff; text-decoration: none;">@${handle}</a>`
      }
      if (mainContent) mainContent.style.display = 'block'
    } else {
      if (authSection) authSection.style.display = 'block'
      if (authConnected) authConnected.style.display = 'none'
      if (mainContent) mainContent.style.display = 'none'
    }
  }

  private async loadParentPost(url: string): Promise<void> {
    const statusDiv = document.getElementById('parent-status')!
    const previewDiv = document.getElementById('parent-post-preview')!
    const contentDiv = document.getElementById('parent-post-content')!

    this.showStatus(statusDiv, 'Loading post...', 'info')

    try {
      const atUri = await this.bluesky.resolveUrlToUri(url)
      if (!atUri) {
        this.showStatus(statusDiv, 'Invalid URL format', 'error')
        return
      }

      const thread = await this.bluesky.getPostThread(atUri, 0)

      if (!thread.data.thread || !('post' in thread.data.thread)) {
        this.showStatus(statusDiv, 'Post not found', 'error')
        return
      }

      this.parentPost = thread.data.thread.post as Post

      // Show preview (full content, no truncation)
      const text = this.escapeHtml(this.parentPost.record.text)
      contentDiv.innerHTML = `<strong>@${this.parentPost.author.handle}</strong>: ${text}`
      previewDiv.style.display = 'block'

      // Save parent post URL
      this.savePostData()

      this.showStatus(statusDiv, 'Parent post loaded', 'success')
    } catch (error) {
      console.error('Failed to load parent post:', error)
      this.showStatus(statusDiv, 'Failed to load post', 'error')
      this.parentPost = null
    }
  }

  private clearParentPost(): void {
    this.parentPost = null
    const previewDiv = document.getElementById('parent-post-preview')!
    const statusDiv = document.getElementById('parent-status')!
    previewDiv.style.display = 'none'
    statusDiv.style.display = 'none'
  }

  private async postToBluesky(): Promise<void> {
    if (!this.auth.isUserAuthenticated()) {
      alert('Please connect to Bluesky first')
      return
    }

    const statusDiv = document.getElementById('post-status')!
    const postButton = document.getElementById('post-button') as HTMLButtonElement

    const postText = (document.getElementById('post-text') as HTMLTextAreaElement).value
    const imageText = (document.getElementById('image-text') as HTMLTextAreaElement).value

    // Validate that we have something to post
    if (!postText.trim() && !imageText.trim() && !this.audioFile) {
      this.showStatus(statusDiv, 'Please add some content to post', 'error')
      return
    }

    postButton.disabled = true
    this.showStatus(statusDiv, 'Posting...', 'info')

    try {
      let postResponse

      // Check if we have audio to post as video
      if (this.audioFile) {
        if (!this.convertedVideoBlob) {
          this.showStatus(statusDiv, 'Please generate the video preview first', 'error')
          postButton.disabled = false
          return
        }

        this.showStatus(statusDiv, 'Uploading video...', 'info')

        // Upload video to Bluesky
        const uploadResponse = await this.bluesky.uploadVideo(this.convertedVideoBlob)

        // Use image text as alt text if provided
        const altText = imageText.trim() || 'Audio waveform visualization'

        postResponse = await this.bluesky.createPost({
          text: postText.trim() || '🎵 Audio Post',
          videoBlob: uploadResponse,
          videoAlt: altText,
          replyTo: this.parentPost ? {
            root: {
              uri: this.parentPost.record.reply?.root.uri || this.parentPost.uri,
              cid: this.parentPost.record.reply?.root.cid || this.parentPost.cid,
            },
            parent: {
              uri: this.parentPost.uri,
              cid: this.parentPost.cid,
            },
          } : undefined,
        })
      } else if (imageText.trim()) {
        // Generate and post with image
        this.showStatus(statusDiv, 'Generating image...', 'info')
        const imageResult = await this.imageGenerator.generatePostImage(imageText, [], this.backgroundImageData || undefined)

        this.showStatus(statusDiv, 'Uploading image...', 'info')
        const imageBlob = await this.bluesky.uploadImage(imageResult.blob)

        const altText = this.stripHTML(stripMarkdown(imageText.trim()))

        postResponse = await this.bluesky.createPost({
          text: postText.trim(),
          imageBlob,
          imageAlt: altText,
          imageDimensions: imageResult.dimensions,
          replyTo: this.parentPost ? {
            root: {
              uri: this.parentPost.record.reply?.root.uri || this.parentPost.uri,
              cid: this.parentPost.record.reply?.root.cid || this.parentPost.cid,
            },
            parent: {
              uri: this.parentPost.uri,
              cid: this.parentPost.cid,
            },
          } : undefined,
        })
      } else {
        // Text-only post
        const textToPost = postText.trim()

        // Check character limit
        if (textToPost.length > BLUESKY_CHAR_LIMIT) {
          this.showStatus(statusDiv, `Text exceeds ${BLUESKY_CHAR_LIMIT} character limit. Consider using image text for longer content.`, 'error')
          postButton.disabled = false
          return
        }

        postResponse = await this.bluesky.createPost({
          text: textToPost,
          replyTo: this.parentPost ? {
            root: {
              uri: this.parentPost.record.reply?.root.uri || this.parentPost.uri,
              cid: this.parentPost.record.reply?.root.cid || this.parentPost.cid,
            },
            parent: {
              uri: this.parentPost.uri,
              cid: this.parentPost.cid,
            },
          } : undefined,
        })
      }

      // Show success
      statusDiv.innerHTML = `
        <div class="status success">
          Post created successfully!
          <a href="${postResponse.url}" target="_blank" style="color: #00bfff; text-decoration: underline;">
            View on Bluesky →
          </a>
        </div>
      `

      // Clear form
      this.clearForm()

    } catch (error: any) {
      console.error('Post failed:', error)
      const errorMessage = error.message || 'Failed to post. Please try again.'
      this.showStatus(statusDiv, errorMessage, 'error')
    } finally {
      postButton.disabled = false
    }
  }

  private clearForm(): void {
    // Clear text areas
    const postText = document.getElementById('post-text') as HTMLTextAreaElement
    const imageText = document.getElementById('image-text') as HTMLTextAreaElement
    if (postText) postText.value = ''
    if (imageText) imageText.value = ''

    // Clear character counter
    const charCounter = document.getElementById('char-counter')
    if (charCounter) {
      charCounter.textContent = `0 / ${BLUESKY_CHAR_LIMIT}`
      charCounter.style.color = ''
    }

    // Clear background image
    this.backgroundImageData = null
    const bgImageInput = document.getElementById('background-image-input') as HTMLInputElement
    const bgImageName = document.getElementById('background-image-name')
    const bgImagePreview = document.getElementById('background-image-preview')
    const removeBgButton = document.getElementById('remove-background-button')
    if (bgImageInput) bgImageInput.value = ''
    if (bgImageName) bgImageName.textContent = 'No image selected'
    if (bgImagePreview) bgImagePreview.style.display = 'none'
    if (removeBgButton) removeBgButton.style.display = 'none'

    // Clear audio file
    this.audioFile = null
    this.convertedVideoBlob = null
    const audioInput = document.getElementById('audio-file-input') as HTMLInputElement
    const audioName = document.getElementById('audio-file-name')
    const removeAudioButton = document.getElementById('remove-audio-button')
    const audioVizOptions = document.getElementById('audio-viz-options')
    if (audioInput) audioInput.value = ''
    if (audioName) audioName.textContent = 'No audio selected'
    if (removeAudioButton) removeAudioButton.style.display = 'none'
    if (audioVizOptions) audioVizOptions.style.display = 'none'

    // Update preview
    this.updatePreview()
  }

  private async updatePreview(): Promise<void> {
    const previewContent = document.getElementById('preview-content')
    const previewStatus = document.getElementById('preview-status')
    if (!previewContent) return

    const postText = (document.getElementById('post-text') as HTMLTextAreaElement)?.value || ''
    const imageText = (document.getElementById('image-text') as HTMLTextAreaElement)?.value || ''

    // If we have audio, show video preview or generate button
    if (this.audioFile) {
      previewContent.innerHTML = ''

      if (this.convertedVideoBlob) {
        // Show the video preview
        const videoUrl = URL.createObjectURL(this.convertedVideoBlob)
        const video = document.createElement('video')
        video.src = videoUrl
        video.controls = true
        video.style.cssText = 'max-width: 100%; border-radius: 8px; display: block;'
        previewContent.appendChild(video)

        // Add stats
        const statsDiv = document.createElement('div')
        statsDiv.style.cssText = `
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid var(--color-border);
          font-size: 0.85rem;
          color: var(--color-text-secondary);
        `
        const sizeMB = (this.convertedVideoBlob.size / (1024 * 1024)).toFixed(2)
        if (this.encodeStats) {
          const { frameCount, duration, frameGenMs, encodeMs } = this.encodeStats
          const durationStr = `${Math.floor(duration / 60)}:${String(Math.floor(duration % 60)).padStart(2, '0')}`
          statsDiv.innerHTML = `
            <div>🎬 Frames: ${frameCount} (${(frameGenMs / 1000).toFixed(1)}s to generate)</div>
            <div style="margin-top: 0.25rem;">🎥 Video: ${durationStr} duration, ${sizeMB}MB (${(encodeMs / 1000).toFixed(1)}s to encode)</div>
          `
        } else {
          statsDiv.innerHTML = `
            <div>🎥 Video: ${sizeMB}MB</div>
            <div style="margin-top: 0.25rem;">🎵 Audio converted to video with ${this.backgroundImageData ? 'custom' : 'black'} background</div>
          `
        }
        previewContent.appendChild(statsDiv)

        if (previewStatus) {
          previewStatus.textContent = '✓ Video ready'
          previewStatus.style.color = '#4CAF50'
        }
      } else {
        // Show "Generate video" button overlay
        const overlayDiv = document.createElement('div')
        overlayDiv.style.cssText = `
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 300px;
          padding: 3rem 2rem;
          background: var(--color-bg-secondary);
          border: 2px dashed var(--color-border);
          border-radius: 8px;
          text-align: center;
          gap: 1.5rem;
        `

        const messageDiv = document.createElement('div')
        messageDiv.style.cssText = 'font-size: 1rem; color: var(--color-text-secondary); line-height: 1.6;'
        messageDiv.innerHTML = `
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎬</div>
          <div><strong>Video preview not generated</strong></div>
          <div style="margin-top: 0.5rem; font-size: 0.9rem; opacity: 0.8;">
            Click below to generate video from audio.
          </div>
        `
        overlayDiv.appendChild(messageDiv)

        const generateBtn = document.createElement('button')
        generateBtn.textContent = '🎥 Generate Video Preview'
        generateBtn.className = 'primary-button'
        generateBtn.style.cssText = 'padding: 0.75rem 1.5rem; font-size: 1rem;'
        generateBtn.addEventListener('click', () => this.generateVideoPreview())
        overlayDiv.appendChild(generateBtn)

        const hintDiv = document.createElement('div')
        hintDiv.style.cssText = 'font-size: 0.85rem; color: var(--color-text-muted);'
        hintDiv.textContent = 'Generating may take 10-30 seconds depending on audio length'
        overlayDiv.appendChild(hintDiv)

        previewContent.appendChild(overlayDiv)

        if (previewStatus) {
          previewStatus.textContent = ''
        }
      }
      return
    }

    if (!postText && !imageText && !this.backgroundImageData) {
      previewContent.innerHTML = '<div style="text-align: center; opacity: 0.5; padding: 40px;">Add content to see a preview</div>'
      if (previewStatus) previewStatus.textContent = ''
      return
    }

    // Build preview HTML
    let previewHtml = ''

    // Add post text if present
    if (postText) {
      previewHtml += `<div style="white-space: pre-wrap; font-family: system-ui; line-height: 1.5; margin-bottom: 1rem;">${this.escapeHtml(postText)}</div>`

      // Add stats for text-only posts
      if (!imageText) {
        const charWarn = postText.length > 300 ? ' ⚠️ Over limit!' :
                        postText.length > 270 ? ' ⚠️' : ''
        previewHtml += `
          <div style="
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid var(--color-border);
            font-size: 0.85rem;
            color: var(--color-text-secondary);
          ">
            <div>📝 Text post: <strong>${postText.length} chars${charWarn}</strong></div>
          </div>
        `
      }
    }

    // If we have image text, show rich preview with background
    if (imageText) {
      try {
        const previewElement = await this.imageGenerator.generatePreviewElement(
          imageText,
          [],
          this.backgroundImageData || undefined
        )
        previewContent.innerHTML = previewHtml
        previewContent.appendChild(previewElement)

        if (previewStatus) {
          previewStatus.textContent = '✓ Updated'
          previewStatus.style.color = '#4CAF50'
          setTimeout(() => {
            if (previewStatus) previewStatus.textContent = ''
          }, 2000)
        }
      } catch (error) {
        console.error('Failed to generate preview:', error)
        previewContent.innerHTML = '<div style="text-align: center; opacity: 0.5; padding: 40px;">Preview generation failed</div>'
      }
      return
    }

    // Text-only preview or just background
    if (this.backgroundImageData && !postText) {
      previewHtml += `<div style="margin-bottom: 16px;">`
      previewHtml += `<img src="${this.backgroundImageData}" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--color-border);" />`
      previewHtml += `</div>`
    }

    previewContent.innerHTML = previewHtml

    if (previewStatus) {
      previewStatus.textContent = '✓ Updated'
      previewStatus.style.color = '#4CAF50'
      setTimeout(() => {
        if (previewStatus) previewStatus.textContent = ''
      }, 2000)
    }
  }

  private async generateVideoPreview(): Promise<void> {
    if (!this.audioFile) return

    const previewStatus = document.getElementById('preview-status')
    if (previewStatus) {
      previewStatus.textContent = '⏳ Generating...'
      previewStatus.style.color = ''
    }

    this.updatePostButtonState()

    try {
      const { generateWaveformFrames } = await import('./utils/audioVisualizer')
      const { createVideoFromFrames } = await import('./utils/ffmpegCore')

      // Get background image blob if available
      let backgroundImageBlob: Blob | null = null
      if (this.backgroundImageData) {
        const response = await fetch(this.backgroundImageData)
        backgroundImageBlob = await response.blob()
      }

      // Get image text overlay if provided
      const imageText = (document.getElementById('image-text') as HTMLTextAreaElement)?.value || ''

      // Generate waveform frames
      const t0 = Date.now()
      const { frames: allFrames, fps, duration } = await generateWaveformFrames(
        this.audioFile,
        {
          backgroundImage: backgroundImageBlob,
          text: imageText || undefined,
        },
        (current, total, stage) => {
          if (previewStatus) {
            previewStatus.textContent = `⏳ ${stage}: ${current}/${total}`
          }
        }
      )
      const frameGenMs = Date.now() - t0

      // Enforce 3-minute limit (Bluesky cap)
      const MAX_DURATION = 180
      let usedFrames = allFrames
      let usedDuration = duration
      if (duration > MAX_DURATION) {
        const maxFrames = Math.ceil(MAX_DURATION * fps)
        usedFrames = allFrames.slice(0, maxFrames)
        usedDuration = MAX_DURATION
        if (previewStatus) {
          const originalMins = Math.floor(duration / 60)
          const originalSecs = Math.floor(duration % 60)
          previewStatus.textContent = `⚠️ Audio is ${originalMins}:${String(originalSecs).padStart(2, '0')} — truncating to 3:00`
          previewStatus.style.color = '#f97316'
        }
        // Brief pause so user can read the truncation notice
        await new Promise(resolve => setTimeout(resolve, 1500))
      }

      // Encode frames to video
      const t1 = Date.now()
      const audioExt = this.audioFile.name.split('.').pop()?.toLowerCase() || 'mp3'
      this.convertedVideoBlob = await createVideoFromFrames(
        usedFrames,
        this.audioFile,
        fps,
        audioExt,
        (current, _total, stage) => {
          if (previewStatus) {
            previewStatus.textContent = `⏳ ${stage}: ${current}%`
          }
        }
      )
      const encodeMs = Date.now() - t1

      // Store stats for display
      this.encodeStats = {
        frameCount: usedFrames.length,
        duration: usedDuration,
        frameGenMs,
        encodeMs,
      }

      // Update preview to show the video
      this.updatePreview()
    } catch (error) {
      console.error('Failed to generate video preview:', error)
      if (previewStatus) {
        previewStatus.textContent = '❌ Failed'
        previewStatus.style.color = '#f44336'
      }
    } finally {
      this.updatePostButtonState()
    }
  }

  private async checkAudioDuration(file: File): Promise<void> {
    const warningDiv = document.getElementById('audio-duration-warning')
    if (!warningDiv) return
    try {
      const { analyzeAudio } = await import('./utils/audioVisualizer')
      const { duration } = await analyzeAudio(file)
      if (duration > 180) {
        const mins = Math.floor(duration / 60)
        const secs = Math.floor(duration % 60)
        warningDiv.textContent = `⚠️ Audio is ${mins}:${String(secs).padStart(2, '0')} — video will be truncated to 3:00 (Bluesky limit)`
        warningDiv.style.display = 'block'
      } else {
        warningDiv.style.display = 'none'
      }
    } catch {
      warningDiv.style.display = 'none'
    }
  }

  private updatePostButtonState(): void {
    const postButton = document.getElementById('post-button') as HTMLButtonElement
    if (!postButton) return

    if (this.audioFile && !this.convertedVideoBlob) {
      postButton.disabled = true
      postButton.title = 'Generate video preview first'
    } else {
      postButton.disabled = false
      postButton.title = ''
    }
  }

  private stripHTML(text: string): string {
    const div = document.createElement('div')
    div.innerHTML = text
    return div.textContent || div.innerText || ''
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }

  private showStatus(element: HTMLElement, message: string, type: 'success' | 'error' | 'info'): void {
    element.className = 'status ' + type
    element.textContent = message
    element.style.display = 'block'

    if (type === 'success') {
      setTimeout(() => {
        element.style.display = 'none'
      }, 5000)
    }
  }

  private savePostData(): void {
    const postText = (document.getElementById('post-text') as HTMLTextAreaElement)?.value || ''
    const imageText = (document.getElementById('image-text') as HTMLTextAreaElement)?.value || ''
    const parentUrl = (document.getElementById('parent-url') as HTMLInputElement)?.value || ''

    this.storage.savePostData({
      postText,
      imageText,
      backgroundImage: this.backgroundImageData || undefined,
      parentPostUrl: parentUrl || undefined,
    })
  }

  private loadPostData(): void {
    const data = this.storage.loadPostData()
    if (!data) return

    const postTextArea = document.getElementById('post-text') as HTMLTextAreaElement
    const imageTextArea = document.getElementById('image-text') as HTMLTextAreaElement
    const bgImageName = document.getElementById('background-image-name')
    const removeBgButton = document.getElementById('remove-background-button')
    const charCounter = document.getElementById('char-counter')
    const parentUrlInput = document.getElementById('parent-url') as HTMLInputElement
    const postTypeReply = document.getElementById('post-type-reply') as HTMLInputElement
    const replyUrlContainer = document.getElementById('reply-url-container')

    if (postTextArea && data.postText) {
      postTextArea.value = data.postText
      if (charCounter) {
        charCounter.textContent = `${data.postText.length} / ${BLUESKY_CHAR_LIMIT}`
      }
    }

    if (imageTextArea && data.imageText) {
      imageTextArea.value = data.imageText
    }

    if (data.backgroundImage) {
      this.backgroundImageData = data.backgroundImage
      if (bgImageName) bgImageName.textContent = 'Background image loaded'
      if (removeBgButton) removeBgButton.style.display = 'block'
    }

    if (data.parentPostUrl && parentUrlInput) {
      parentUrlInput.value = data.parentPostUrl
      // Switch to reply mode
      if (postTypeReply) postTypeReply.checked = true
      if (replyUrlContainer) replyUrlContainer.style.display = 'block'
      // Load the parent post
      this.loadParentPost(data.parentPostUrl)
    }

    // Update preview with loaded data
    this.updatePreview()
  }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SkyWaveApp()
})
