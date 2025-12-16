<script lang="ts">
  import { createEventDispatcher, onMount, afterUpdate } from 'svelte';

  const dispatch = createEventDispatcher();

  // Types
  interface Chapter {
    id: number;
    title: string;
    level?: number;
    subChapters?: Chapter[];
  }

  interface VirtualPage {
    pageNum: number;
    chapterId: number;
    chapterTitle: string;
    subPage?: number;
    totalSubPages?: number;
  }

  // Props
  export let show: boolean = false;
  export let chapters: Chapter[] = [];
  export let currentChapterId: number | null = null;
  export let viewMode: 'chapters' | 'pages' = 'chapters';
  export let virtualPages: VirtualPage[] = [];
  export let currentPageNum: number = 1;
  export let canToggleView: boolean = true;

  // State
  let isVisible = false;
  let chaptersContainer: HTMLElement;

  // 鼠标悬停控制
  function handleMouseEnter() {
    isVisible = true;
  }

  function handleMouseLeave() {
    isVisible = false;
  }

  // 切换视图模式
  function toggleViewMode() {
    dispatch('toggleViewMode');
  }

  // 选择章节
  function selectChapter(chapter: Chapter) {
    dispatch('chapterSelect', { chapter });
  }

  // 选择页码
  function selectPage(page: VirtualPage) {
    dispatch('pageSelect', { page });
  }

  // 自动滚动到当前项
  function scrollToActive() {
    if (!chaptersContainer) return;

    const activeItem = chaptersContainer.querySelector('.chapter-item.active, .page-item.active');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  // 当显示状态或当前章节变化时滚动
  $: if (isVisible && (currentChapterId !== null || currentPageNum)) {
    setTimeout(scrollToActive, 100);
  }
</script>

{#if show}
  <div class="chapter-trigger" on:mouseenter={handleMouseEnter} on:mouseleave={handleMouseLeave}>
    <div class="chapters-panel" class:visible={isVisible}>
      <div class="chapters-header">
        <div class="header-content">
          <h3>{viewMode === 'chapters' ? '目录' : '页码'}</h3>
          {#if canToggleView && chapters.length > 0}
            <button
              class="view-mode-toggle"
              on:click={toggleViewMode}
              title={viewMode === 'chapters' ? '切换到页码视图' : '切换到目录视图'}
            >
              {viewMode === 'chapters' ? '页码' : '目录'}
            </button>
          {/if}
        </div>
      </div>
      <div class="chapters-scroll" bind:this={chaptersContainer}>
        {#if viewMode === 'chapters'}
          <!-- 目录视图 -->
          {#each chapters as chapter}
            <button
              class="chapter-item"
              class:active={currentChapterId === chapter.id}
              class:level-0={chapter.level === 0}
              class:level-1={chapter.level === 1}
              style="margin-left: {chapter.level === 1 ? '20px' : '0'}"
              on:click={() => selectChapter(chapter)}
            >
              <span class="chapter-indent">
                {#if chapter.level === 1}
                  <span class="chapter-bullet">•</span>
                {/if}
                {chapter.title}
              </span>
            </button>

            <!-- 子章节 (PDF 风格) -->
            {#if chapter.subChapters && chapter.subChapters.length > 0}
              <div class="sub-chapters">
                {#each chapter.subChapters as subChapter}
                  <button
                    class="sub-chapter-item"
                    class:active={currentChapterId === subChapter.id}
                    on:click={() => selectChapter(subChapter)}
                  >
                    {subChapter.title}
                  </button>
                {/each}
              </div>
            {/if}
          {/each}
        {:else}
          <!-- 页码视图 -->
          {#each virtualPages as page}
            <button
              class="page-item"
              class:active={page.pageNum === currentPageNum}
              on:click={() => selectPage(page)}
            >
              <span class="page-title">
                第 {page.pageNum} 页
                {#if page.subPage}
                  <span class="sub-page-info">({page.subPage}/{page.totalSubPages})</span>
                {/if}
              </span>
              <span class="page-chapter">{page.chapterTitle}</span>
            </button>
          {/each}
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* 悬浮模式样式 */
  .chapter-trigger {
    position: fixed;
    left: 0;
    top: 50%;
    transform: translateY(-50%);
    width: 20px;
    height: 200px;
    z-index: 1000;
    cursor: pointer;
  }

  .chapters-panel {
    position: fixed;
    left: -320px;
    top: 50%;
    transform: translateY(-50%);
    width: 300px;
    max-height: 80vh;
    background: var(--background-primary);
    border: 2px solid var(--background-modifier-border);
    border-radius: 0 12px 12px 0;
    box-shadow: 4px 0 16px rgba(0, 0, 0, 0.15);
    transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    display: flex;
    flex-direction: column;
    overflow: hidden;
    z-index: 1000;
  }

  .chapters-panel.visible {
    left: 0;
  }

  .chapters-header {
    padding: 16px;
    border-bottom: 2px solid var(--background-modifier-border);
    background: linear-gradient(
      135deg,
      var(--background-secondary) 0%,
      var(--background-primary) 100%
    );
  }

  .header-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .header-content h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .view-mode-toggle {
    padding: 6px 12px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 6px;
    font-size: 12px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
  }

  .view-mode-toggle:hover {
    background: var(--interactive-accent-hover);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .chapters-scroll {
    flex: 1;
    overflow-y: auto;
    padding: 8px;
  }

  .chapter-item,
  .page-item,
  .sub-chapter-item {
    width: 100%;
    padding: 10px 12px;
    margin-bottom: 4px;
    background: var(--background-secondary);
    border: 1px solid transparent;
    border-radius: 6px;
    color: var(--text-normal);
    font-size: 13px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s ease;
    display: block;
  }

  .chapter-item:hover,
  .page-item:hover,
  .sub-chapter-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    transform: translateX(4px);
  }

  .chapter-item.active,
  .page-item.active,
  .sub-chapter-item.active {
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

  .chapter-indent {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .chapter-bullet {
    color: var(--text-muted);
    font-size: 16px;
  }

  .sub-chapters {
    margin-left: 20px;
    margin-top: 4px;
  }

  .sub-chapter-item {
    font-size: 12px;
    padding: 8px 10px;
  }

  .page-item {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .page-title {
    font-weight: 500;
  }

  .page-chapter {
    font-size: 11px;
    color: var(--text-muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sub-page-info {
    font-size: 10px;
    color: var(--text-muted);
    margin-left: 4px;
  }
</style>
