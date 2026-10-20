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
  /**
   * 服务端头像 ID（`data/avatars/<id>`）。空字符串表示跟随服务端启动参数
   * `--avatar_id` 的默认头像；非空时随 `/offer` 一起发送，服务端按需加载并缓存。
   */
  const livetalkingAvatar = useLocalStorageManualReset<string>('settings/livetalking/avatar', '')
  /** Visual zoom of the WebRTC video on the stage. */
  const livetalkingScale = useLocalStorageManualReset<number>('settings/livetalking/scale', 1)
  /** Pixel offsets of the video relative to the stage centre. */
  const livetalkingPosition = useLocalStorageManualReset<{ x: number, y: number }>('settings/livetalking/position', { x: 0, y: 0 })
  /**
   * 二期开关一：按语义选情绪。
   * 打开后每段语音会带上当前对话情绪（来自 LLM 的 ACT 信号），服务端据此在同一情绪
   * 的动作片段池里挑对话动作；关闭则退回随机挑片段。需要服务端头像包带 clips.json。
   */
  const livetalkingSemanticEmotion = useLocalStorageManualReset<boolean>('settings/livetalking/semantic-emotion', true)
  /**
   * 二期开关二：按句切音频。
   * 打开后每句语音单独上传并带句子标识，服务端在句子边界换动作片段（动作切换不会
   * 落在句子中间）；关闭则整段语音连续播放，片段只在自己播完时更换。
   */
  const livetalkingSentenceSplit = useLocalStorageManualReset<boolean>('settings/livetalking/sentence-split', true)

  function resetState() {
    livetalkingEnabled.reset()
    livetalkingServerUrl.reset()
    livetalkingAvatar.reset()
    livetalkingScale.reset()
    livetalkingPosition.reset()
    livetalkingSemanticEmotion.reset()
    livetalkingSentenceSplit.reset()
  }

  return {
    livetalkingEnabled,
    livetalkingServerUrl,
    livetalkingAvatar,
    livetalkingScale,
    livetalkingPosition,
    livetalkingSemanticEmotion,
    livetalkingSentenceSplit,

    resetState,
  }
})
