<script lang="ts">
	import {createEventDispatcher, onDestroy, onMount} from 'svelte';
	import {fade} from 'svelte/transition';
	import type {Novel} from '../../types';
	import type NovelReaderPlugin from '../../main';
	import ChapterHistoryPanel from "../ChapterHistoryPanel.svelte";
	import NoteListPanel from "../NoteListPanel.svelte";
	import type {Note} from "../../types/notes";
	import type { ChapterProgress} from "../../types/txt/txt-reader";
	import type {ChapterHistory} from "../../types/reading-stats";
	import ReadingStatsPanel from "../ReadingStatsPanel.svelte";
	import TxtSettings from "./TxtSettings.svelte";
	import { icons } from '../library/icons';

	const dispatch = createEventDispatcher();

	export let plugin: NovelReaderPlugin;
	export let novel: Novel;
	export let content: string = '';
	export let currentChapterId: number | string = 0;
	export let notes: any[] = [];
	export let readingStats: any = null;
	export let showReadingProgress: boolean = true;
	export let chapterHistory: ChapterHistory[] = [];  // 从父组件接收

	let showSettingsDropdown = false;
	let showHistoryPanel = false;
	let showStatsPanel = false;
	let showNoteList = false;
	let showSettingsPanel = false;

	export let readerType: 'txt' | 'pdf' | 'epub';

	onMount(() => {
		// 立即执行异步初始化
		const initialize = async () => {
			// 如果父组件没有传递chapterHistory，则自己加载
			if ((!chapterHistory || chapterHistory.length === 0) && novel && plugin.chapterHistoryService) {
				try {
					chapterHistory = await plugin.chapterHistoryService.getHistory(novel.id);
				} catch (error) {
					console.error('Failed to load chapter history:', error);
				}
			}

			await loadReadingStats();
		};
		initialize();

		// 添加事件监听器
		document.addEventListener('click', handleGlobalClick);

		// 返回同步的清理函数
		return () => {
			document.removeEventListener('click', handleGlobalClick);
		};
	});

	onDestroy(() => {
		document.removeEventListener('click', handleGlobalClick);
	});

	// 处理设置按钮点击
	function handleSettingsClick(event: MouseEvent) {
		console.log('handleSettingsClick')
		event.stopPropagation();
		showSettingsDropdown = !showSettingsDropdown;
	}

	// 处理下拉菜单选项点击
	function handleMenuSelect(option: 'settings' | 'history' | 'stats' | 'notes') {
		showSettingsDropdown = false;

		// 重置所有面板状态
		showHistoryPanel = false;
		showStatsPanel = false;
		showNoteList = false;
		showSettingsPanel = false;

		console.log('设置页面,handleMenuSelect---'+option)

		// 根据选项显示对应面板
		switch (option) {
			case 'settings':
				showSettingsPanel = true;
				break;
			case 'history':
				showHistoryPanel = true;
				break;
			case 'stats':
				showStatsPanel = true;
				loadReadingStats();
				break;
			case 'notes':
				showNoteList = true;
				break;
		}
	}

	// 全局点击处理
	function handleGlobalClick(event: MouseEvent) {
		const target = event.target as HTMLElement;
		const isSettingsButton = target.closest('.settings-button');
		const isDropdown = target.closest('.settings-dropdown');

		if (!isSettingsButton && !isDropdown) {
			showSettingsDropdown = false;
		}
	}

	// 加载阅读统计
	async function loadReadingStats() {
		if (novel) {
			try {
				readingStats = await plugin.dbService?.getNovelStats(novel.id);
			} catch (error) {
				console.error('Failed to load reading stats:', error);
			}
		}
	}

	// 处理导出报告
	async function handleExportStats() {
		if (!novel) return;

		try {
			const report = await plugin.dbService?.exportReport(novel.id);
			if (report) {
				const blob = new Blob([report], {type: 'text/markdown'});
				const url = URL.createObjectURL(blob);
				const a = document.createElement('a');
				a.href = url;
				a.download = `${novel.title}_阅读报告.md`;
				document.body.appendChild(a);
				a.click();

				URL.revokeObjectURL(url);
				document.body.removeChild(a);
			}
		} catch (error) {
			console.error('Failed to export reading stats:', error);
		}
	}

	// 章节跳转处理
	function onJumpToChapter(event: CustomEvent) {
		dispatch('jumpToChapter', event.detail);
	}

	let noteViewerVisible = false;   // 控制笔记查看器显示
	let selectedNote: Note | null = null;
	let selectedTextForNote = '';
	let showNoteDialog = false;      // 控制笔记对话框显示
	let currentChapter: ChapterProgress | null = null;

	function handleNoteEdit(event: CustomEvent) {
		const {note} = event.detail;
		noteViewerVisible = false; // 关闭查看器
		selectedNote = note;  // 保存当前编辑的笔记
		selectedTextForNote = note.selectedText; // 确保显示正确的选中文本
		showNoteDialog = true;  // 显示编辑对话框
	}

	async function saveNotes() {
		try {
			const notesData = {
				novelId: novel.id,
				novelName: novel.title,
				notes
			};

			// 构建notes目录路径
			const notesDir = `${plugin.settings.libraryPath}/notes`;
			const notesPath = `${notesDir}/${novel.id}.json`;

			// 确保notes目录存在
			if (!(await plugin.app.vault.adapter.exists(notesDir))) {
				await plugin.app.vault.adapter.mkdir(notesDir);
			}

			// 写入文件
			await plugin.app.vault.adapter.write(
				notesPath,
				JSON.stringify(notesData, null, 2)
			);

			console.log('Notes saved successfully');
		} catch (error) {
			console.error('Failed to save notes:', error);
			throw error;
		}
	}

	async function handleNoteDelete(event: CustomEvent) {
		const {noteId} = event.detail;
		notes = notes.filter(n => n.id !== noteId);
		await saveNotes();
		noteViewerVisible = false;
		selectedNote = null;

		// 触发重新渲染
		if (currentChapter) {
			currentChapter = {...currentChapter};
		}
	}

	function handleJumpToChapter(event: CustomEvent) {
		dispatch('jumpToChapter', {
			chapterId: event.detail.chapterId
		});
	}
