import type { PlaybackClip, PlaybackDriver, PlayedAudio, PlayingAudio } from '@proj-airi/pipelines-audio'

import type { LiveTalkingClient } from './client'

function settledPlayingAudio(promise: Promise<PlayedAudio>): PlayingAudio {
  return {
    done: promise,
    stop: () => promise,
  }
}

/**
 * 二期开关与当前情绪的读取口。用回调而不是值，保证上传那一刻拿到最新设置
 * （设置页改开关不需要重建驱动或重连）。
 */
export interface LiveTalkingPlaybackOptions {
  getEmotion?: () => string | undefined
  getSemanticEmotion?: () => boolean
  getSentenceSplit?: () => boolean
}

/**
 * Playback driver that sends every speech clip to LiveTalking instead of (or in
 * addition to) playing it locally. The avatar's lip-sync and the audible voice
 * both come from the LiveTalking WebRTC stream, so clip audio is only uploaded.
 *
 * 每个 clip 对应 TTS 分句器切出的一句话，clip.id 就是句子标识：服务端据此判断
 * 句边界（按句切音频），并配合 emotion 挑对应情绪的动作片段（按语义选情绪）。
 */
export class LiveTalkingPlaybackDriver implements PlaybackDriver {
  private context: AudioContext
  private getClient: () => LiveTalkingClient | undefined
  private options: LiveTalkingPlaybackOptions

  constructor(context: AudioContext, getClient: () => LiveTalkingClient | undefined, options: LiveTalkingPlaybackOptions = {}) {
    this.context = context
    this.getClient = getClient
    this.options = options
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
      await client.uploadSpeechAudio(clip, {
        emotion: this.options.getEmotion?.(),
        segment: clip.id,
        semanticEmotion: this.options.getSemanticEmotion?.() ?? false,
        sentenceSplit: this.options.getSentenceSplit?.() ?? false,
      })
      return { throughMs: 0 } satisfies PlayedAudio
    })()

    return settledPlayingAudio(done)
  }
}
