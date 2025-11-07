<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { fade } from 'svelte/transition';
	import type { Note } from '../types/notes';

	const dispatch = createEventDispatcher();

	export let isOpen = false;
	export let notes: Note[] = [];
	export let currentChapterId: number | string = 0;

	let searchQuery = '';

	// 计算过滤后的笔记列表
	$: filteredNotes = notes
		.filter(note =>
			note.chapterId === currentChapterId &&
			(searchQuery === '' ||
				note.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
				note.selectedText.toLowerCase().includes(searchQuery.toLowerCase()))
		)
		.sort((a, b) => {
			// 首先按行号排序
			if (a.lineNumber !== b.lineNumber) {
				return a.lineNumber - b.lineNumber;
			}
			// 然后按时间倒序
			return b.timestamp - a.timestamp;
		});

	// 格式化日期
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

	// 处理删除笔记
	async function handleDeleteNote(note: Note) {
		const confirmed = confirm('确定要删除这条笔记吗？');
		if (confirmed) {
			dispatch('deleteNote', { noteId: note.id });
		}
	}

	// 处理编辑笔记
	function handleEditNote(note: Note) {
		dispatch('editNote', { note });
	}
</script>

<div class="note-list-panel" class:open={isOpen} transition:fade>
	<div class="panel-header">
		<h3>笔记列表</h3>
		<button class="close-button" on:click={() => dispatch('close')}>×</button>
	</div>

	<div class="search-box">
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="搜索笔记内容..."
			class="search-input"
		/>
	</div>

	<div class="notes-list">
		{#if filteredNotes.length === 0}
			<div class="empty-message">
				{searchQuery ? '没有找到匹配的笔记' : '当前章节暂无笔记'}
			</div>
		{:else}
			{#each filteredNotes as note (note.id)}
				<div class="note-item" transition:fade>
					<div class="selected-text">
						{note.selectedText}
					</div>
					<div class="note-content">
						{note.content}
					</div>
					<div class="note-info">
						<span class="note-time">{formatDate(note.timestamp)}</span>
						<div class="note-actions">
							<button
								class="edit-button"
								on:click={() => handleEditNote(note)}
								title="编辑笔记"
							>
								编辑
							</button>
							<button
								class="delete-button"
								on:click={() => handleDeleteNote(note)}
								title="删除笔记"
							>
								删除
							</button>
						</div>
					</div>
				</div>
			{/each}
		{/if}
	</div>
</div>

<style>
	.note-list-panel {
		position: fixed;
		top: 0;
		right: 0;
		width: 320px;
		height: 100vh;
		background: var(--background-primary);
		border-left: 1px solid var(--background-modifier-border);
		box-shadow: -2px 0 8px rgba(0, 0, 0, 0.1);
		display: flex;
		flex-direction: column;
		z-index: 1000;
	}

	.panel-header {
		padding: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.panel-header h3 {
		margin: 0;
		font-size: 18px;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 24px;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
	}

	.search-box {
		padding: 12px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.search-input {
		width: 100%;
		padding: 8px 12px;
		border-radius: 6px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		font-size: 14px;
	}

	.notes-list {
		flex: 1;
		overflow-y: auto;
		padding: 12px;
	}

	.note-item {
		background: var(--background-secondary);
		border-radius: 8px;
		padding: 12px;
		margin-bottom: 12px;
	}

	.selected-text {
		font-style: italic;
		color: var(--text-muted);
		background: var(--background-modifier-form-field);
		padding: 8px;
		border-radius: 4px;
		margin-bottom: 8px;
		font-size: 14px;
	}

	.note-content {
		color: var(--text-normal);
		line-height: 1.6;
		margin-bottom: 8px;
		font-size: 14px;
	}

	.note-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 12px;
		color: var(--text-muted);
	}

	.note-actions {
		display: flex;
		gap: 8px;
	}

	.edit-button,
	.delete-button {
		padding: 4px 8px;
		border-radius: 4px;
		border: none;
		cursor: pointer;
		font-size: 12px;
		transition: all 0.2s;
	}

	.edit-button {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.delete-button {
		background: var(--background-modifier-error);
		color: white;
	}

	button:hover {
		filter: brightness(1.1);
	}

	.empty-message {
		text-align: center;
		color: var(--text-muted);
		padding: 20px;
	}
</style>
