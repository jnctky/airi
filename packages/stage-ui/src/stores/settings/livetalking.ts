import { useLocalStorageManualReset } from '@proj-airi/stage-shared/composables'
import { defineStore } from 'pinia'

/**
 * LiveTalking (wav2lip 真人口型) 集成设置。
 * 开启后 Stage 不再渲染本地模型，而是显示 LiveTalking 服务的 WebRTC 视频流，
 * 语音音频改道上传给 LiveTalking 驱动口型。
 */
export const useSettingsLivetalking = defineStore('settings-livetalking', () => {
  const livetalkingEnabled = useLocalStorageManualReset<boolean>('settings/livetalking/enabled', false)
  const livetalkingServerUrl = useLocalStorageManualReset<string>('settings/livetalking/server-url', 'http://127.0.0.1:8010')
  /** Visual zoom of the WebRTC video on the stage. */
  const livetalkingScale = useLocalStorageManualReset<number>('settings/livetalking/scale', 1)
  /** Pixel offsets of the video relative to the stage centre. */
  const livetalkingPosition = useLocalStorageManualReset<{ x: number, y: number }>('settings/livetalking/position', { x: 0, y: 0 })

  function resetState() {
    livetalkingEnabled.reset()
    livetalkingServerUrl.reset()
    livetalkingScale.reset()
    livetalkingPosition.reset()
  }

  return {
    livetalkingEnabled,
    livetalkingServerUrl,
    livetalkingScale,
    livetalkingPosition,

    resetState,
  }
})
