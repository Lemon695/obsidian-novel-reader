<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import BookmarkPanel from '../BookmarkPanel.svelte';
  import type NovelReaderPlugin from '../../main';
  import type { Bookmark } from '../../types/bookmark';

  export let plugin: NovelReaderPlugin;
  export let novelId: string;
  export let currentChapterId: number = 0;
  export let show: boolean = false;

  const dispatch = createEventDispatcher();

  function handleClose() {
    dispatch('close');
  }

  function handleJump(event: CustomEvent<Bookmark>) {
    dispatch('jump', event.detail);
  }
</script>

{#if show}
  <div class="bookmark-panel-overlay" on:click={handleClose}>
    <div class="bookmark-panel-container" on:click|stopPropagation>
      <BookmarkPanel
        {plugin}
        {novelId}
        {currentChapterId}
        on:jump={handleJump}
        on:close={handleClose}
      />
    </div>
  </div>
{/if}

<style>
  .bookmark-panel-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    backdrop-filter: blur(4px);
  }

  .bookmark-panel-container {
    width: 90%;
    max-width: 600px;
    height: 80vh;
    background: var(--background-primary);
    border-radius: var(--radius-l);
    overflow: hidden;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  }

  /* 移动端适配 */
  @media (max-width: 768px) {
    .bookmark-panel-container {
      width: 100%;
      height: 100%;
      max-width: none;
      border-radius: 0;
    }
  }
</style>
