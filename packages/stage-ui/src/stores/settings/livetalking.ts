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

  function resetState() {
    livetalkingEnabled.reset()
    livetalkingServerUrl.reset()
  }

  return {
    livetalkingEnabled,
    livetalkingServerUrl,

    resetState,
  }
})
