<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import type { ChapterHistory } from '../types/reading-stats';

	const dispatch = createEventDispatcher();

	export let history: ChapterHistory[] = [];
	export let isOpen = false;

	let searchQuery = '';

	$: filteredHistory = history.filter(record =>
		record.chapterTitle.toLowerCase().includes(searchQuery.toLowerCase())
	);

	function formatDate(timestamp: number): string {
		const now = Date.now();
		const diff = now - timestamp;
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));

		if (days === 0) return '今天';
		if (days === 1) return '昨天';
		if (days < 7) return `${days}天前`;

		const date = new Date(timestamp);
		return `${date.getMonth() + 1}月${date.getDate()}日`;
	}

	function handleJumpToChapter(chapterId: number) {
		dispatch('jumpToChapter', { chapterId });
	}

	function handleDeleteRecord(timestamp: number) {
		dispatch('deleteRecord', { timestamp });
	}

	function handleClearHistory() {
		dispatch('clearHistory');
	}
</script>

<div class="history-panel" class:open={isOpen}>
	<div class="panel-header">
		<h3>阅读历史</h3>
		<button class="close-button" on:click={() => isOpen = false}>×</button>
	</div>

	<div class="search-box">
		<input
			type="text"
			bind:value={searchQuery}
			placeholder="搜索章节..."
		/>
	</div>

	<div class="history-list">
		{#each filteredHistory as record}
			<div class="history-item">
				<div class="record-content">
					<div class="chapter-title">{record.chapterTitle}</div>
					<div class="record-time">{formatDate(record.timestamp)}</div>
				</div>
				<div class="record-actions">
					<button
						class="jump-button"
						on:click={() => handleJumpToChapter(record.chapterId)}
					>
						跳转
					</button>
					<button
						class="delete-button"
						on:click={() => handleDeleteRecord(record.timestamp)}
					>
						×
					</button>
				</div>
			</div>
		{/each}

		{#if filteredHistory.length === 0}
			<div class="empty-message">
				{searchQuery ? '没有找到匹配的记录' : '暂无阅读历史'}
			</div>
		{/if}
	</div>

	<div class="panel-footer">
		<button
			class="clear-button"
			on:click={handleClearHistory}
		>
			清空历史记录
		</button>
	</div>
</div>

<style>
	.history-panel {
		position: fixed;
		top: 0;
		right: -320px;
		width: 320px;
		height: 100vh;
		background: var(--background-primary);
		border-left: 1px solid var(--background-modifier-border);
		display: flex;
		flex-direction: column;
		transition: transform 0.3s ease;
		z-index: 1000;
	}

	.history-panel.open {
		transform: translateX(-320px);
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
	}

	.close-button {
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
		color: var(--text-muted);
	}

	.search-box {
		padding: 8px 16px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.search-box input {
		width: 100%;
		padding: 8px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border);
	}

	.history-list {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.history-item {
		padding: 8px;
		border-radius: 4px;
		margin-bottom: 8px;
		background: var(--background-secondary);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.record-content {
		flex: 1;
	}

	.chapter-title {
		font-weight: 500;
		margin-bottom: 4px;
	}

	.record-time {
		font-size: 12px;
		color: var(--text-muted);
	}

	.record-actions {
		display: flex;
		gap: 8px;
	}

	.jump-button {
		padding: 4px 8px;
		border-radius: 4px;
		background: var(--interactive-accent);
		color: white;
		border: none;
		cursor: pointer;
	}

	.delete-button {
		padding: 4px 8px;
		border-radius: 4px;
		background: var(--background-modifier-error);
		color: white;
		border: none;
		cursor: pointer;
	}

	.panel-footer {
		padding: 16px;
		border-top: 1px solid var(--background-modifier-border);
		text-align: center;
	}

	.clear-button {
		padding: 8px 16px;
		border-radius: 4px;
		background: var(--background-modifier-error);
		color: white;
		border: none;
		cursor: pointer;
	}

	.empty-message {
		text-align: center;
		color: var(--text-muted);
		padding: 16px;
	}
</style>
