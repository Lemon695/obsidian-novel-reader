<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  const dispatch = createEventDispatcher();

  // Props
  // Props
  export let currentChapter: number;
  export let totalChapters: number;
  // 新增页码相关 props，如果传入则优先显示
  export let currentPage: number | undefined = undefined;
  export let totalPages: number | undefined = undefined;
  export let canGoPrev: boolean = true;
  export let canGoNext: boolean = true;
  export let showProgress: boolean = true;

  // 计算是否可以切换
  $: isFirstChapter = currentChapter === 0;
  $: isLastChapter = currentChapter >= totalChapters - 1;
  $: prevDisabled = !canGoPrev || isFirstChapter;
  $: nextDisabled = !canGoNext || isLastChapter;

  // 事件处理
  function handlePrev() {
    if (!prevDisabled) {
      dispatch('prev');
    }
  }

  function handleNext() {
    if (!nextDisabled) {
      dispatch('next');
    }
  }

  function handleToggleTOC() {
    dispatch('toggleTOC');
  }
</script>

<div class="chapter-navigation">
  <button
    class="nav-button prev-chapter"
    disabled={prevDisabled}
    on:click={handlePrev}
    title="上一章"
  >
    ← 上一章
  </button>

  <button class="nav-button toggle-outline" on:click={handleToggleTOC} title="目录">
    {#if showProgress}
      {#if currentPage !== undefined && totalPages !== undefined}
        目录 ({currentPage}/{totalPages})
      {:else}
        目录 ({currentChapter + 1}/{totalChapters})
      {/if}
    {:else}
      目录
    {/if}
  </button>

  <button
    class="nav-button next-chapter"
    disabled={nextDisabled}
    on:click={handleNext}
    title="下一章"
  >
    下一章 →
  </button>
</div>

<style>
  .chapter-navigation {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 14px 24px;
    background: linear-gradient(180deg, transparent 0%, var(--background-primary) 20%);
    backdrop-filter: blur(8px);
    border-top: 2px solid var(--background-modifier-border);
    z-index: 100;
    box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.08);
  }

  .nav-button {
    padding: 10px 24px;
    background: var(--background-secondary);
    border: 2px solid var(--background-modifier-border);
    border-radius: 8px;
    color: var(--text-normal);
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
  }

  .nav-button:hover:not(:disabled) {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    color: var(--interactive-accent);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .nav-button:active:not(:disabled) {
    transform: translateY(0);
  }

  .nav-button:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  .nav-button.toggle-outline {
    background: linear-gradient(
      135deg,
      var(--interactive-accent) 0%,
      var(--interactive-accent-hover) 100%
    );
    color: var(--text-on-accent);
    font-weight: 600;
    border-color: var(--interactive-accent);
    box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .nav-button.toggle-outline:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(var(--interactive-accent-rgb), 0.4);
  }
</style>
