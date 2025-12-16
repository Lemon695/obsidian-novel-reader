<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { ChapterHistory } from '../types/reading-stats';

  const dispatch = createEventDispatcher();

  export let history: ChapterHistory[] = [];
  export let isOpen = false;

  let searchQuery = '';

  $: filteredHistory = history.filter((record) =>
    record.chapterTitle.toLowerCase().includes(searchQuery.toLowerCase())
  );

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  }

  function handleJumpToChapter(record: ChapterHistory) {
    dispatch('jumpToChapter', {
      chapterId: record.chapterId,
      chapterTitle: record.chapterTitle,
    });
  }

  function handleDeleteRecord(timestamp: number) {
    dispatch('deleteRecord', { timestamp });
  }

  function handleClearHistory() {
    dispatch('clearHistory');
  }
</script>

<div class="history-panel" class:open={isOpen}>
  <div class="panel-header">
    <h3>阅读历史</h3>
    <button class="close-button" on:click={() => (isOpen = false)}>×</button>
  </div>

  <div class="search-box">
    <input type="text" bind:value={searchQuery} placeholder="搜索章节..." />
  </div>

  <div class="history-list">
    {#each filteredHistory as record}
      <div class="history-item">
        <div class="record-content">
          <div class="chapter-title">{record.chapterTitle}</div>
          <div class="record-time">{formatDate(record.timestamp)}</div>
        </div>
        <div class="record-actions">
          <button class="jump-button" on:click={() => handleJumpToChapter(record)}> 跳转 </button>
          <button class="delete-button" on:click={() => handleDeleteRecord(record.timestamp)}>
            ×
          </button>
        </div>
      </div>
    {/each}

    {#if filteredHistory.length === 0}
      <div class="empty-message">
        {searchQuery ? '没有找到匹配的记录' : '暂无阅读历史'}
      </div>
    {/if}
  </div>

  <div class="panel-footer">
    <button class="clear-button" on:click={handleClearHistory}> 清空历史记录 </button>
  </div>
</div>

<style>
  .history-panel {
    position: fixed;
    top: 0;
    right: -360px;
    width: 360px;
    height: 100vh;
    background: linear-gradient(135deg, var(--background-primary) 0%, var(--background-secondary) 100%);
    border-left: 3px solid var(--interactive-accent);
    display: flex;
    flex-direction: column;
    transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    z-index: 1000;
    box-shadow: -4px 0 24px rgba(0, 0, 0, 0.2);
  }

  .history-panel.open {
    transform: translateX(-360px);
  }

  .panel-header {
    padding: 20px;
    background: linear-gradient(135deg, var(--interactive-accent-hover) 0%, var(--interactive-accent) 100%);
    border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .panel-header h3 {
    margin: 0;
    font-size: 18px;
    font-weight: 600;
    color: var(--text-on-accent);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }

  .close-button {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-on-accent);
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: rotate(90deg);
  }

  .search-box {
    padding: 16px;
    background: var(--background-secondary);
    border-bottom: 2px solid var(--background-modifier-border);
  }

  .search-box input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    border: 2px solid var(--background-modifier-border);
    background: var(--background-primary);
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .search-box input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.15);
  }

  .history-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .history-item {
    padding: 12px;
    border-radius: 8px;
    margin-bottom: 10px;
    background: var(--background-secondary);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-left: 3px solid transparent;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }

  .history-item:hover {
    background: var(--background-primary-alt);
    border-left-color: var(--interactive-accent);
    transform: translateX(4px);
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  }

  .record-content {
    flex: 1;
    min-width: 0;
  }

  .chapter-title {
    font-weight: 600;
    margin-bottom: 6px;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .record-time {
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 500;
  }

  .record-actions {
    display: flex;
    gap: 8px;
    flex-shrink: 0;
  }

  .jump-button {
    padding: 6px 12px;
    border-radius: 6px;
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    color: var(--text-on-accent);
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 12px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 4px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .jump-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(var(--interactive-accent-rgb), 0.4);
  }

  .delete-button {
    padding: 6px 10px;
    border-radius: 6px;
    background: rgba(var(--text-error-rgb), 0.1);
    color: var(--text-error);
    border: none;
    cursor: pointer;
    font-size: 16px;
    font-weight: bold;
    transition: all 0.2s ease;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .delete-button:hover {
    background: var(--text-error);
    color: var(--text-on-accent);
    transform: rotate(90deg) scale(1.1);
  }

  .panel-footer {
    padding: 16px;
    background: var(--background-secondary);
    border-top: 2px solid var(--background-modifier-border);
    text-align: center;
  }

  .clear-button {
    padding: 10px 20px;
    border-radius: 8px;
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    color: white;
    border: none;
    cursor: pointer;
    font-weight: 600;
    font-size: 14px;
    transition: all 0.2s ease;
    box-shadow: 0 2px 8px rgba(231, 76, 60, 0.3);
  }

  .clear-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(231, 76, 60, 0.4);
  }

  .empty-message {
    text-align: center;
    color: var(--text-muted);
    padding: 32px 16px;
    font-size: 14px;
    font-weight: 500;
  }
</style>
