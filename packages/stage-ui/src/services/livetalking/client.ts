import type { PlaybackClip, PlayedAudio, PlayingAudio } from '@proj-airi/pipelines-audio'

/**
 * Browser client for a LiveTalking server (https://github.com/lipku/LiveTalking).
 *
 * The server streams the talking-head video (and the spoken audio) over WebRTC,
 * while speech audio produced by AIRI is uploaded via `/humanaudio` so the
 * avatar lip-syncs to AIRI's own TTS voice.
 */

export class LiveTalkingClient {
  private pc: RTCPeerConnection | undefined
  private stream: MediaStream | undefined
  private sessionid: string | undefined
  private decodeContext: AudioContext | undefined

  constructor(public serverUrl: string) {}

  /** Established WebRTC media stream, or undefined before the first successful connect. */
  get mediaStream() {
    return this.stream
  }

  get connected() {
    return !!this.stream && this.pc?.connectionState !== 'closed' && this.pc?.connectionState !== 'failed'
  }

  /**
   * Offer/answer handshake with `POST /offer`. Safe to call repeatedly; an
   * already-live connection is reused until the transport dies.
   */
  async connect(): Promise<MediaStream> {
    if (this.connected && this.stream)
      return this.stream

    this.disconnect()

    const base = this.serverUrl.replace(/\/+$/, '')
    const pc = new RTCPeerConnection()
    // LiveTalking answers with both tracks; we only receive.
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.addTransceiver('audio', { direction: 'recvonly' })

    const stream = new MediaStream()
    pc.addEventListener('track', (event) => {
      stream.addTrack(event.track)
    })

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    const response = await fetch(`${base}/offer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sdp: pc.localDescription?.sdp, type: pc.localDescription?.type }),
    })
    if (!response.ok)
      throw new Error(`LiveTalking /offer failed: HTTP ${response.status}`)
    const answer = await response.json() as { sdp: string, type: RTCSdpType, sessionid: number | string, code?: number, msg?: string }
    if (answer.code === -1)
      throw new Error(`LiveTalking rejected the offer: ${answer.msg ?? 'unknown error'}`)

    await pc.setRemoteDescription({ sdp: answer.sdp, type: answer.type })
    this.sessionid = String(answer.sessionid)
    this.pc = pc
    this.stream = stream
    return stream
  }

  /**
   * Decode any browser-supported audio (mp3 / wav / ogg …) and upload it as a
   * 16-bit PCM WAV so the server's soundfile reader always accepts it.
   */
  async uploadSpeechAudio(clip: PlaybackClip): Promise<void> {
    const base = this.serverUrl.replace(/\/+$/, '')
    if (!this.sessionid)
      await this.connect()

    const wav = encodeAudioBufferWav(await this.clipToAudioBuffer(clip))
    const form = new FormData()
    form.append('sessionid', this.sessionid ?? '')
    form.append('file', new Blob([wav], { type: 'audio/wav' }), 'speech.wav')

    const response = await fetch(`${base}/humanaudio`, { method: 'POST', body: form })
    if (!response.ok)
      throw new Error(`LiveTalking /humanaudio failed: HTTP ${response.status}`)
    const result = await response.json() as { code?: number, msg?: string }
    if (result.code === -1)
      throw new Error(`LiveTalking /humanaudio rejected: ${result.msg ?? 'unknown error'}`)
  }

  /** Interrupt whatever the avatar is currently saying. */
  async interrupt(): Promise<void> {
    if (!this.sessionid)
      return
    const base = this.serverUrl.replace(/\/+$/, '')
    await fetch(`${base}/interrupt_talk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionid: this.sessionid }),
    }).catch(() => {})
  }

  disconnect() {
    this.pc?.close()
    this.pc = undefined
    this.stream = undefined
    this.sessionid = undefined
  }

  private getDecodeContext() {
    this.decodeContext ??= new AudioContext()
    return this.decodeContext
  }

  /** Collects the clip audio (blob or PCM stream) into a decoded AudioBuffer. */
  private async clipToAudioBuffer(clip: PlaybackClip): Promise<AudioBuffer> {
    if (clip.audio instanceof Blob) {
      const arrayBuffer = await clip.audio.arrayBuffer()
      return await this.getDecodeContext().decodeAudioData(arrayBuffer)
    }

    const reader = clip.audio.getReader()
    const blocks: { channels: readonly Float32Array[], sampleRate: number }[] = []
    let sampleRate = 48000
    try {
      for (;;) {
        const result = await reader.read()
        if (result.done)
          break
        sampleRate = result.value.sampleRate
        blocks.push({ channels: result.value.channels, sampleRate: result.value.sampleRate })
      }
    }
    finally {
      reader.releaseLock()
    }
    const numChannels = blocks[0]?.channels.length ?? 1
    const length = blocks.reduce((sum, block) => sum + (block.channels[0]?.length ?? 0), 0)
    const buffer = this.getDecodeContext().createBuffer(numChannels, Math.max(length, 1), sampleRate)
    let frameOffset = 0
    for (const block of blocks) {
      for (let c = 0; c < numChannels; c++) {
        const data = block.channels[c]
        if (data)
          buffer.copyToChannel(new Float32Array(data), c, frameOffset)
      }
      frameOffset += block.channels[0]?.length ?? 0
    }
    return buffer
  }
}

export function encodeAudioBufferWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels
  const sampleRate = buffer.sampleRate
  const numFrames = buffer.length
  const bytesPerSample = 2
  const blockAlign = numChannels * bytesPerSample
  const dataSize = numFrames * blockAlign
  const arrayBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(arrayBuffer)

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i++)
      view.setUint8(offset + i, text.charCodeAt(i))
  }

  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true) // PCM
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * blockAlign, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, 8 * bytesPerSample, true)
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  let offset = 44
  for (let frame = 0; frame < numFrames; frame++) {
    for (let c = 0; c < numChannels; c++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(c)[frame]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true)
      offset += 2
    }
  }
  return arrayBuffer
}

/** A driver-shaped no-op used when LiveTalking is selected but not yet reachable. */
export const silentPlayingAudio: PlayingAudio = {
  done: Promise.resolve({ throughMs: 0 } satisfies PlayedAudio),
  stop: () => Promise.resolve({ throughMs: 0 } satisfies PlayedAudio),
}
