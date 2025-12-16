<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Note } from '../types/notes';
  import { fade } from 'svelte/transition';

  const dispatch = createEventDispatcher();

  export let note: Note;
  export let position: { x: number; y: number };
  export let visible = false;

  function handleClose() {
    dispatch('close');
  }

  function handleDelete() {
    dispatch('delete', { noteId: note.id });
  }

  function handleEdit() {
    dispatch('edit', { note });
  }

  // 格式化日期显示
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
</script>

{#if visible}
  <div
    class="note-viewer"
    style="left: {position.x}px; top: {position.y}px;"
    transition:fade={{ duration: 150 }}
  >
    <div class="note-viewer-header">
      <div class="note-info">
        <span class="note-date">{formatDate(note.timestamp)}</span>
      </div>
      <button class="close-button" on:click={handleClose} title="关闭">×</button>
    </div>

    <div class="note-viewer-content">
      <div class="selected-text">
        {note.selectedText}
      </div>
      <div class="note-content">
        {note.content}
      </div>
    </div>

    <div class="note-viewer-actions">
      <button class="edit-button" on:click={handleEdit} title="编辑笔记"> 编辑 </button>
      <button class="delete-button" on:click={handleDelete} title="删除笔记"> 删除 </button>
    </div>
  </div>
{/if}

<style>
  .note-viewer {
    position: fixed;
    background: linear-gradient(135deg, var(--background-primary) 0%, var(--background-secondary) 100%);
    border: 2px solid var(--interactive-accent);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
    padding: 18px;
    min-width: 320px;
    max-width: 420px;
    transform: translate(-50%, -100%) translateY(-12px);
    z-index: 1000;
    animation: popIn 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }

  @keyframes popIn {
    from {
      opacity: 0;
      transform: translate(-50%, -100%) translateY(-20px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translate(-50%, -100%) translateY(-12px) scale(1);
    }
  }

  .note-viewer::after {
    content: '';
    position: absolute;
    bottom: -10px;
    left: 50%;
    transform: translateX(-50%);
    width: 0;
    height: 0;
    border-left: 10px solid transparent;
    border-right: 10px solid transparent;
    border-top: 10px solid var(--interactive-accent);
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.2));
  }

  .note-viewer-header {
    margin-bottom: 14px;
    padding-bottom: 10px;
    border-bottom: 2px solid var(--background-modifier-border);
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .note-date {
    font-size: 12px;
    font-weight: 600;
    color: var(--text-muted);
    background: rgba(var(--interactive-accent-rgb), 0.1);
    padding: 4px 10px;
    border-radius: 12px;
  }

  .note-viewer-content {
    margin-bottom: 16px;
  }

  .selected-text {
    font-size: 14px;
    font-style: italic;
    color: var(--text-muted);
    background: linear-gradient(135deg, rgba(var(--interactive-accent-rgb), 0.1) 0%, rgba(var(--interactive-accent-rgb), 0.05) 100%);
    padding: 12px 14px;
    border-radius: 8px;
    margin-bottom: 14px;
    line-height: 1.6;
    position: relative;
    border-left: 3px solid var(--interactive-accent);
  }

  .selected-text::before {
    content: '"';
    position: absolute;
    left: 8px;
    top: -2px;
    font-size: 28px;
    color: var(--interactive-accent);
    opacity: 0.3;
    font-weight: bold;
  }

  .note-content {
    color: var(--text-normal);
    line-height: 1.6;
    font-size: 14px;
    font-weight: 500;
    padding: 0 4px;
  }

  .note-viewer-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    padding-top: 14px;
    border-top: 2px solid var(--background-modifier-border);
  }

  button {
    padding: 8px 16px;
    border-radius: 8px;
    border: none;
    cursor: pointer;
    font-size: 13px;
    font-weight: 600;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .edit-button {
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    color: var(--text-on-accent);
    box-shadow: 0 2px 6px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .edit-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(var(--interactive-accent-rgb), 0.4);
  }

  .delete-button {
    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
    color: white;
    box-shadow: 0 2px 6px rgba(231, 76, 60, 0.3);
  }

  .delete-button:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(231, 76, 60, 0.4);
  }

  .close-button {
    background: rgba(var(--text-error-rgb), 0.1);
    border: none;
    font-size: 20px;
    color: var(--text-error);
    cursor: pointer;
    padding: 4px;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    line-height: 1;
    transition: all 0.2s ease;
  }

  .close-button:hover {
    background: var(--text-error);
    color: var(--text-on-accent);
    transform: rotate(90deg) scale(1.1);
  }
</style>
