<script lang="ts">
	import type { CustomShelf } from '../types/shelf';
	import { createEventDispatcher } from 'svelte';
	import {slide} from 'svelte/transition';
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
	<button
		class="menu-trigger"
		on:click={toggleMenu}
		class:active={isVisible}
	>
		≡
	</button>

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
					<button
						class="menu-item"
						on:click={() => handleViewChange(`shelf:${shelf.id}`)}
					>
						<span class="icon">{#if shelf.icon}{shelf.icon}{:else}{@html icons.shelf}{/if}</span>
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
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 24px;
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.menu-trigger:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.menu-trigger.active {
		background: var(--background-modifier-active);
		color: var(--text-accent);
	}

	.menu-panel {
		position: absolute;
		left: 0;
		top: 100%;
		width: 240px;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		z-index: 1000;
		padding: 4px;
		margin-top: 4px;
	}

	.menu-section {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.section-header {
		padding: 8px 12px;
		font-size: 12px;
		color: var(--text-muted);
		font-weight: 500;
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px 12px;
		background: none;
		border: none;
		color: var(--text-normal);
		cursor: pointer;
		border-radius: 4px;
		text-align: left;
		width: 100%;
		font-size: 14px;
		transition: all 0.2s;
	}

	.menu-item:hover {
		background: var(--background-modifier-hover);
	}

	.menu-item.active {
		background: var(--background-modifier-active);
		color: var(--text-accent);
	}

	.icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		opacity: 0.8;
	}

	.icon :global(svg) {
		width: 16px;
		height: 16px;
		stroke: currentColor;
	}

	.count {
		margin-left: auto;
		font-size: 12px;
		color: var(--text-muted);
	}

	.divider {
		height: 1px;
		background: var(--background-modifier-border);
		margin: 4px 0;
	}
</style>
