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
		background: linear-gradient(135deg, var(--background-primary) 0%, var(--background-secondary) 100%);
		border-radius: var(--radius-xl);
		width: 100%;
		max-width: 400px;
		display: flex;
		flex-direction: column;
		box-shadow: 0 24px 80px rgba(0, 0, 0, 0.4);
		border: 2px solid var(--interactive-accent);
		overflow: hidden;
		animation: modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	@keyframes modalSlideIn {
		from {
			opacity: 0;
			transform: scale(0.9) translateY(20px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.modal-header {
		padding: 20px;
		background: linear-gradient(135deg, var(--interactive-accent-hover) 0%, var(--interactive-accent) 100%);
		display: flex;
		justify-content: space-between;
		align-items: center;
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.modal-header h3 {
		margin: 0;
		font-size: 18px;
		font-weight: 600;
		color: var(--text-on-accent);
		overflow: hidden;
		text-overflow: ellipsis;
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		max-width: calc(100% - 40px);
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
	}

	.close-button {
		background: rgba(255, 255, 255, 0.1);
		border: 2px solid rgba(255, 255, 255, 0.2);
		font-size: 24px;
		cursor: pointer;
		color: var(--text-on-accent);
		width: 36px;
		height: 36px;
		border-radius: 50%;
		display: flex;
		align-items: center;
		justify-content: center;
		transition: all 0.2s ease;
		flex-shrink: 0;
		backdrop-filter: blur(8px);
	}

	.close-button:hover {
		background: rgba(255, 255, 255, 0.2);
		border-color: rgba(255, 255, 255, 0.4);
		transform: rotate(90deg) scale(1.1);
	}

	.modal-content {
		padding: 20px;
		flex: 1;
		min-height: 200px;
		max-height: 400px;
		overflow-y: auto;
	}

	.shelves-list {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.shelf-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 14px;
		border-radius: 8px;
		cursor: pointer;
		background: var(--background-secondary);
		border-left: 3px solid transparent;
		transition: all 0.2s ease;
	}

	.shelf-item:hover {
		background: var(--background-primary-alt);
		border-left-color: var(--interactive-accent);
		transform: translateX(4px);
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
		transition: color 0.2s ease;
	}

	.shelf-item:hover .shelf-name {
		color: var(--interactive-accent);
	}

	.modal-footer {
		padding: 16px 20px;
		background: var(--background-secondary);
		border-top: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: flex-end;
		gap: 12px;
	}

	.cancel-button,
	.save-button {
		padding: 8px 20px;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: all 0.2s ease;
	}

	.cancel-button {
		background: var(--background-primary);
		border: 2px solid var(--background-modifier-border);
		color: var(--text-normal);
	}

	.cancel-button:hover {
		background: var(--background-primary-alt);
		border-color: var(--text-muted);
		transform: translateY(-1px);
	}

	.save-button {
		background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
		color: var(--text-on-accent);
		border: none;
		box-shadow: 0 2px 8px rgba(var(--interactive-accent-rgb), 0.3);
	}

	.save-button:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 16px rgba(var(--interactive-accent-rgb), 0.4);
	}
</style>
