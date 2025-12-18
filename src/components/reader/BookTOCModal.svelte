<script lang="ts">
  import { fade } from 'svelte/transition';
  import type { Novel } from '../../types';
  import type { TOCChapter } from '../../utils/toc-converter';

  export let show: boolean = false;
  export let novel: Novel;
  export let chapters: TOCChapter[] = [];
  export let currentChapterId: number | string | null = null;
  export let onChapterSelect: (chapter: TOCChapter) => void;
  export let onClose: () => void;

  let searchQuery = '';
  let expandedChapters = new Set<number | string>();

  // 初始化时展开所有一级章节
  $: if (show && chapters.length > 0) {
    expandedChapters = new Set(chapters.filter((ch) => ch.level === 0).map((ch) => ch.id));
  }

  // 递归过滤章节
  function filterChapters(chapters: TOCChapter[], query: string): TOCChapter[] {
    if (!query) return chapters;

    const lowerQuery = query.toLowerCase();
    return chapters
      .filter((ch) => {
        const matchesTitle = ch.title.toLowerCase().includes(lowerQuery);
        const hasMatchingSubChapter =
          ch.subChapters && filterChapters(ch.subChapters, query).length > 0;
        return matchesTitle || hasMatchingSubChapter;
      })
      .map((ch) => {
        // 如果有匹配的子章节,也包含它们
        if (ch.subChapters) {
          return {
            ...ch,
            subChapters: filterChapters(ch.subChapters, query),
          };
        }
        return ch;
      });
  }

  $: filteredChapters = filterChapters(chapters, searchQuery);

  function toggleExpand(chapterId: number | string, event: Event) {
    event.stopPropagation();
    if (expandedChapters.has(chapterId)) {
      expandedChapters.delete(chapterId);
    } else {
      expandedChapters.add(chapterId);
    }
    expandedChapters = expandedChapters;
  }

  function handleChapterClick(chapter: TOCChapter) {
    onChapterSelect(chapter);
    onClose();
  }

  function handleBackdropClick() {
    onClose();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }

  function hasSubChapters(chapter: TOCChapter): boolean {
    return !!(chapter.subChapters && chapter.subChapters.length > 0);
  }

  // 递归渲染章节
  function renderChapter(chapter: TOCChapter, depth: number = 0) {
    return { chapter, depth };
  }
</script>

<svelte:window on:keydown={handleKeydown} />

{#if show}
  <div class="book-toc-modal-backdrop" transition:fade on:click={handleBackdropClick}>
    <div class="book-toc-modal-content" on:click|stopPropagation>
      <!-- 头部 -->
      <div class="modal-header">
        <h3>{novel.title} - 目录</h3>
        <button class="close-btn" on:click={onClose}>×</button>
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
      <div class="chapter-list">
        {#each filteredChapters as chapter}
          <div class="chapter-group">
            <button
              class="chapter-item level-{chapter.level}"
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

              {#if chapter.page}
                <span class="chapter-page">第{chapter.page}页</span>
              {/if}
            </button>

            <!-- 递归渲染子章节 -->
            {#if hasSubChapters(chapter) && expandedChapters.has(chapter.id)}
              <div class="sub-chapters">
                {#each chapter.subChapters as subChapter}
                  <button
                    class="chapter-item level-{subChapter.level}"
                    class:active={subChapter.id === currentChapterId}
                    on:click={() => handleChapterClick(subChapter)}
                  >
                    {#if hasSubChapters(subChapter)}
                      <span class="expand-icon" on:click={(e) => toggleExpand(subChapter.id, e)}>
                        {expandedChapters.has(subChapter.id) ? '▼' : '▶'}
                      </span>
                    {:else}
                      <span class="expand-icon-placeholder"></span>
                    {/if}

                    <span class="chapter-title">{subChapter.title}</span>

                    {#if subChapter.page}
                      <span class="chapter-page">第{subChapter.page}页</span>
                    {/if}
                  </button>

                  <!-- 三级章节 -->
                  {#if hasSubChapters(subChapter) && expandedChapters.has(subChapter.id)}
                    <div class="sub-chapters">
                      {#each subChapter.subChapters as subSubChapter}
                        <button
                          class="chapter-item level-{subSubChapter.level}"
                          class:active={subSubChapter.id === currentChapterId}
                          on:click={() => handleChapterClick(subSubChapter)}
                        >
                          <span class="expand-icon-placeholder"></span>
                          <span class="chapter-title">{subSubChapter.title}</span>
                          {#if subSubChapter.page}
                            <span class="chapter-page">第{subSubChapter.page}页</span>
                          {/if}
                        </button>
                      {/each}
                    </div>
                  {/if}
                {/each}
              </div>
            {/if}
          </div>
        {/each}

        {#if filteredChapters.length === 0}
          <div class="empty-state">
            {searchQuery ? '未找到匹配的章节' : '暂无目录'}
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  /* 参考 ReaderSidebar 的样式 */
  .book-toc-modal-backdrop {
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

  .book-toc-modal-content {
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

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px 24px;
    border-bottom: 2px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .modal-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-normal);
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

  .chapter-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .chapter-group {
    margin-bottom: 4px;
  }

  .chapter-item {
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

  .chapter-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
    transform: translateX(4px);
  }

  .chapter-item.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
  }

  /* 层级样式 */
  .chapter-item.level-0 {
    font-weight: 600;
  }

  .chapter-item.level-1 {
    margin-left: 20px;
    font-weight: 500;
  }

  .chapter-item.level-2 {
    margin-left: 40px;
    font-weight: 400;
  }

  .chapter-item.level-3 {
    margin-left: 60px;
    font-weight: 400;
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

  .chapter-page {
    font-size: 12px;
    opacity: 0.7;
    margin-left: 12px;
    flex-shrink: 0;
  }

  .chapter-item.active .chapter-page {
    opacity: 0.9;
  }

  .sub-chapters {
    margin-top: 4px;
  }

  .empty-state {
    text-align: center;
    color: var(--text-muted);
    padding: 32px;
  }
</style>
