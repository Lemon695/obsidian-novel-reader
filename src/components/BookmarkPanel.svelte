<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { Bookmark, BookmarkColor } from '../types/bookmark';
  import { BOOKMARK_COLORS } from '../types/bookmark';
  import type NovelReaderPlugin from '../main';
  import { icons } from './library/icons';
  import { Notice } from 'obsidian';

  export let plugin: NovelReaderPlugin;
  export let novelId: string;
  export let currentChapterId: number = 0;

  const dispatch = createEventDispatcher();

  let bookmarks: Bookmark[] = [];
  let filteredBookmarks: Bookmark[] = [];
  let searchQuery = '';
  let selectedColor: BookmarkColor | 'all' = 'all';
  let sortBy: 'created' | 'accessed' | 'chapter' = 'created';
  let showStats = false;

  onMount(async () => {
    await loadBookmarks();
  });

  async function loadBookmarks() {
    bookmarks = plugin.bookmarkService.getBookmarks(novelId);
    filterAndSortBookmarks();
  }

  function filterAndSortBookmarks() {
    let result = [...bookmarks];

    // 搜索过滤
    if (searchQuery) {
      result = plugin.bookmarkService.searchBookmarks(novelId, searchQuery);
    }

    // 颜色过滤
    if (selectedColor !== 'all') {
      result = result.filter(b => b.color === selectedColor);
    }

    // 排序
    switch (sortBy) {
      case 'created':
        result.sort((a, b) => b.createdAt - a.createdAt);
        break;
      case 'accessed':
        result.sort((a, b) => (b.accessCount || 0) - (a.accessCount || 0));
        break;
      case 'chapter':
        result.sort((a, b) => a.chapterId - b.chapterId || a.position - b.position);
        break;
    }

    filteredBookmarks = result;
  }

  function handleJump(bookmark: Bookmark) {
    dispatch('jump', bookmark);
    plugin.bookmarkService.jumpToBookmark(bookmark);
  }

  async function handleDelete(bookmarkId: string) {
    if (confirm('确定要删除这个书签吗？')) {
      await plugin.bookmarkService.removeBookmark(novelId, bookmarkId);
      await loadBookmarks();
      new Notice('🗑️ 书签已删除');
    }
  }

  async function handleExport() {
    const markdown = await plugin.bookmarkService.exportToMarkdown(novelId);
    const fileName = `书签-${Date.now()}.md`;
    await plugin.app.vault.create(fileName, markdown);
    new Notice(`书签已导出到 ${fileName}`);
  }

  function getStats() {
    return plugin.bookmarkService.getStats(novelId);
  }

  $: {
    searchQuery;
    selectedColor;
    sortBy;
    filterAndSortBookmarks();
  }
</script>

