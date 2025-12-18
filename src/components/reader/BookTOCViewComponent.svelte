<script lang="ts">
  import type { Novel } from '../../types';
  import type { TOCChapter } from '../../utils/toc-converter';
  import type NovelReaderPlugin from '../../main';

  export let novel: Novel | null = null;
  export let plugin: NovelReaderPlugin;
  export let chapters: TOCChapter[] = [];
  export let onChapterSelect: (chapter: TOCChapter) => void;

  let searchQuery = '';
  let expandedChapters = new Set<number | string>();

  // 初始化时展开所有一级章节
  $: if (chapters.length > 0) {
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
  }

  function hasSubChapters(chapter: TOCChapter): boolean {
    return !!(chapter.subChapters && chapter.subChapters.length > 0);
  }
</script>

<div class="book-toc-view-container">
  <!-- 头部 -->
  <header class="toc-header">
    <h2>{novel?.title || '图书目录'}</h2>
    <div class="toc-subtitle">
      共 {chapters.length} 个章节
    </div>
  </header>

  <!-- 搜索框 -->
  <div class="search-box">
    <input type="text" placeholder="搜索章节..." bind:value={searchQuery} class="search-input" />
  </div>

  <!-- 章节列表 -->
  <div class="chapter-list">
    {#each filteredChapters as chapter}
      <div class="chapter-group">
        <button
          class="chapter-item level-{chapter.level}"
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

<style>
  .book-toc-view-container {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    background: var(--background-primary);
    overflow: hidden;
  }

  .toc-header {
    padding: 24px;
    border-bottom: 2px solid var(--background-modifier-border);
    background: var(--background-secondary);
  }

  .toc-header h2 {
    margin: 0 0 8px 0;
    font-size: 24px;
    font-weight: 600;
    color: var(--text-normal);
  }

  .toc-subtitle {
    font-size: 14px;
    color: var(--text-muted);
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

  /* 层级样式 */
  .chapter-item.level-0 {
    font-weight: 600;
    font-size: 15px;
  }

  .chapter-item.level-1 {
    margin-left: 20px;
    font-weight: 500;
    font-size: 14px;
  }

  .chapter-item.level-2 {
    margin-left: 40px;
    font-weight: 400;
    font-size: 14px;
  }

  .chapter-item.level-3 {
    margin-left: 60px;
    font-weight: 400;
    font-size: 13px;
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
    font-size: inherit;
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

  .sub-chapters {
    margin-top: 4px;
  }

  .empty-state {
    text-align: center;
    color: var(--text-muted);
    padding: 32px;
  }
</style>
