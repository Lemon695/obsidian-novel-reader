<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let enabled: boolean = true;
  export let readerType: 'txt' | 'epub' | 'pdf' | 'mobi';
  export let canGoPrev: boolean = true;
  export let canGoNext: boolean = true;

  // 快捷键映射
  const keyMap = {
    prevChapter: ['ArrowLeft', 'PageUp', 'h'],
    nextChapter: ['ArrowRight', 'PageDown', 'l'],
    toggleTOC: ['t', 'o'],
    toggleSettings: ['s'],
    closePanel: ['Escape'],
  };

  // 键盘事件处理
  function handleKeyDown(event: KeyboardEvent) {
    if (!enabled) return;

    const key = event.key;

    // 上一章/页
    if (keyMap.prevChapter.includes(key)) {
      if (canGoPrev) {
        event.preventDefault();
        dispatch('prevChapter');
      }
      return;
    }

    // 下一章/页
    if (keyMap.nextChapter.includes(key)) {
      if (canGoNext) {
        event.preventDefault();
        dispatch('nextChapter');
      }
      return;
    }

    // 切换目录
    if (keyMap.toggleTOC.includes(key)) {
      event.preventDefault();
      dispatch('toggleTOC');
      return;
    }

    // 切换设置
    if (keyMap.toggleSettings.includes(key)) {
      event.preventDefault();
      dispatch('toggleSettings');
      return;
    }

    // 关闭面板
    if (keyMap.closePanel.includes(key)) {
      event.preventDefault();
      dispatch('closePanel');
      return;
    }
  }

  // 挂载时添加全局监听
  onMount(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
    }
  });

  // 卸载时移除监听
  onDestroy(() => {
    window.removeEventListener('keydown', handleKeyDown);
  });

  // 监听 enabled 变化
  $: {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
    } else {
      window.removeEventListener('keydown', handleKeyDown);
    }
  }
</script>

<!-- 无UI的逻辑组件 -->
<slot />