<div class="bookmark-panel">
  <!-- 头部工具栏 -->
  <div class="panel-header">
    <h3>📑 书签</h3>
    <div class="header-actions">
      <button 
        class="icon-btn stats-btn" 
        on:click={() => {
          if (bookmarks.length === 0) {
            new Notice('暂无书签数据');
            return;
          }
          showStats = !showStats;
        }} 
        title="统计"
      >
        {@html icons.barChart}
      </button>
      <button 
        class="icon-btn export-btn" 
        on:click={() => {
          if (bookmarks.length === 0) {
            new Notice('暂无书签可导出');
            return;
          }
          handleExport();
        }} 
        title="导出"
      >
        {@html icons.download}
      </button>
      <button 
        class="icon-btn close-btn" 
        on:click|stopPropagation={(e) => {
          console.log('🔴 关闭按钮被点击！', e);
          dispatch('close');
        }} 
        title="关闭"
        style="opacity: 1 !important; cursor: pointer !important; pointer-events: auto !important; z-index: 9999 !important; position: relative;"
      >
        {@html icons.x}
      </button>
    </div>
  </div>

  <!-- 统计信息 -->
  {#if showStats}
    {@const stats = getStats()}
    <div class="stats-section">
      <div class="stat-item">
        <span class="stat-label">总数</span>
        <span class="stat-value">{stats.total}</span>
      </div>
      {#each BOOKMARK_COLORS as color}
        <div class="stat-item">
          <span class="color-dot" style="background: {color.color}"></span>
          <span class="stat-label">{color.label}</span>
          <span class="stat-value">{stats.byColor[color.value]}</span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- 搜索和筛选 -->
  <div class="filter-section">
    <input
      type="text"
      class="search-input"
      placeholder="搜索书签..."
      bind:value={searchQuery}
    />
    
    <div class="filter-row">
      <select class="filter-select" bind:value={selectedColor}>
        <option value="all">所有颜色</option>
        {#each BOOKMARK_COLORS as color}
          <option value={color.value}>{color.emoji} {color.label}</option>
        {/each}
      </select>

      <select class="filter-select" bind:value={sortBy}>
        <option value="created">创建时间</option>
        <option value="accessed">访问次数</option>
        <option value="chapter">章节顺序</option>
      </select>
    </div>
  </div>

  <!-- 书签列表 -->
  <div class="bookmarks-list">
    {#if filteredBookmarks.length === 0}
      <div class="empty-state">
        <div class="empty-icon">📑</div>
        <p>暂无书签</p>
        <p class="empty-hint">在阅读时点击书签按钮添加</p>
      </div>
    {:else}
      {#each filteredBookmarks as bookmark (bookmark.id)}
        <div 
          class="bookmark-item"
          class:current={bookmark.chapterId === currentChapterId}
          style="border-left-color: {BOOKMARK_COLORS.find(c => c.value === bookmark.color)?.color}"
        >
          <!-- 书签头部 -->
          <div class="bookmark-header">
            <span class="chapter-title">{bookmark.chapterTitle}</span>
            <div class="bookmark-actions">
              <button 
                class="action-btn jump-btn" 
                on:click={() => handleJump(bookmark)}
                title="跳转"
              >
                {@html icons.zap}
              </button>
              <button 
                class="action-btn delete-btn" 
                on:click={() => handleDelete(bookmark.id)}
                title="删除"
              >
                {@html icons.trash}
              </button>
            </div>
          </div>

          <!-- 选中文本 -->
          {#if bookmark.selectedText}
            <div class="selected-text">
              "{bookmark.selectedText}"
            </div>
          {/if}

          <!-- 备注 -->
          {#if bookmark.note}
            <div class="bookmark-note">
              💭 {bookmark.note}
            </div>
          {/if}

          <!-- 标签 -->
          {#if bookmark.tags && bookmark.tags.length > 0}
            <div class="bookmark-tags">
              {#each bookmark.tags as tag}
                <span class="tag">#{tag}</span>
              {/each}
            </div>
          {/if}

          <!-- 元信息 -->
          <div class="bookmark-meta">
            <span class="meta-item">
              🕐 {new Date(bookmark.createdAt).toLocaleDateString()}
            </span>
            {#if bookmark.accessCount && bookmark.accessCount > 0}
              <span class="meta-item">
                👁️ {bookmark.accessCount}
              </span>
            {/if}
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .bookmark-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: linear-gradient(135deg, var(--background-primary) 0%, var(--background-secondary) 100%);
    border-radius: var(--radius-l);
    overflow: hidden;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
  }

  .panel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--size-4-4) var(--size-4-6);
    background: linear-gradient(135deg, var(--interactive-accent-hover) 0%, var(--interactive-accent) 100%);
    border-bottom: 2px solid rgba(255, 255, 255, 0.1);
  }

  .panel-header h3 {
    margin: 0;
    color: var(--text-on-accent);
    font-size: var(--font-ui-medium);
    font-weight: 600;
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .header-actions {
    display: flex;
    gap: var(--size-4-2);
  }

  .icon-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    color: var(--text-on-accent);
    padding: var(--size-4-2);
    border-radius: var(--radius-m);
    cursor: pointer;
    font-size: 16px;
    transition: all 0.2s ease;
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .icon-btn :global(svg) {
    width: 16px;
    height: 16px;
    stroke: currentColor;
  }

  .icon-btn:hover:not(:disabled) {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    transform: scale(1.1);
  }

  /* 统计和导出按钮 - 无书签时半透明 */
  .icon-btn.stats-btn,
  .icon-btn.export-btn {
    opacity: 0.4;
  }

  /* 关闭按钮 - 始终完全可用 */
  .icon-btn.close-btn {
    opacity: 1 !important;
    cursor: pointer !important;
    pointer-events: auto !important;
    z-index: 9999 !important;
  }

  .icon-btn.close-btn:hover {
    background: rgba(255, 255, 255, 0.2) !important;
    border-color: rgba(255, 255, 255, 0.4) !important;
    transform: scale(1.1) !important;
  }

  .stats-section {
    padding: var(--size-4-4);
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
    gap: var(--size-4-3);
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    padding: var(--size-4-2);
    background: var(--background-primary);
    border-radius: var(--radius-s);
  }

  .color-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
  }

  .stat-label {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .stat-value {
    margin-left: auto;
    font-weight: 600;
    color: var(--text-normal);
  }

  .filter-section {
    padding: var(--size-4-4);
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .search-input {
    width: 100%;
    padding: var(--size-4-3);
    border: 2px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-primary);
    color: var(--text-normal);
    margin-bottom: var(--size-4-3);
    transition: all 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.1);
  }

  .filter-row {
    display: flex;
    gap: var(--size-4-3);
  }

  .filter-select {
    flex: 1;
    padding: var(--size-4-2) var(--size-4-3);
    border: 2px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    background: var(--background-primary);
    color: var(--text-normal);
    transition: all 0.2s ease;
  }

  .filter-select:focus {
    outline: none;
    border-color: var(--interactive-accent);
  }

  .bookmarks-list {
    flex: 1;
    overflow-y: auto;
    padding: var(--size-4-4);
  }

  .empty-state {
    text-align: center;
    padding: var(--size-4-12);
    color: var(--text-muted);
  }

  .empty-icon {
    font-size: 48px;
    margin-bottom: var(--size-4-4);
    opacity: 0.5;
  }

  .empty-hint {
    font-size: var(--font-ui-smaller);
  }

  .bookmark-item {
    background: var(--background-secondary);
    border-radius: var(--radius-m);
    padding: var(--size-4-4);
    margin-bottom: var(--size-4-3);
    border-left: 4px solid var(--interactive-accent);
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .bookmark-item:hover {
    transform: translateX(4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .bookmark-item.current {
    background: linear-gradient(90deg, rgba(var(--interactive-accent-rgb), 0.1) 0%, transparent 100%);
    box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb), 0.2);
  }

  .bookmark-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--size-4-2);
  }

  .chapter-title {
    font-weight: 600;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
  }

  .bookmark-actions {
    display: flex;
    gap: var(--size-4-2);
  }

  .action-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: var(--size-4-1);
    opacity: 0.6;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .action-btn :global(svg) {
    width: 14px;
    height: 14px;
    stroke: currentColor;
  }

  .action-btn:hover {
    opacity: 1;
    transform: scale(1.2);
  }

  .action-btn.jump-btn:hover {
    color: var(--interactive-accent);
  }

  .action-btn.delete-btn:hover {
    color: #ff3b30;
  }

  .selected-text {
    padding: var(--size-4-3);
    background: rgba(var(--interactive-accent-rgb), 0.1);
    border-radius: var(--radius-s);
    font-style: italic;
    color: var(--text-muted);
    margin-bottom: var(--size-4-2);
    font-size: var(--font-ui-smaller);
    border-left: 3px solid rgba(var(--interactive-accent-rgb), 0.3);
  }

  .bookmark-note {
    padding: var(--size-4-2);
    color: var(--text-normal);
    font-size: var(--font-ui-smaller);
    margin-bottom: var(--size-4-2);
  }

  .bookmark-tags {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-4-2);
    margin-bottom: var(--size-4-2);
  }

  .tag {
    padding: 2px 8px;
    background: var(--background-primary);
    border-radius: 12px;
    font-size: var(--font-ui-smaller);
    color: var(--interactive-accent);
    border: 1px solid rgba(var(--interactive-accent-rgb), 0.2);
  }

  .bookmark-meta {
    display: flex;
    gap: var(--size-4-3);
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .meta-item {
    display: flex;
    align-items: center;
    gap: var(--size-4-1);
  }

  /* 移动端适配 */
  @media (max-width: 768px) {
    .bookmark-panel {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 1000;
      border-radius: 0;
    }

    .stats-section {
      grid-template-columns: repeat(2, 1fr);
    }

    .filter-row {
      flex-direction: column;
    }
  }
</style>
