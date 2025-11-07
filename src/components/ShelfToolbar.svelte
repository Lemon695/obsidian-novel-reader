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
		gap: 8px;
		padding: 8px;
	}

	.shelf-select-container {
		flex: 1;
	}

	.shelf-select {
		width: 100%;
		padding: 6px 12px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
	}

	.manage-shelves-button {
		padding: 6px 12px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
	}

	.manage-shelves-button:hover {
		background: var(--background-modifier-hover);
	}
</style>
