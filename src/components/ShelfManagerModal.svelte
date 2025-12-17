<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Novel } from '../types';
  import type { Shelf } from '../types/shelf';

  const dispatch = createEventDispatcher();

  export let novel: Novel;
  export let shelves: Shelf[] = [];

  let selectedShelfId = novel.shelfId || '';

  function handleSave() {
    dispatch('save', {
      novelId: novel.id,
      shelfId: selectedShelfId,
    });
  }
</script>

<div class="shelf-manager">
  <header class="modal-header">
    <h3>选择书架 - {novel.title}</h3>
    <button class="close-button" on:click={() => dispatch('close')}>×</button>
  </header>

  <div class="modal-content">
    <div class="shelves-list">
      {#each shelves as shelf}
        <label class="shelf-item">
          <input type="radio" name="shelf" value={shelf.id} bind:group={selectedShelfId} />
          <span class="shelf-name">{shelf.name}</span>
        </label>
      {/each}
    </div>
  </div>

  <footer class="modal-footer">
    <button class="cancel-button" on:click={() => dispatch('close')}>取消</button>
    <button class="save-button" on:click={handleSave}>保存</button>
  </footer>
</div>

<style>
  .shelf-manager {
    background: var(--background-primary);
    border-radius: var(--novel-radius-lg);
    width: 100%;
    max-width: 400px;
    display: flex;
    flex-direction: column;
    box-shadow: var(--novel-shadow-lg);
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
  }

  .modal-header {
    padding: var(--novel-spacing-md);
    background: var(--background-secondary);
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .modal-header h3 {
    margin: 0;
    font-size: var(--novel-font-size-lg);
    font-weight: 600;
    color: var(--text-normal);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: calc(100% - 40px);
  }

  .close-button {
    background: transparent;
    border: none;
    font-size: 24px;
    cursor: pointer;
    color: var(--text-muted);
    width: 32px;
    height: 32px;
    border-radius: var(--novel-radius-sm);
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all var(--novel-transition-base);
    flex-shrink: 0;
  }

  .close-button:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
  }

  .modal-content {
    padding: var(--novel-spacing-md);
    flex: 1;
    min-height: 200px;
    max-height: 400px;
    overflow-y: auto;
  }

  .shelves-list {
    display: flex;
    flex-direction: column;
    gap: var(--novel-spacing-sm);
  }

  .shelf-item {
    display: flex;
    align-items: center;
    gap: var(--novel-spacing-sm);
    padding: var(--novel-spacing-sm);
    border-radius: var(--novel-radius-sm);
    cursor: pointer;
    background: var(--background-secondary);
    border: 1px solid var(--background-modifier-border);
    transition: all var(--novel-transition-base);
  }

  .shelf-item:hover {
    background: var(--background-modifier-hover);
    border-color: var(--interactive-accent);
  }

  .shelf-item input[type='radio'] {
    cursor: pointer;
    width: 18px;
    height: 18px;
    accent-color: var(--interactive-accent);
  }

  .shelf-name {
    color: var(--text-normal);
    font-weight: 500;
    transition: color var(--novel-transition-base);
  }

  .shelf-item:hover .shelf-name {
    color: var(--interactive-accent);
  }

  .modal-footer {
    padding: var(--novel-spacing-md);
    background: var(--background-secondary);
    border-top: 1px solid var(--background-modifier-border);
    display: flex;
    justify-content: flex-end;
    gap: var(--novel-spacing-sm);
  }

  .cancel-button,
  .save-button {
    padding: var(--novel-spacing-xs) var(--novel-spacing-md);
    border-radius: var(--novel-radius-sm);
    cursor: pointer;
    font-weight: 500;
    font-size: var(--novel-font-size-base);
    transition: all var(--novel-transition-base);
  }

  .cancel-button {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    color: var(--text-normal);
  }

  .cancel-button:hover {
    background: var(--background-modifier-hover);
    border-color: var(--text-muted);
  }

  .save-button {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border: none;
  }

  .save-button:hover {
    background: var(--interactive-accent-hover);
  }
</style>