</script>

<div class="settings-container">
	<button
		class="settings-button"
		on:click={handleSettingsClick}
		title="设置菜单"
	>
		<span class="settings-icon">{@html icons.settings}</span>
	</button>

	{#if showSettingsDropdown}
		<div class="settings-dropdown" transition:fade>
			<button
				class="dropdown-item"
				on:click={() => handleMenuSelect('settings')}
			>
				<span class="icon">{@html icons.settings}</span>
				设置
			</button>
			{#if showReadingProgress}
				<button
					class="dropdown-item"
					on:click={() => handleMenuSelect('history')}
				>
					<span class="icon">{@html icons.bookOpen}</span>
					阅读历史
				</button>
			{/if}
			<button
				class="dropdown-item"
				on:click={() => handleMenuSelect('notes')}
			>
				<span class="icon">{@html icons.note}</span>
				笔记列表
			</button>
			<button
				class="dropdown-item"
				on:click={() => handleMenuSelect('stats')}
			>
				<span class="icon">{@html icons.barChart}</span>
				阅读统计
			</button>
		</div>
	{/if}
</div>

<!-- 设置面板 -->
{#if showSettingsPanel}
	<div class="settings-panel" transition:fade>
		<div class="settings-header">
			<h3>阅读设置</h3>
			<button class="close-button" on:click={() => showSettingsPanel = false}>×</button>
		</div>

		<!-- 根据readerType显示不同设置面板 -->
		{#if readerType === 'txt'}
			<TxtSettings
				{plugin}
				{novel}
				{content}
				on:savePattern
				on:close={() => showSettingsPanel = false}
			/>
		{:else if readerType === 'pdf'}
			<!-- PDF特定设置 -->
		{:else if readerType === 'epub'}
			<!-- EPUB特定设置 -->
		{/if}
	</div>
{/if}

<!-- 单独的历史面板 -->
{#if showHistoryPanel && !showSettingsDropdown}
	<!-- 添加条件确保下拉菜单和历史面板不会同时显示 -->
	<ChapterHistoryPanel
		isOpen={true}
		history={chapterHistory}
		on:jumpToChapter
		on:deleteRecord={async (e) => {
            await plugin.chapterHistoryService.deleteRecord(novel.id, e.detail.timestamp);
            chapterHistory = await plugin.chapterHistoryService.getHistory(novel.id);
        }}
		on:clearHistory={async () => {
            await plugin.chapterHistoryService.clearHistory(novel.id);
            chapterHistory = [];
        }}
		on:close={() => showHistoryPanel = false}
	/>
{/if}

{#if showNoteList}
	<NoteListPanel
		isOpen={showNoteList}
		notes={notes}
		currentChapterId={typeof currentChapterId === 'string' ? parseInt(currentChapterId) : currentChapterId}
		on:close={() => showNoteList = false}
		on:deleteNote
		on:editNote
	/>
{/if}

<!-- 添加统计面板 -->
{#if showStatsPanel && readingStats}
	<ReadingStatsPanel
		isOpen={showStatsPanel}
		novelId={novel.id}
		{readingStats}
		{novel}
		on:close={() => showStatsPanel = false}
		on:exportStats={handleExportStats}
	/>
{/if}

<style>
	.settings-container {
		position: relative;
	}

	.settings-button {
		background: var(--background-secondary);
		border: none;
		border-radius: 6px;
		padding: 8px;
		cursor: pointer;
		opacity: 0.8;
		transition: all 0.2s;
		font-size: 16px;
		width: 36px;
		height: 36px;
		display: flex;
		align-items: center;
		justify-content: center;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.settings-button:hover {
		opacity: 1;
		transform: translateY(-1px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
	}

	.settings-icon :global(svg) {
		width: 18px;
		height: 18px;
		stroke: currentColor;
	}

	.settings-dropdown {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		min-width: 160px;
		z-index: 1000;
	}

	.dropdown-item {
		display: flex;
		align-items: center;
		gap: 8px;
		width: 100%;
		padding: 10px 16px;
		border: none;
		background: none;
		color: var(--text-normal);
		cursor: pointer;
		text-align: left;
		transition: background-color 0.2s;
	}

	.dropdown-item:hover {
		background-color: var(--background-modifier-hover);
	}

	.dropdown-item .icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 16px;
		opacity: 0.8;
	}

	.dropdown-item .icon :global(svg) {
		width: 16px;
		height: 16px;
		stroke: currentColor;
	}

	.settings-panel {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: 800px;
		max-width: 90vw;
		height: 600px;
		max-height: 90vh;
		background: var(--background-primary);
		border-radius: 12px;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
		z-index: 1000;
		display: flex;
		flex-direction: column;
	}

	.close-button {
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 24px;
		cursor: pointer;
		padding: 4px;
	}

	.close-button:hover {
		color: var(--text-error);
	}

	.settings-header {
		padding: 20px 24px;
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.settings-header h3 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
	}
</style>
