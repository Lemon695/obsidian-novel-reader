<script lang="ts">
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';

  import type { PDFOutline } from '../../types';
  export let outlines: PDFOutline[] = [];
  export let currentPage: number = 1;
  export let onPageSelect: (pageNum: number) => void;

  let searchQuery = '';
  let filteredOutlines = outlines;

  $: {
    filteredOutlines = outlines.filter((outline) =>
      outline.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }

  // 处理大纲项点击
  function handleOutlineClick(outline: PDFOutline) {
    if (outline.dest) {
      // 通常dest数组的第一个元素是页码引用
      const pageRef = outline.dest[0];
      if (typeof pageRef === 'object' && pageRef.num !== undefined) {
        onPageSelect(pageRef.num);
      }
    }
  }

  onMount(() => {
    console.log('PDF Outline component mounted with', outlines.length, 'items');
  });
</script>

<div class="outline-container">
  <div class="search-box">
    <input type="text" bind:value={searchQuery} placeholder="搜索大纲..." class="search-input" />
  </div>

  <div class="outlines-list">
    {#each filteredOutlines as outline}
      <div
        class="outline-item"
        class:active={outline.dest?.[0]?.num === currentPage}
        on:click={() => handleOutlineClick(outline)}
      >
        <span class="outline-title">{outline.title}</span>
      </div>
    {/each}

    {#if filteredOutlines.length === 0}
      <div class="empty-message">
        {searchQuery ? '没有找到匹配的内容' : '无大纲内容'}
      </div>
    {/if}
  </div>
</div>

<style>
  .outline-container {
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .search-box {
    padding: 12px;
    border-bottom: 1px solid var(--background-modifier-border);
  }

  .search-input {
    width: 100%;
    padding: 8px;
    border-radius: 4px;
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
  }

  .outlines-list {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
  }

  .outline-item {
    padding: 8px 12px;
    margin-bottom: 4px;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .outline-item:hover {
    background: var(--background-modifier-hover);
  }

  .outline-item.active {
    background: var(--background-modifier-active);
    color: var(--text-accent);
  }

  .outline-title {
    font-size: 14px;
  }

  .empty-message {
    text-align: center;
    color: var(--text-muted);
    padding: 20px;
  }
</style>
