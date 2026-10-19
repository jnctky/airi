<script setup lang="ts">
import type {
  StageViewErrorPayload,
  StageViewPatch,
  StageViewSnapshotPayload,
} from '@proj-airi/stage-shared/godot-stage'
import type { Live2DContext } from '@proj-airi/stage-ui-live2d'

import type { DisplayModel } from '../../../../stores/display-models'
import type { ModelSettingsRuntimeSnapshot } from './runtime'

import { Button, Callout, FieldRange, ScrollableArea } from '@proj-airi/ui'
import { storeToRefs } from 'pinia'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import Godot from './godot.vue'
import Live2D from './live2d.vue'
import MMD from './mmd.vue'
import Spine from './spine.vue'
import Tachie from './tachie.vue'
import VRM from './vrm.vue'

import { useAiriCardStore } from '../../../../stores/modules/airi-card'
import { useSettings } from '../../../../stores/settings'
import { ModelSelectorDialog } from '../../dialogs/model-selector'
import { Section } from '../../../layouts'
import Bar from '../bar.vue'
import CheckBar from '../check-bar.vue'
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
const { stageModelRenderer, stageModelSelected, stageModelSelectedDisplayModel, livetalkingEnabled, livetalkingServerUrl, livetalkingScale, livetalkingPosition } = storeToRefs(settingsStore)

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
            :label="t('settings.livetalking.scale-and-position.scale')"
          />
          <FieldRange
            v-model="livetalkingPosition.x"
            as="div"
            :min="-1000"
            :max="1000"
            :step="1"
            :default-value="0"
            :label="t('settings.livetalking.scale-and-position.x')"
          />
          <FieldRange
            v-model="livetalkingPosition.y"
            as="div"
            :min="-1000"
            :max="1000"
            :step="1"
            :default-value="0"
            :label="t('settings.livetalking.scale-and-position.y')"
          />
        </Section>
      </div>
    </div>
  </ScrollableArea>
</template>
