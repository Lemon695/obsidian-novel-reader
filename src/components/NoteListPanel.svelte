<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { fade } from 'svelte/transition';
  import type { Note } from '../types/notes';

  const dispatch = createEventDispatcher();

  export let isOpen = false;
  export let notes: Note[] = [];
  export let currentChapterId: number | string = 0;

  let searchQuery = '';

  // 计算过滤后的笔记列表
  $: filteredNotes = notes
    .filter(
      (note) =>
        note.chapterId === currentChapterId &&
        (searchQuery === '' ||
          note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
          note.selectedText.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      // 首先按行号排序
      if (a.lineNumber !== b.lineNumber) {
        return a.lineNumber - b.lineNumber;
      }
      // 然后按时间倒序
      return b.timestamp - a.timestamp;
    });

  // 格式化日期
  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 30) return `${diffDays} 天前`;

    return date.toLocaleString();
  }

  // 处理删除笔记
  async function handleDeleteNote(note: Note) {
    const confirmed = confirm('确定要删除这条笔记吗？');
    if (confirmed) {
      dispatch('deleteNote', { noteId: note.id });
    }
  }

  // 处理编辑笔记
  function handleEditNote(note: Note) {
    dispatch('editNote', { note });
  }

  // 跳转到原文位置
  function handleJumpToNote(note: Note) {
    dispatch('jumpToNote', { note });
  }
</script>

<div class="note-list-panel" class:open={isOpen}>
  <div class="panel-header">
    <h3>笔记列表</h3>
    <button class="close-button" on:click={() => dispatch('close')}>×</button>
  </div>

  <div class="search-box">
    <input
      type="text"
      bind:value={searchQuery}
      placeholder="搜索笔记内容..."
      class="search-input"
    />
  </div>

  <div class="notes-list">
    {#if filteredNotes.length === 0}
      <div class="empty-message">
        {searchQuery ? '没有找到匹配的笔记' : '当前章节暂无笔记'}
      </div>
    {:else}
      {#each filteredNotes as note (note.id)}
        <div class="note-item" transition:fade>
          <div class="selected-text">
            {note.selectedText}
          </div>
          <div class="note-content">
            {note.content}
          </div>
          <div class="note-info">
            <span class="note-time">{formatDate(note.timestamp)}</span>
            <div class="note-actions">
              <button
                class="edit-button"
                on:click={() => handleJumpToNote(note)}
                title="跳转到原文"
              >
                跳转
              </button>
              <button class="edit-button" on:click={() => handleEditNote(note)} title="编辑笔记">
                编辑
              </button>
              <button
                class="delete-button"
                on:click={() => handleDeleteNote(note)}
                title="删除笔记"
              >
                删除
              </button>
            </div>
          </div>
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .note-list-panel {
    position: fixed;
    top: 0;
    right: 0;
    width: 360px;
    height: 100vh;
    background: var(--background-primary);
    border-left: 1px solid var(--background-modifier-border);
    box-shadow: var(--novel-shadow-lg);
    display: flex;
    flex-direction: column;
    z-index: 1000;
    animation: slideInRight 0.3s ease;
  }

  @keyframes slideInRight {
    from {
      transform: translateX(100%);
    }
    to {
      transform: translateX(0);
    }
  }

  .panel-header {
    padding: var(--novel-spacing-lg);
    background: var(--background-secondary);
    border-bottom: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .panel-header h3 {
    margin: 0;
    font-size: var(--novel-font-size-lg);
    font-weight: var(--novel-font-weight-semibold);
    color: var(--text-normal);
  }

  .close-button {
    background: var(--background-modifier-hover);
    border: 1px solid var(--background-modifier-border);
    font-size: 24px;
    color: var(--text-normal);
    cursor: pointer;
    padding: 4px;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: var(--background-modifier-active);
    border-color: var(--interactive-accent);
    transform: rotate(90deg);
  }

  .search-box {
    padding: 16px;
    background: var(--background-secondary);
    border-bottom: 2px solid var(--background-modifier-border);
  }

  .search-input {
    width: 100%;
    padding: 10px 14px;
    border-radius: 8px;
    border: 2px solid var(--background-modifier-border);
    background: var(--background-primary);
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.15);
  }

  .notes-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .note-item {
    background: var(--background-secondary);
    border-radius: 10px;
    padding: 14px;
    margin-bottom: 12px;
    border-left: 3px solid var(--interactive-accent);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    transition: all 0.2s ease;
  }

  .note-item:hover {
    transform: translateX(-4px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
  }

  .selected-text {
    font-style: italic;
    color: var(--text-muted);
    background: rgba(var(--interactive-accent-rgb), 0.08);
    padding: var(--novel-spacing-sm) var(--novel-spacing-md);
    border-radius: 6px;
    margin-bottom: 10px;
    font-size: 13px;
    line-height: 1.5;
    border-left: 2px solid var(--interactive-accent);
  }

  .note-content {
    color: var(--text-normal);
    line-height: 1.6;
    margin-bottom: 10px;
    font-size: 14px;
    font-weight: 500;
  }

  .note-info {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 12px;
    color: var(--text-muted);
    padding-top: 8px;
    border-top: 1px solid var(--background-modifier-border);
  }

  .note-time {
    font-weight: 600;
  }

  .note-actions {
    display: flex;
    gap: 8px;
  }

  .edit-button,
  .delete-button {
    padding: 6px 12px;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    font-size: 12px;
    font-weight: 600;
    transition: all 0.2s ease;
  }

  .edit-button {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    box-shadow: 0 2px 4px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .edit-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(var(--interactive-accent-rgb), 0.4);
  }

  .delete-button {
    background: var(--text-error);
    color: white;
    box-shadow: 0 2px 4px rgba(231, 76, 60, 0.3);
  }

  .delete-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(231, 76, 60, 0.4);
  }

  .empty-message {
    text-align: center;
    color: var(--text-muted);
    padding: 32px 20px;
    font-size: 14px;
    font-weight: 500;
  }
</style>
