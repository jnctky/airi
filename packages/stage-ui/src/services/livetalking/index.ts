import type { LiveTalkingClient as LiveTalkingClientType } from './client'

import { storeToRefs } from 'pinia'
import { ref } from 'vue'

import { useSettingsLivetalking } from '../../stores/settings/livetalking'
import { LiveTalkingClient } from './client'

const sharedClient = ref<LiveTalkingClientType | undefined>()

/**
 * Shared LiveTalking client. The instance is recreated whenever the configured
 * server URL or avatar changes; `undefined` while the feature is disabled.
 */
export function useLiveTalking() {
  const settings = useSettingsLivetalking()
  const { livetalkingEnabled, livetalkingServerUrl, livetalkingAvatar } = storeToRefs(settings)

  function getClient(): LiveTalkingClientType | undefined {
    if (!livetalkingEnabled.value || !livetalkingServerUrl.value)
      return undefined

    const url = livetalkingServerUrl.value
    const avatar = livetalkingAvatar.value
    if (
      !sharedClient.value
      || sharedClient.value.serverUrl !== url
      || sharedClient.value.avatarId !== avatar
    ) {
      sharedClient.value?.disconnect()
      sharedClient.value = new LiveTalkingClient(url, avatar)
    }
    return sharedClient.value
  }

  return { getClient }
}

export { LiveTalkingClient } from './client'
export { LiveTalkingPlaybackDriver } from './playback-driver'
