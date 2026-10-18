import type { PlaybackClip, PlaybackDriver, PlayedAudio, PlayingAudio } from '@proj-airi/pipelines-audio'

import type { LiveTalkingClient } from './client'

function settledPlayingAudio(promise: Promise<PlayedAudio>): PlayingAudio {
  return {
    done: promise,
    stop: () => promise,
  }
}

/**
 * Playback driver that sends every speech clip to LiveTalking instead of (or in
 * addition to) playing it locally. The avatar's lip-sync and the audible voice
 * both come from the LiveTalking WebRTC stream, so clip audio is only uploaded.
 */
export class LiveTalkingPlaybackDriver implements PlaybackDriver {
  private context: AudioContext
  private getClient: () => LiveTalkingClient | undefined

  constructor(context: AudioContext, getClient: () => LiveTalkingClient | undefined) {
    this.context = context
    this.getClient = getClient
  }

  nowMs() {
    return this.context.currentTime * 1000
  }

  play(clip: PlaybackClip): PlayingAudio {
    const client = this.getClient()
    if (!client)
      return settledPlayingAudio(Promise.resolve({ throughMs: 0 }))

    const done = (async () => {
      // Signal "playback started" so captions and speaking state stay roughly
      // in sync with the upload; actual audio timing is owned by the server.
      clip.onStart?.()
      await client.uploadSpeechAudio(clip)
      return { throughMs: 0 } satisfies PlayedAudio
    })()

    return settledPlayingAudio(done)
  }
}
