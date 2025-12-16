<script lang="ts">
	import type { Shelf } from '../types/shelf';
	import { createEventDispatcher } from 'svelte';

	export let shelves: Shelf[] = [];
	export let currentShelfId: string = 'all';

	const dispatch = createEventDispatcher();

	function handleShelfChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		dispatch('shelfChange', { shelfId: select.value });
	}

	function handleManageShelves() {
		dispatch('manageShelves');
	}
</script>

<div class="shelf-toolbar">
	<div class="shelf-select-container">
		<select
			class="shelf-select"
			value={currentShelfId}
			on:change={handleShelfChange}
		>
			{#each shelves as shelf}
				<option value={shelf.id}>
					{shelf.name} {shelf.count ? `(${shelf.count})` : ''}
				</option>
			{/each}
		</select>
	</div>

	<button
		class="manage-shelves-button"
		on:click={handleManageShelves}
	>
		管理书架
	</button>
</div>

<style>
	.shelf-toolbar {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px;
		background: var(--background-secondary);
		border-radius: 10px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
	}

	.shelf-select-container {
		flex: 1;
	}

	.shelf-select {
		width: 100%;
		padding: 10px 14px;
		border-radius: 8px;
		border: 2px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		font-weight: 500;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.shelf-select:hover {
		border-color: var(--interactive-accent);
	}

	.shelf-select:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.15);
	}

	.manage-shelves-button {
		padding: 10px 18px;
		border-radius: 8px;
		border: 2px solid var(--interactive-accent);
		background: linear-gradient(135deg, transparent 0%, rgba(var(--interactive-accent-rgb), 0.1) 100%);
		color: var(--interactive-accent);
		font-weight: 600;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s ease;
		white-space: nowrap;
	}

	.manage-shelves-button:hover {
		background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
		color: var(--text-on-accent);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(var(--interactive-accent-rgb), 0.3);
	}
</style>
