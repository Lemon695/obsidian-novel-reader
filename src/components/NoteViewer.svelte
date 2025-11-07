<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { Note } from '../types/notes';
	import {fade} from 'svelte/transition';

	const dispatch = createEventDispatcher();

	export let note: Note;
	export let position: { x: number; y: number };
	export let visible = false;

	function handleClose() {
		dispatch('close');
	}

	function handleDelete() {
		dispatch('delete', { noteId: note.id });
	}

	function handleEdit() {
		dispatch('edit', { note });
	}

	// 格式化日期显示
	function formatDate(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffMs = now.getTime() - date.getTime();
		const diffMins = Math.floor(diffMs / (1000 * 60));
		const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
		const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

		if (diffMins < 60) return `${diffMins} 分钟前`;
		if (diffHours < 24) return `${diffHours} 小时前`;
		if (diffDays < 30) return `${diffDays} 天前`;

		return date.toLocaleString();
	}
</script>

{#if visible}
	<div
		class="note-viewer"
		style="left: {position.x}px; top: {position.y}px;"
		transition:fade={{duration: 150}}
	>
		<div class="note-viewer-header">
			<div class="note-info">
				<span class="note-date">{formatDate(note.timestamp)}</span>
			</div>
			<button class="close-button" on:click={handleClose} title="关闭">×</button>
		</div>

		<div class="note-viewer-content">
			<div class="selected-text">
				{note.selectedText}
			</div>
			<div class="note-content">
				{note.content}
			</div>
		</div>

		<div class="note-viewer-actions">
			<button
				class="edit-button"
				on:click={handleEdit}
				title="编辑笔记"
			>
				编辑
			</button>
			<button
				class="delete-button"
				on:click={handleDelete}
				title="删除笔记"
			>
				删除
			</button>
		</div>
	</div>
{/if}

<style>
	.note-viewer {
		position: fixed;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 12px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		padding: 16px;
		min-width: 300px;
		max-width: 400px;
		transform: translate(-50%, -100%) translateY(-10px);
		z-index: 1000;
	}

	.note-viewer::after {
		content: '';
		position: absolute;
		bottom: -8px;
		left: 50%;
		transform: translateX(-50%);
		width: 0;
		height: 0;
		border-left: 8px solid transparent;
		border-right: 8px solid transparent;
		border-top: 8px solid var(--background-primary);
	}

	.note-viewer-header {
		margin-bottom: 12px;
		padding-bottom: 8px;
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.note-date {
		font-size: 12px;
		color: var(--text-muted);
	}

	.note-viewer-content {
		margin-bottom: 16px;
	}

	.selected-text {
		font-size: 14px;
		font-style: italic;
		color: var(--text-muted);
		background: var(--background-secondary);
		padding: 12px;
		border-radius: 8px;
		margin-bottom: 12px;
		line-height: 1.5;
		position: relative;
	}

	.selected-text::before {
		content: '"';
		position: absolute;
		left: 6px;
		top: 0;
		font-size: 24px;
		color: var(--text-muted);
		opacity: 0.5;
	}

	.note-content {
		color: var(--text-normal);
		line-height: 1.6;
		font-size: 14px;
		padding: 0 4px;
	}

	.note-viewer-actions {
		display: flex;
		justify-content: flex-end;
		gap: 8px;
		padding-top: 12px;
		border-top: 1px solid var(--background-modifier-border);
	}

	button {
		padding: 6px 12px;
		border-radius: 6px;
		border: none;
		cursor: pointer;
		font-size: 13px;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		gap: 4px;
	}

	.edit-button {
		background: var(--interactive-accent);
		color: white;
	}

	.delete-button {
		background: var(--background-modifier-error);
		color: white;
	}

	button:hover {
		filter: brightness(1.1);
		transform: translateY(-1px);
	}

	.close-button {
		background: none;
		border: none;
		font-size: 20px;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		line-height: 1;
		transition: color 0.2s;
	}

	.close-button:hover {
		color: var(--text-error);
	}
</style>
