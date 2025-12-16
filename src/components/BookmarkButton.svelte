<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { BookmarkColor } from '../types/bookmark';
  import { BOOKMARK_COLORS } from '../types/bookmark';

  export let hasBookmark = false;
  export let bookmarkColor: BookmarkColor = 'gray';

  const dispatch = createEventDispatcher();

  let showColorPicker = false;

  function handleClick() {
    if (hasBookmark) {
      dispatch('remove');
    } else {
      showColorPicker = true;
    }
  }

  function handleColorSelect(color: BookmarkColor) {
    showColorPicker = false;
    dispatch('add', { color });
  }

  function handleClickOutside(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.bookmark-button-container')) {
      showColorPicker = false;
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

<div class="bookmark-button-container">
  <button 
    class="bookmark-btn"
    class:active={hasBookmark}
    on:click|stopPropagation={handleClick}
    title={hasBookmark ? '移除书签' : '添加书签'}
  >
    {#if hasBookmark}
      <span style="color: {BOOKMARK_COLORS.find(c => c.value === bookmarkColor)?.color}">
        📌
      </span>
    {:else}
      📍
    {/if}
  </button>

  {#if showColorPicker}
    <div class="color-picker" on:click|stopPropagation>
      <div class="picker-header">
        <span>选择颜色</span>
        <button class="close-btn" on:click={() => showColorPicker = false}>
          ✕
        </button>
      </div>
      <div class="color-grid">
        {#each BOOKMARK_COLORS as color}
          <button
            class="color-option"
            style="background: {color.color}"
            title={color.label}
            on:click={() => handleColorSelect(color.value)}
          >
            <span class="color-emoji">{color.emoji}</span>
            <span class="color-label">{color.label}</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .bookmark-button-container {
    position: relative;
  }

  .bookmark-btn {
    background: rgba(255, 255, 255, 0.1);
    border: 2px solid rgba(255, 255, 255, 0.2);
    color: var(--text-on-accent);
    padding: var(--size-4-2);
    border-radius: var(--radius-m);
    cursor: pointer;
    font-size: 20px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    backdrop-filter: blur(8px);
  }

  .bookmark-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    transform: scale(1.1);
  }

  .bookmark-btn.active {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    box-shadow: 0 0 0 3px rgba(255, 255, 255, 0.1);
  }

  .color-picker {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    background: linear-gradient(135deg, var(--background-primary) 0%, var(--background-secondary) 100%);
    border: 2px solid var(--interactive-accent);
    border-radius: var(--radius-l);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    z-index: 1000;
    min-width: 240px;
    animation: slideDown 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    overflow: hidden;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px) scale(0.95);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  .picker-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--size-4-3) var(--size-4-4);
    background: linear-gradient(135deg, var(--interactive-accent-hover) 0%, var(--interactive-accent) 100%);
    color: var(--text-on-accent);
    font-weight: 600;
    font-size: var(--font-ui-small);
  }

  .close-btn {
    background: rgba(255, 255, 255, 0.1);
    border: none;
    color: var(--text-on-accent);
    cursor: pointer;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 14px;
    transition: all 0.2s ease;
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    transform: scale(1.1);
  }

  .color-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--size-4-2);
    padding: var(--size-4-3);
  }

  .color-option {
    padding: var(--size-4-3);
    border: 2px solid transparent;
    border-radius: var(--radius-m);
    cursor: pointer;
    transition: all 0.2s ease;
    color: white;
    font-weight: 600;
    font-size: var(--font-ui-smaller);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  }

  .color-option:hover {
    transform: scale(1.05);
    border-color: white;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }

  .color-emoji {
    font-size: 18px;
  }

  .color-label {
    flex: 1;
  }

  /* 移动端适配 */
  @media (max-width: 768px) {
    .color-picker {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      top: auto;
      border-radius: var(--radius-l) var(--radius-l) 0 0;
      min-width: auto;
    }

    .color-grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }
</style>
