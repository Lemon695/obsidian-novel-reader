<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';

  const dispatch = createEventDispatcher();

  // Props
  export let show: boolean = false;
  export let chapters: any[] = [];
  export let currentChapterId: number | null = null;
  export let viewMode: 'chapters' | 'pages' = 'chapters';
  export let virtualPages: any[] = [];
  export let currentPageNum: number = 1;
  export let showPageToggle: boolean = true;

  // 状态
  let searchQuery = '';
  let expandedChapters = new Set<number>();

  // 过滤章节
  $: filteredChapters = searchQuery
    ? chapters.filter((ch) => ch.title.toLowerCase().includes(searchQuery.toLowerCase()))
    : chapters;

  // 过滤页码
  $: filteredPages = searchQuery
    ? virtualPages.filter((page) => {
        const chapterTitle = chapters.find((ch) => ch.id === page.chapterId)?.title || '';
        return (
          chapterTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
          page.pageNum.toString().includes(searchQuery)
        );
      })
    : virtualPages;

  // 切换展开/折叠
  function toggleExpand(chapterId: number, event: Event) {
    event.stopPropagation();
    if (expandedChapters.has(chapterId)) {
      expandedChapters.delete(chapterId);
    } else {
      expandedChapters.add(chapterId);
    }
    expandedChapters = expandedChapters;
  }

  // 检查章节是否有子章节
  function hasSubChapters(chapter: any): boolean {
    return !!(chapter.subChapters && chapter.subChapters.length > 0);
  }

  // 获取章节层级
  function getChapterLevel(chapter: any): number {
    return chapter.level || 0;
  }

  // 事件处理
  function handleChapterClick(chapter: any) {
    dispatch('chapterSelect', { chapter });
  }

  function handlePageClick(page: any) {
    dispatch('pageSelect', { page });
  }

  function handleToggleViewMode() {
    dispatch('toggleViewMode');
  }

  function handleClose() {
    dispatch('close');
  }

  // 递归渲染章节
  function renderChapter(chapter: any, level: number = 0) {
    return { chapter, level };
  }
</script>

{#if show}
  <div class="fullscreen-outline-panel" transition:fade on:click={handleClose}>
    <div class="outline-content" on:click|stopPropagation>
      <!-- 头部 -->
      <div class="outline-header">
        <h3>
          {#if viewMode === 'chapters'}
            章节目录
          {:else}
            页码目录
          {/if}
        </h3>
        <div class="header-actions">
          {#if showPageToggle}
            <button class="toggle-view-btn" on:click={handleToggleViewMode}>
              {#if viewMode === 'chapters'}
                切换到页码
              {:else}
                切换到章节
              {/if}
            </button>
          {/if}
          <button class="close-btn" on:click={handleClose}>×</button>
        </div>
      </div>

      <!-- 搜索框 -->
      <div class="search-box">
        <input
          type="text"
          placeholder="搜索章节..."
          bind:value={searchQuery}
          class="search-input"
        />
      </div>

      <!-- 章节列表 -->
      {#if viewMode === 'chapters'}
        <div class="outline-list">
          {#each filteredChapters as chapter}
            <div class="chapter-group">
              <button
                class="outline-item level-{getChapterLevel(chapter)}"
                class:active={chapter.id === currentChapterId}
                on:click={() => handleChapterClick(chapter)}
              >
                {#if hasSubChapters(chapter)}
                  <span class="expand-icon" on:click={(e) => toggleExpand(chapter.id, e)}>
                    {expandedChapters.has(chapter.id) ? '▼' : '▶'}
                  </span>
                {:else}
                  <span class="expand-icon-placeholder"></span>
                {/if}
                <span class="chapter-title">{chapter.title}</span>
                <span class="chapter-info">
                  第 {chapter.page || (typeof chapter.id === 'number' ? chapter.id + 1 : '-')} 页
                </span>
              </button>

              <!-- 子章节 -->
              {#if hasSubChapters(chapter) && expandedChapters.has(chapter.id)}
                <div class="sub-chapters">
                  {#each chapter.subChapters as subChapter}
                    <button
                      class="outline-item sub-chapter level-{getChapterLevel(subChapter) + 1}"
                      class:active={subChapter.id === currentChapterId}
                      on:click={() => handleChapterClick(subChapter)}
                    >
                      <span class="expand-icon-placeholder"></span>
                      <span class="chapter-title">{subChapter.title}</span>
                      <span class="chapter-info">
                        第 {subChapter.page ||
                          (typeof subChapter.id === 'number' ? subChapter.id + 1 : '-')} 页
                      </span>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>
          {/each}
        </div>
      {:else}
        <!-- 页码列表 -->
        <div class="outline-list">
          {#each filteredPages as page}
            <button
              class="outline-item"
              class:active={page.pageNum === currentPageNum}
              on:click={() => handlePageClick(page)}
            >
              <span class="chapter-title">
                第 {page.pageNum} 页
                {#if page.chapterTitle}
                  - {page.chapterTitle}
                {/if}
              </span>
              <!-- Removed line number info as requested -->
            </button>
          {/each}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .fullscreen-outline-panel {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    z-index: 1000;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
  }

  .outline-content {
    background: var(--background-primary);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
    max-width: 700px;
    width: 100%;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .outline-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 2px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .outline-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .header-actions {
    display: flex;
    gap: 12px;
    align-items: center;
  }

  .toggle-view-btn {
    padding: 6px 16px;
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .toggle-view-btn:hover {
    background: var(--interactive-accent-hover);
    transform: translateY(-1px);
  }

  .close-btn {
    width: 32px;
    height: 32px;
    background: var(--background-modifier-hover);
    border: none;
    border-radius: 6px;
    font-size: 24px;
    line-height: 1;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-btn:hover {
    background: var(--background-modifier-error);
    color: var(--text-error);
  }

  .search-box {
    padding: 16px 24px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .search-input {
    width: 100%;
    padding: 10px 16px;
    background: var(--background-secondary);
    border: 2px solid var(--background-modifier-border);
    border-radius: 8px;
    font-size: 14px;
    color: var(--text-normal);
    transition: all 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    background: var(--background-primary);
  }

  .outline-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .chapter-group {
    margin-bottom: 4px;
  }

  .outline-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 16px;
    margin-bottom: 4px;
    background: var(--background-secondary);
    border: 2px solid transparent;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    text-align: left;
  }

  .outline-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    transform: translateX(4px);
  }

  .outline-item.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  .outline-item.level-0 {
    font-weight: 600;
  }

  .outline-item.level-1 {
    margin-left: 20px;
    font-weight: 500;
  }

  .outline-item.sub-chapter {
    margin-left: 20px;
    background: var(--background-primary);
  }

  .expand-icon {
    width: 16px;
    font-size: 12px;
    color: var(--text-muted);
    cursor: pointer;
    user-select: none;
    flex-shrink: 0;
  }

  .expand-icon:hover {
    color: var(--text-normal);
  }

  .expand-icon-placeholder {
    width: 16px;
    flex-shrink: 0;
  }

  .chapter-title {
    font-size: 14px;
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .chapter-info {
    font-size: 12px;
    opacity: 0.7;
    margin-left: 12px;
    flex-shrink: 0;
  }

  .outline-item.active .chapter-info {
    opacity: 0.9;
  }

  .sub-chapters {
    margin-top: 4px;
  }
</style>
