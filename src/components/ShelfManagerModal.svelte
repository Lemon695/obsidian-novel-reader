<script lang="ts">
	import {createEventDispatcher} from 'svelte';
	import type {Novel} from '../types';
	import type {Shelf} from '../types/shelf';

	const dispatch = createEventDispatcher();

	export let novel: Novel;
	export let shelves: Shelf[] = [];

	let selectedShelfId = novel.shelfId || '';

	function handleSave() {
		dispatch('save', {
			novelId: novel.id,
			shelfId: selectedShelfId
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
					<input
						type="radio"
						name="shelf"
						value={shelf.id}
						bind:group={selectedShelfId}
					/>
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
		border-radius: 8px;
		width: 100%;
		max-width: 400px;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		padding: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.modal-header h3 {
		margin: 0;
		font-size: 18px;
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		max-width: calc(100% - 40px);
	}

	.close-button {
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
		color: var(--text-muted);
	}

	.modal-content {
		padding: 16px;
		flex: 1;
		min-height: 200px;
		max-height: 400px;
		overflow-y: auto;
	}

	.shelves-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.shelf-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 8px;
		border-radius: 4px;
		cursor: pointer;
		background: var(--background-secondary);
	}

	.shelf-item:hover {
		background: var(--background-modifier-hover);
	}

	.modal-footer {
		padding: 16px;
		border-top: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: flex-end;
		gap: 8px;
	}

	.cancel-button,
	.save-button {
		padding: 6px 16px;
		border-radius: 4px;
		cursor: pointer;
	}

	.cancel-button {
		background: none;
		border: 1px solid var(--background-modifier-border);
	}

	.save-button {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border: none;
	}
</style>
