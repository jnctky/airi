<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'

import { errorMessageFrom } from '@moeru/std'
import { useLiveTalking } from '../../services/livetalking'

const props = defineProps<{
  paused?: boolean
  /** Visual zoom applied to the video (default 1 = fit the stage). */
  scale?: number
  /** Pixel offsets relative to the stage centre. */
  position?: { x: number, y: number }
}>()

const { getClient } = useLiveTalking()

const videoRef = ref<HTMLVideoElement>()
const status = ref<'connecting' | 'connected' | 'error'>('connecting')
const errorMessage = ref('')
let retryTimer: ReturnType<typeof setTimeout> | undefined

async function connect() {
  const client = getClient()
  if (!client) {
    status.value = 'error'
    errorMessage.value = 'LiveTalking is not configured'
    return
  }
  status.value = 'connecting'
  errorMessage.value = ''
  try {
    const stream = await client.connect()
    if (videoRef.value) {
      videoRef.value.srcObject = stream
      await videoRef.value.play().catch(() => {})
    }
    status.value = 'connected'
  }
  catch (error) {
    status.value = 'error'
    errorMessage.value = errorMessageFrom(error) ?? 'Unknown error'
    scheduleRetry()
  }
}

function scheduleRetry() {
  clearTimeout(retryTimer)
  retryTimer = setTimeout(() => {
    if (status.value === 'error')
      void connect()
  }, 5000)
}

// Re-connect when the server URL setting changes.
watch(() => getClient()?.serverUrl, () => void connect())

watch(() => props.paused, (paused) => {
  if (!paused && videoRef.value)
    void videoRef.value.play().catch(() => {})
})

const videoStyle = computed(() => ({
  transform: `translate(${props.position?.x ?? 0}px, ${props.position?.y ?? 0}px) scale(${props.scale ?? 1})`,
}))

onMounted(() => void connect())

onUnmounted(() => {
  clearTimeout(retryTimer)
  getClient()?.disconnect()
})
</script>

<template>
  <!-- Absolutely positioned: the video has an intrinsic resolution (e.g. 1024x1440),
       so any `h-full` chain break makes it render at native size and blow up the
       stage. Filling the nearest positioned ancestor keeps it fitted instead. -->
  <div absolute inset-0 z-0 overflow-hidden bg-black>
    <video
      ref="videoRef"
      autoplay
      playsinline
      class="h-full w-full object-contain will-change-transform"
      :style="videoStyle"
    />
    <div
      v-if="status !== 'connected'"
      class="absolute inset-0 flex items-center justify-center"
    >
      <div class="max-w-80 flex flex-col items-center gap-2 rounded-xl bg-black/60 px-6 py-4 text-center">
        <template v-if="status === 'connecting'">
          <span class="animate-pulse text-sm text-white/80">LiveTalking…</span>
        </template>
        <template v-else>
          <span class="text-sm text-red-300">{{ errorMessage || 'LiveTalking unavailable' }}</span>
          <span class="text-xs text-white/50">retrying in 5s</span>
        </template>
      </div>
    </div>
  </div>
</template>
