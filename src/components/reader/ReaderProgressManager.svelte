<script context="module" lang="ts">
  // 进度位置类型
  export interface ProgressPosition {
    // 通用字段
    chapterIndex: number;
    chapterTitle: string;
    timestamp?: number;

    // TXT/MOBI 特定
    scrollPosition?: number;

    // EPUB 特定
    cfi?: string;
    chapterId?: number;

    // PDF 特定
    pageNum?: number;
  }
</script>

<script lang="ts">
  import { createEventDispatcher, onDestroy } from 'svelte';
  import type NovelReaderPlugin from '../../main';
  import type { Novel, ReadingProgress } from '../../types';

  const dispatch = createEventDispatcher();

  // Props
  export let plugin: NovelReaderPlugin;
  export let novel: Novel;
  export let readerType: 'txt' | 'epub' | 'pdf' | 'mobi';
  export let totalChapters: number; // 总章节数/页数
  export let autoSave: boolean = true;
  export let saveInterval: number = 3000; // 3秒自动保存

  // 当前位置
  export let currentPosition: ProgressPosition;

  // 内部状态
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let lastSavedPosition: ProgressPosition | null = null;

  // 防抖保存
  function debouncedSave() {
    if (!autoSave) return;

    if (saveTimer) {
      clearTimeout(saveTimer);
    }

    saveTimer = setTimeout(() => {
      saveProgress();
    }, saveInterval);
  }

  // 保存进度
  export function saveProgress(): ReadingProgress | null {
    if (!currentPosition) return null;

    // 检查是否有变化
    if (
      lastSavedPosition &&
      lastSavedPosition.chapterIndex === currentPosition.chapterIndex &&
      lastSavedPosition.pageNum === currentPosition.pageNum &&
      lastSavedPosition.cfi === currentPosition.cfi
    ) {
      return null; // 无变化,不保存
    }

    const progress: ReadingProgress = {
      novelId: novel.id,
      chapterIndex: currentPosition.chapterIndex,
      progress: calculateProgress(),
      timestamp: Date.now(),
      totalChapters: totalChapters,
      position: {
        chapterId: currentPosition.chapterId || currentPosition.chapterIndex,
        chapterTitle: currentPosition.chapterTitle,
        cfi: currentPosition.cfi || '',
        percentage: currentPosition.scrollPosition || 0,
        page: currentPosition.pageNum, // 保存 PDF 页码或虚拟页码
      },
    };

    // 保存到本地
    lastSavedPosition = { ...currentPosition };

    // 1. 发送事件
    dispatch('save', { progress });

    // 2. 直接调用服务保存 (修复: 确保所有阅读器都能统一保存)
    if (plugin && plugin.libraryService) {
      // LibraryService 中用于保存进度的方法是 updateProgress
      plugin.libraryService.updateProgress(novel.id, progress).catch((err) => {
        console.error('[ReaderProgressManager] Failed to save progress:', err);
      });
    }

    console.log(`[ReaderProgressManager] Saved progress for ${readerType}:`, progress);

    return progress;
  }

  // 计算总体进度百分比
  function calculateProgress(): number {
    if (totalChapters === 0) return 0;

    switch (readerType) {
      case 'txt':
      case 'mobi':
        return (currentPosition.chapterIndex / totalChapters) * 100;

      case 'epub':
        // EPUB 基于章节和 CFI
        return (currentPosition.chapterIndex / totalChapters) * 100;

      case 'pdf':
        // PDF 基于页码
        if (currentPosition.pageNum) {
          return (currentPosition.pageNum / totalChapters) * 100;
        }
        return (currentPosition.chapterIndex / totalChapters) * 100;

      default:
        return 0;
    }
  }

  // 手动触发保存
  export function forceSave() {
    if (saveTimer) {
      clearTimeout(saveTimer);
      saveTimer = null;
    }
    saveProgress();
  }

  // 监听位置变化
  $: if (currentPosition && autoSave) {
    debouncedSave();
  }

  // 清理
  onDestroy(() => {
    if (saveTimer) {
      clearTimeout(saveTimer);
    }
    // 组件销毁时强制保存一次
    if (currentPosition) {
      saveProgress();
    }
  });
</script>

<!-- 这是一个无UI的逻辑组件 -->
<slot />
