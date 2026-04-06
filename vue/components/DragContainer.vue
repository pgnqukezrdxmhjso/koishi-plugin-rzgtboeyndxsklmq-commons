<template>
  <el-card
    ref="containerRef"
    :class="$style.container"
    :style="containerPosition"
  >
    <template #header>
      <el-icon
        :class="$style.move"
        @mousedown="startMove"
        @touchstart="startMove"
      >
        <Rank />
      </el-icon>
      <slot name="title" />
    </template>
    <div :class="$style.content">
      <slot />
    </div>
  </el-card>
</template>
<script setup lang="ts">
import {
  computed,
  onUnmounted,
  reactive,
  ref,
  defineProps,
  ComponentPublicInstance,
} from "vue";
import { Rank } from "@element-plus/icons-vue";

const { defaultTop, defaultRight } = defineProps<{
  defaultTop?: number;
  defaultRight?: number;
}>();

const containerPosition = computed(() => {
  return {
    top: mouseInfo.top + "px",
    right: mouseInfo.right + "px",
  };
});
const mouseInfo = reactive({
  ing: false,
  top: defaultTop || 15,
  right: defaultRight || 15,
  startTop: 0,
  startRight: 0,
  startX: 0,
  startY: 0,
});

const containerRef = ref<ComponentPublicInstance>();

const overflowCorrection = () => {
  const cRect = containerRef.value.$el.getBoundingClientRect();
  const pRect = containerRef.value.$el.offsetParent.getBoundingClientRect();
  if (mouseInfo.right < 0) {
    mouseInfo.right = 0;
  } else if (mouseInfo.right > pRect.width - cRect.width) {
    mouseInfo.right = pRect.width - cRect.width;
  }

  if (mouseInfo.top < 0) {
    mouseInfo.top = 0;
  } else if (mouseInfo.top > pRect.height - cRect.height) {
    mouseInfo.top = pRect.height - cRect.height;
  }
};

const onMousemove = (event: MouseEvent | TouchEvent) => {
  if (event instanceof TouchEvent) {
    event = event.touches[0] as any as MouseEvent;
  }
  if (!mouseInfo.ing) {
    return;
  }
  mouseInfo.top = mouseInfo.startTop + (event.clientY - mouseInfo.startY);
  mouseInfo.right = mouseInfo.startRight - (event.clientX - mouseInfo.startX);
  overflowCorrection();
};
const startMove = (event: MouseEvent | TouchEvent) => {
  if (event instanceof TouchEvent) {
    event = event.touches[0] as any as MouseEvent;
  }
  mouseInfo.startTop = mouseInfo.top;
  mouseInfo.startRight = mouseInfo.right;
  mouseInfo.startX = event.clientX;
  mouseInfo.startY = event.clientY;
  mouseInfo.ing = true;
};
const endMove = () => {
  mouseInfo.ing = false;
};

window.addEventListener("mousemove", onMousemove);
window.addEventListener("mouseup", endMove);
window.addEventListener("touchmove", onMousemove);
window.addEventListener("touchend", endMove);
window.addEventListener("resize", overflowCorrection);

onUnmounted(() => {
  window.removeEventListener("mousemove", onMousemove);
  window.removeEventListener("mouseup", endMove);
  window.removeEventListener("touchmove", onMousemove);
  window.removeEventListener("touchend", endMove);
  window.removeEventListener("resize", overflowCorrection);
});
</script>
<style module lang="scss">
.container {
  position: absolute;
  top: 15px;
  right: 15px;
  z-index: 999;
  min-width: 50px;
  background: var(--k-card-bg);
  transition: none;
  overflow: initial;

  --el-card-padding: 5px;

  :global(.el-card__header) {
    padding: 3px 0;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    user-select: none;
  }
  :global(.el-card__body) {
    display: flex;
    max-height: 60vh;
  }

  .content {
    display: flex;
    flex-direction: column;
  }

  .move {
    font-size: 20px;
    cursor: grab;

    &:active {
      cursor: grabbing;
    }
  }
}
</style>
