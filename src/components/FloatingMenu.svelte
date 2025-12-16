<script lang="ts">
  import type { CustomShelf } from '../types/shelf';
  import { createEventDispatcher } from 'svelte';
  import { slide } from 'svelte/transition';
  import { icons } from './library/icons';

  const dispatch = createEventDispatcher();

  export let isVisible = false;
  export let customShelves: CustomShelf[] = [];
  export let showFavorites = false;
  export let showNotes = false;

  function toggleMenu() {
    isVisible = !isVisible;
  }

  function handleViewChange(view: string) {
    dispatch('viewChange', { view });
    isVisible = false;
  }
</script>

<div class="floating-menu-container">
  <button class="menu-trigger" on:click={toggleMenu} class:active={isVisible}> ≡ </button>

  {#if isVisible}
    <div class="menu-panel" transition:slide>
      <div class="menu-section">
        <button
          class="menu-item"
          class:active={showFavorites}
          on:click={() => handleViewChange('favorites')}
        >
          <span class="icon">{@html icons.heart}</span>
          我的喜爱
        </button>

        <button
          class="menu-item"
          class:active={showNotes}
          on:click={() => handleViewChange('notes')}
        >
          <span class="icon">{@html icons.note}</span>
          我的笔记
        </button>
      </div>

      <div class="divider"></div>

      <div class="menu-section">
        <div class="section-header">收藏书架</div>
        {#each customShelves as shelf}
          <button class="menu-item" on:click={() => handleViewChange(`shelf:${shelf.id}`)}>
            <span class="icon"
              >{#if shelf.icon}{shelf.icon}{:else}{@html icons.shelf}{/if}</span
            >
            {shelf.name}
            <span class="count">({shelf.novels.length})</span>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .floating-menu-container {
    position: relative;
  }

  .menu-trigger {
    background: linear-gradient(135deg, var(--background-secondary) 0%, var(--background-primary) 100%);
    border: 2px solid transparent;
    color: var(--text-muted);
    font-size: 24px;
    cursor: pointer;
    padding: 6px 12px;
    border-radius: 8px;
    transition: all 0.2s ease;
    font-weight: bold;
  }

  .menu-trigger:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    border-color: var(--interactive-accent);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .menu-trigger.active {
    background: linear-gradient(135deg, var(--interactive-accent-hover) 0%, var(--interactive-accent) 100%);
    color: var(--text-on-accent);
    border-color: var(--interactive-accent);
    box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .menu-panel {
    position: absolute;
    left: 0;
    top: 100%;
    width: 260px;
    background: linear-gradient(135deg, var(--background-primary) 0%, var(--background-secondary) 100%);
    border: 2px solid var(--interactive-accent);
    border-radius: 12px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
    z-index: 1000;
    padding: 8px;
    margin-top: 8px;
    animation: slideDown 0.2s ease;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .menu-section {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .section-header {
    padding: 10px 14px;
    font-size: 12px;
    color: var(--text-muted);
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .menu-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 14px;
    background: none;
    border: none;
    border-left: 3px solid transparent;
    color: var(--text-normal);
    cursor: pointer;
    border-radius: 6px;
    text-align: left;
    width: 100%;
    font-size: 14px;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .menu-item:hover {
    background: var(--background-modifier-hover);
    border-left-color: var(--interactive-accent);
    color: var(--interactive-accent);
    transform: translateX(4px);
  }

  .menu-item.active {
    background: linear-gradient(90deg, rgba(var(--interactive-accent-rgb), 0.15) 0%, transparent 100%);
    border-left-color: var(--interactive-accent);
    color: var(--interactive-accent);
    font-weight: 600;
  }

  .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    transition: transform 0.2s ease;
  }

  .menu-item:hover .icon {
    transform: scale(1.1);
  }

  .icon :global(svg) {
    width: 18px;
    height: 18px;
    stroke: currentColor;
  }

  .count {
    margin-left: auto;
    font-size: 11px;
    font-weight: 600;
    color: var(--text-on-accent);
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    padding: 2px 8px;
    border-radius: 10px;
    box-shadow: 0 2px 4px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .divider {
    height: 2px;
    background: linear-gradient(90deg, transparent 0%, var(--background-modifier-border) 50%, transparent 100%);
    margin: 8px 0;
  }
</style>
