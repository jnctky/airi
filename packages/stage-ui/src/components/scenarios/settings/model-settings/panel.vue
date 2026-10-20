<script setup lang="ts">
import type {
  StageViewErrorPayload,
  StageViewPatch,
  StageViewSnapshotPayload,
} from '@proj-airi/stage-shared/godot-stage'
import type { Live2DContext } from '@proj-airi/stage-ui-live2d'

import type { DisplayModel } from '../../../../stores/display-models'
import type { ModelSettingsRuntimeSnapshot } from './runtime'

import { errorMessageFrom } from '@moeru/std'
import { Button, Callout, ComboboxSelect, FieldRange, ScrollableArea } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import Bar from '../bar.vue'
import CheckBar from '../check-bar.vue'
import Godot from './godot.vue'
import Live2D from './live2d.vue'
import MMD from './mmd.vue'
import Spine from './spine.vue'
import Tachie from './tachie.vue'
import VRM from './vrm.vue'

import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useSettings } from '../../../../stores/settings'
import { Section } from '../../../layouts'
import { ModelSelectorDialog } from '../../dialogs/model-selector'
import { resolveModelSettingsPanelRenderer } from './runtime'

interface ModelSettingsPanelProps {
  palette: string[]
  settingsClass?: string | string[]
  allowExtractColors?: boolean
  runtimeSnapshot: ModelSettingsRuntimeSnapshot
  live2dContext?: Live2DContext
  godotViewSnapshot?: StageViewSnapshotPayload | null
  godotViewError?: StageViewErrorPayload
  godotViewControlsLocked?: boolean
}

interface ModelSettingsPanelEmits {
  extractColorsFromModel: []
  patchGodotViewState: [patch: StageViewPatch]
}

const props = withDefaults(defineProps<ModelSettingsPanelProps>(), {
  allowExtractColors: true,
  godotViewControlsLocked: true,
  godotViewSnapshot: null,
})

const emit = defineEmits<ModelSettingsPanelEmits>()

const { t } = useI18n()
const modelSelectorOpen = ref(false)
const settingsStore = useSettings()
const airiCardStore = useAiriCardStore()
const { stageModelRenderer, stageModelSelected, stageModelSelectedDisplayModel, livetalkingEnabled, livetalkingServerUrl, livetalkingAvatar, livetalkingScale, livetalkingPosition, livetalkingSemanticEmotion, livetalkingSentenceSplit } = storeToRefs(settingsStore)

interface LiveTalkingAvatarEntry {
  id: string
  frames: number
  seconds: number
}

const avatarList = ref<LiveTalkingAvatarEntry[]>([])
const avatarListLoading = ref(false)
const avatarListError = ref('')

/** ComboboxItem 禁止空字符串 value（空值会被解释为“清除选择”），用哨兵表示“跟随服务端默认”。 */
const SERVER_DEFAULT_AVATAR = '__server_default__'
const livetalkingAvatarModel = computed({
  get: () => livetalkingAvatar.value || SERVER_DEFAULT_AVATAR,
  set: (v: string) => { livetalkingAvatar.value = v === SERVER_DEFAULT_AVATAR ? '' : v },
})

const avatarOptions = computed(() => [
  {
    value: SERVER_DEFAULT_AVATAR,
    label: t('settings.livetalking.avatar.server-default'),
    description: t('settings.livetalking.avatar.server-default-description'),
  },
  ...avatarList.value.map(avatar => ({
    value: avatar.id,
    label: avatar.id,
    description: t('settings.livetalking.avatar.frame-summary', { frames: avatar.frames, seconds: avatar.seconds }),
  })),
])

/**
 * 头像列表来自服务端 `GET /api/avatars`（扫描 data/avatars）。
 * 服务端不可达时只保留「跟随服务端默认」一项，不阻塞其它设置。
 */
async function loadAvatarList() {
  const base = (livetalkingServerUrl.value ?? '').trim().replace(/\/+$/, '')
  if (!base)
    return
  avatarListLoading.value = true
  avatarListError.value = ''
  try {
    const response = await fetch(`${base}/api/avatars`)
    const payload = await response.json()
    if (payload?.code !== 0)
      throw new Error(payload?.msg ?? 'unexpected response')
    avatarList.value = (payload.data?.avatars ?? []) as LiveTalkingAvatarEntry[]
    // 选中的头像已从服务端删除时回落到默认，避免一直连不上
    if (livetalkingAvatar.value && !avatarList.value.some(a => a.id === livetalkingAvatar.value))
      livetalkingAvatar.value = ''
  }
  catch (error) {
    avatarList.value = []
    avatarListError.value = errorMessageFrom(error) ?? String(error)
  }
  finally {
    avatarListLoading.value = false
  }
}

watch(livetalkingServerUrl, () => void loadAvatarList(), { immediate: true })

const effectiveRenderer = computed(() => resolveModelSettingsPanelRenderer({
  settingsRenderer: stageModelRenderer.value,
  runtimeRenderer: props.runtimeSnapshot.renderer,
}))

async function handleModelPick(selectedModel: DisplayModel | undefined) {
  stageModelSelected.value = selectedModel?.id ?? ''
  await airiCardStore.setActiveCardDefaultAvatarModel(selectedModel?.id)
  await settingsStore.updateStageModel()
}
</script>

