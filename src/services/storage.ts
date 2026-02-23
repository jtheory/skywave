import { AuthState, PostData, ThreadState } from '../types'

export class StorageService {
  private readonly AUTH_KEY = 'skywave_auth'
  private readonly POST_KEY = 'skywave_post'
  private readonly THREAD_KEY = 'skywave_thread'

  // Auth State
  loadAuthState(): AuthState | null {
    const stored = localStorage.getItem(this.AUTH_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('Failed to load auth state:', e)
      }
    }
    return null
  }

  saveAuthState(authState: AuthState | null): void {
    if (authState) {
      localStorage.setItem(this.AUTH_KEY, JSON.stringify(authState))
    } else {
      localStorage.removeItem(this.AUTH_KEY)
    }
  }

  clearAuthState(): void {
    localStorage.removeItem(this.AUTH_KEY)
  }

  // Post Data
  loadPostData(): PostData | null {
    const stored = localStorage.getItem(this.POST_KEY)
    if (stored) {
      try {
        return JSON.parse(stored)
      } catch (e) {
        console.error('Failed to load post data:', e)
      }
    }
    return null
  }

  savePostData(data: PostData): void {
    localStorage.setItem(this.POST_KEY, JSON.stringify(data))
  }

  clearPostData(): void {
    localStorage.removeItem(this.POST_KEY)
  }

  // Thread State
  loadThreadState(): ThreadState | null {
    const stored = localStorage.getItem(this.THREAD_KEY)
    if (stored) {
      try {
        const data = JSON.parse(stored)
        return {
          rootPost: data.rootPost || null,
          threadPath: data.threadPath || [],
          editingReplyTo: data.editingReplyTo || null,
          threadUrl: data.threadUrl
        }
      } catch (e) {
        console.error('Failed to load thread state:', e)
      }
    }
    return null
  }

  saveThreadState(state: ThreadState): void {
    localStorage.setItem(this.THREAD_KEY, JSON.stringify(state))
  }

  clearThreadState(): void {
    localStorage.removeItem(this.THREAD_KEY)
  }

  // Clear all data
  clearAll(): void {
    this.clearAuthState()
    this.clearPostData()
    this.clearThreadState()
  }
}