<template>
  <ScrollableArea
    :class="[
      'z-10',
      settingsClass,
    ]"
  >
    <div :class="['flex flex-col gap-2 p-2']">
      <Callout :label="t('settings.model-select.panel-callout.support-status-header')">
        <i18n-t keypath="settings.model-select.panel-callout.support-status" tag="p">
          <template #select-button>
            <strong>{{ t('settings.model-select.select-model.button') }}</strong>
          </template>
          <template #zip>
            <code>.zip</code>
          </template>
          <template #vrm>
            <code>.vrm</code>
          </template>
          <template #mmd>
            <code>.pmx</code>/<code>.pmd</code>
          </template>
        </i18n-t>
        <p>
          {{ t('settings.model-select.panel-callout.model-type-example') }}
        </p>
        <p v-if="effectiveRenderer === 'tachie'">
          {{ t('settings.tachie.archive-description') }}
        </p>
      </Callout>
      <div :class="['flex flex-wrap items-center gap-2']">
        <ModelSelectorDialog v-model:show="modelSelectorOpen" :selected-model="stageModelSelectedDisplayModel" @pick="handleModelPick">
          <Button>
            {{ t('settings.model-select.select-model.button') }}
          </Button>
        </ModelSelectorDialog>
        <slot name="actions" />
      </div>
      <Live2D
        v-if="effectiveRenderer === 'live2d'"
        :allow-extract-colors="allowExtractColors"
        :palette="palette"
        :runtime-snapshot="runtimeSnapshot"
        :live2d-context="live2dContext"
        @extract-colors-from-model="emit('extractColorsFromModel')"
      />
      <VRM
        v-if="effectiveRenderer === 'vrm'"
        :allow-extract-colors="allowExtractColors"
        :palette="palette"
        :runtime-snapshot="runtimeSnapshot"
        @extract-colors-from-model="emit('extractColorsFromModel')"
      />
      <Spine
        v-if="effectiveRenderer === 'spine'"
        :allow-extract-colors="allowExtractColors"
        :palette="palette"
        :runtime-snapshot="runtimeSnapshot"
        @extract-colors-from-model="$emit('extractColorsFromModel')"
      />
      <MMD
        v-if="effectiveRenderer === 'mmd'"
        :allow-extract-colors="allowExtractColors"
        :palette="palette"
        :runtime-snapshot="runtimeSnapshot"
        @extract-colors-from-model="emit('extractColorsFromModel')"
      />
      <Tachie
        v-if="effectiveRenderer === 'tachie'"
        :allow-extract-colors="allowExtractColors"
        :palette="palette"
        :runtime-snapshot="runtimeSnapshot"
        @extract-colors-from-model="emit('extractColorsFromModel')"
      />
      <Godot
        v-if="effectiveRenderer === 'godot'"
        :runtime-snapshot="runtimeSnapshot"
        :view-snapshot="godotViewSnapshot"
        :view-error="godotViewError"
        :view-controls-locked="godotViewControlsLocked"
        @patch-view-state="emit('patchGodotViewState', $event)"
      />
      <div class="mt-2 flex flex-col gap-1">
        <CheckBar
          v-model="livetalkingEnabled"
          text="settings.livetalking.enable"
          description="settings.livetalking.enable-description"
        />
        <Bar text="settings.livetalking.server-url" :description="t('settings.livetalking.server-url-description')">
          <input
            v-model="livetalkingServerUrl"
            type="text"
            class="w-64 shrink-0 rounded-md bg-neutral-100 px-2 py-1 text-sm outline-none dark:bg-neutral-900"
            spellcheck="false"
          >
        </Bar>
        <!-- 头像选择：值随 /offer 发给服务端，切换即重连，不需要改 --avatar_id 重启 -->
        <div
          v-if="livetalkingEnabled"
          class="w-full flex items-center justify-between gap-2 rounded-lg bg-neutral-50 px-4 py-3 text-sm dark:bg-neutral-800"
        >
          <div>
            {{ t('settings.livetalking.avatar.title') }}
            <div class="text-sm text-neutral-500">
              {{ t('settings.livetalking.avatar.description') }}
            </div>
            <div v-if="avatarListError" class="mt-1 text-xs text-red-500">
              {{ t('settings.livetalking.avatar.list-failed', { error: avatarListError }) }}
            </div>
          </div>
          <div class="w-64 shrink-0">
            <ComboboxSelect
              v-model="livetalkingAvatarModel"
              :options="avatarOptions"
              :disabled="avatarListLoading"
              :placeholder="t('settings.livetalking.avatar.placeholder')"
            />
          </div>
        </div>
        <!-- 二期：动作片段的两项调度能力，随每段语音上传给服务端 -->
        <CheckBar
          v-if="livetalkingEnabled"
          v-model="livetalkingSemanticEmotion"
          text="settings.livetalking.semantic-emotion"
          description="settings.livetalking.semantic-emotion-description"
        />
        <CheckBar
          v-if="livetalkingEnabled"
          v-model="livetalkingSentenceSplit"
          text="settings.livetalking.sentence-split"
          description="settings.livetalking.sentence-split-description"
        />
        <Section
          v-if="livetalkingEnabled"
          :title="t('settings.livetalking.scale-and-position.title')"
          icon="i-solar:scale-bold-duotone"
          :class="[
            'rounded-xl',
            'bg-white/80 dark:bg-black/75',
            'backdrop-blur-lg',
          ]"
          size="sm"
          :expand="true"
        >
          <FieldRange
            v-model="livetalkingScale"
            as="div"
            :min="0.2"
            :max="3"
            :step="0.01"
            :default-value="1"
            :label="t('settings.livetalking.scale')"
          />
          <FieldRange
            v-model="livetalkingPosition.x"
            as="div"
            :min="-1000"
            :max="1000"
            :step="1"
            :default-value="0"
            :label="t('settings.livetalking.position-x')"
          />
          <FieldRange
            v-model="livetalkingPosition.y"
            as="div"
            :min="-1000"
            :max="1000"
            :step="1"
            :default-value="0"
            :label="t('settings.livetalking.position-y')"
          />
        </Section>
      </div>
    </div>
  </ScrollableArea>
</template>
