<script lang="ts">
	import {onMount} from 'svelte';
	import type {Novel} from '../../types';
	import type {Note, NovelNotes} from '../../types/notes';
	import type NovelReaderPlugin from '../../main';
	import NoteDialog from "../NoteDialog.svelte";
	import {NotesService} from "../../services/note/notes-service";
	import {PathsService} from "../../services/utils/paths-service";
	import {icons} from '../library/icons';

	export let plugin: NovelReaderPlugin;

	let notesService: NotesService; //笔记
	let pathsService: PathsService;

	interface FilterOptions {
		novelId: string | null;
		startDate: string | null;
		endDate: string | null;
		searchQuery: string;
		sortOrder: 'asc' | 'desc';
	}

	let tempSearchQuery = ''; // 临时搜索变量
	let novels: Novel[] = [];
	let allNovelNotes: NovelNotes[] = [];
	let filteredNovelNotes: NovelNotes[] = [];
	let filterOptions: FilterOptions = {
		novelId: null,
		startDate: null,
		endDate: null,
		searchQuery: '',
		sortOrder: 'desc'
	};

	let showNoteDialog = false;
	let editingNote: { note: Note; novelNotes: NovelNotes } | null = null;

	$: {
		// 监听筛选条件变化
		filterOptions;
		applyFilters();
	}

	onMount(async () => {
		notesService = new NotesService(plugin.app, plugin);
		pathsService = new PathsService(plugin.app, plugin);

		await loadNovelsAndNotesData();
	});

	async function loadNovelsAndNotesData() {
		try {
			// 加载所有小说
			novels = await plugin.libraryService.getAllNovels();

			// 加载所有笔记
			allNovelNotes = await notesService.loadNovelNotes(novels);

			// 应用筛选
			applyFilters();
		} catch (error) {
			console.error('Error loading data:', error);
		}
	}

	function applyFilters() {
		let notes = [...allNovelNotes];

		// 应用小说筛选
		if (filterOptions.novelId) {
			notes = notes.filter(note => note.novelId === filterOptions.novelId);
		}

		notes = notes.map(novelNote => {
			let filteredNotes = [...novelNote.notes];

			// 应用日期筛选
			if (filterOptions.startDate) {
				const startDate = new Date(filterOptions.startDate).getTime();
				filteredNotes = filteredNotes.filter(note => note.timestamp >= startDate);
			}
			if (filterOptions.endDate) {
				const endDate = new Date(filterOptions.endDate).getTime();
				filteredNotes = filteredNotes.filter(note => note.timestamp <= endDate);
			}

			// 应用搜索筛选
			if (filterOptions.searchQuery) {
				const query = filterOptions.searchQuery.toLowerCase();
				filteredNotes = filteredNotes.filter(note =>
					note.content.toLowerCase().includes(query) ||
					note.selectedText.toLowerCase().includes(query)
				);
			}

			// 应用排序
			filteredNotes.sort((a, b) => {
				const order = filterOptions.sortOrder === 'desc' ? -1 : 1;
				return (a.timestamp - b.timestamp) * order;
			});

			return {
				...novelNote,
				notes: filteredNotes
			};
		});

		// 只保留有笔记的小说
		filteredNovelNotes = notes.filter(note => note.notes.length > 0);
	}

	async function handleDeleteNote(note: Note, novelNotes: NovelNotes) {
		const confirmed = confirm('确定要删除这条笔记吗？');
		if (!confirmed) return;

		try {
			// 更新笔记文件
			const notesPath = pathsService.getNotePathByNovelId(novelNotes.novelId);
			if (await plugin.app.vault.adapter.exists(notesPath)) {
				const updatedNotes = {
					...novelNotes,
					notes: novelNotes.notes.filter(n => n.id !== note.id)
				};
				await plugin.app.vault.adapter.write(notesPath, JSON.stringify(updatedNotes, null, 2));

				// 重新加载数据
				await loadNovelsAndNotesData();
			}
		} catch (error) {
			console.error('Error deleting note:', error);
		}
	}

	function handleEditNote(note: Note, novelNotes: NovelNotes) {
		editingNote = {note, novelNotes};
		showNoteDialog = true;
	}

	async function handleNoteSave(event: CustomEvent) {
		if (!editingNote) return;

		try {
			const {note, novelNotes} = editingNote;
			const notesPath = pathsService.getNotePathByNovelId(novelNotes.novelId);

			if (await plugin.app.vault.adapter.exists(notesPath)) {
				const noteIndex = novelNotes.notes.findIndex(n => n.id === note.id);

				if (noteIndex !== -1) {
					const updatedNotes = {
						...novelNotes,
						notes: [...novelNotes.notes]
					};
					updatedNotes.notes[noteIndex] = {
						...note,
						content: event.detail.content,
						timestamp: Date.now()
					};

					await plugin.app.vault.adapter.write(notesPath, JSON.stringify(updatedNotes, null, 2));
				}
			}

			await loadNovelsAndNotesData(); // 重新加载数据

			showNoteDialog = false;
			editingNote = null;
		} catch (error) {
			console.error('Error saving note:', error);
		}
	}

	// 修改搜索处理函数
	function handleSearch() {
		filterOptions = {
			...filterOptions,
			searchQuery: tempSearchQuery
		};
	}
</script>

<div class="global-notes">
	<div class="toolbar">
		<div class="filters">
			<select
				bind:value={filterOptions.novelId}
				class="filter-input novel-select"
			>
				<option value={null}>全部图书</option>
				{#each novels as novel}
					<option value={novel.id}>{novel.title}</option>
				{/each}
			</select>

			<input
				type="date"
				bind:value={filterOptions.startDate}
				class="filter-input date-input"
				placeholder="开始日期"
			/>
			<input
				type="date"
				bind:value={filterOptions.endDate}
				class="filter-input date-input"
				placeholder="结束日期"
			/>

			<div class="search-container">
				<input
					type="text"
					bind:value={tempSearchQuery}
					class="filter-input search-input"
					placeholder="搜索笔记内容..."
					on:keydown={(e) => e.key === 'Enter' && handleSearch()}
				/>
				<button
					class="filter-input search-button"
					on:click={handleSearch}
				>
					<span class="icon">{@html icons.search}</span>
					搜索
				</button>
			</div>

			<select
				bind:value={filterOptions.sortOrder}
				class="filter-input sort-select"
			>
				<option value="desc">最新添加</option>
				<option value="asc">最早添加</option>
			</select>
		</div>
	</div>

	<div class="notes-list">
		{#each filteredNovelNotes as novelNotes}
			<div class="novel-section">
				<h3 class="novel-title">{novelNotes.novelName}</h3>
				{#each novelNotes.notes as note}
					<div class="note-item">
						<div class="note-header">
							<span class="chapter-info">第{note.chapterId}章 - {note.chapterName}</span>
							<span class="timestamp">
                                {new Date(note.timestamp).toLocaleString()}
                            </span>
						</div>

						<div class="selected-text">
							{note.selectedText}
						</div>

						<div class="note-content">
							{note.content}
						</div>

						<div class="note-actions">
							<button
								class="edit-button"
								on:click={() => handleEditNote(note, novelNotes)}
							>
								<span class="icon">{@html icons.edit}</span>
								编辑
							</button>
							<button
								class="delete-button"
								on:click={() => handleDeleteNote(note, novelNotes)}
							>
								<span class="icon">{@html icons.trash}</span>
								删除
							</button>
						</div>
					</div>
				{/each}
			</div>
		{/each}

		{#if filteredNovelNotes.length === 0}
			<div class="empty-message">
				没有找到匹配的笔记
			</div>
		{/if}
	</div>
</div>

{#if showNoteDialog && editingNote}
	<NoteDialog
		isOpen={showNoteDialog}
		selectedText={editingNote.note.selectedText}
		existingNote={editingNote.note}
		on:save={handleNoteSave}
		on:close={() => {
            showNoteDialog = false;
            editingNote = null;
        }}
	/>
{/if}

<style>
	.global-notes {
		height: 100%;
		display: flex;
		flex-direction: column;
		padding: var(--novel-spacing-md);
	}

	.toolbar {
		margin-bottom: var(--novel-spacing-md);
		position: sticky;
		top: 0;
		background-color: var(--background-primary);
		z-index: 10;
		padding: var(--novel-spacing-sm) 0;
	}

	.filters {
		display: flex;
		gap: var(--novel-spacing-sm);
		flex-wrap: wrap;
		align-items: stretch;
	}

	.novel-select,
	.date-input,
	.search-input,
	.sort-select {
		padding: var(--novel-spacing-sm) var(--novel-spacing-md);
		border-radius: var(--novel-radius-md);
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		font-size: var(--novel-font-size-base);
		transition: all 0.2s;
	}

	.novel-select:hover,
	.date-input:hover,
	.search-input:hover,
	.sort-select:hover {
		border-color: var(--interactive-accent);
	}

	.novel-select:focus,
	.date-input:focus,
	.search-input:focus,
	.sort-select:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.1);
	}

	.search-input {
		flex: 1;
		min-width: 200px;
	}

	.notes-list {
		flex: 1;
		overflow-y: auto;
		display: grid;
		gap: var(--novel-spacing-md);
	}

	.note-item {
		background: var(--background-secondary);
		border-radius: var(--novel-radius-md);
		padding: var(--novel-spacing-md);
		transition: all 0.2s;
	}

	.note-item:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
	}

	.note-header {
		display: flex;
		gap: var(--novel-spacing-sm);
		align-items: center;
		margin-bottom: var(--novel-spacing-sm);
	}

	.novel-title {
		font-weight: 500;
		font-size: var(--novel-font-size-lg);
		margin-bottom: var(--novel-spacing-sm);
	}

	.chapter-info {
		color: var(--text-muted);
		font-size: var(--novel-font-size-sm);
	}

	.timestamp {
		color: var(--text-muted);
		font-size: var(--novel-font-size-sm);
		margin-left: auto;
	}

	.selected-text {
		background: var(--background-primary);
		padding: var(--novel-spacing-sm);
		border-radius: var(--novel-radius-sm);
		margin-bottom: var(--novel-spacing-sm);
		font-style: italic;
		color: var(--text-muted);
		border-left: 3px solid var(--interactive-accent);
	}

	.note-content {
		margin-bottom: var(--novel-spacing-sm);
		line-height: 1.6;
		color: var(--text-normal);
	}

	.note-actions {
		display: flex;
		gap: var(--novel-spacing-xs);
		justify-content: flex-end;
	}

	.edit-button,
	.delete-button {
		display: flex;
		align-items: center;
		gap: var(--novel-spacing-xs);
		padding: var(--novel-spacing-xs) var(--novel-spacing-sm);
		border-radius: var(--novel-radius-sm);
		border: none;
		cursor: pointer;
		font-size: var(--novel-font-size-base);
		transition: all 0.2s;
	}

	.edit-button {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.edit-button:hover {
		background: var(--interactive-accent-hover);
		transform: translateY(-1px);
	}

	.delete-button {
		background: var(--background-modifier-error);
		color: white;
	}

	.delete-button:hover {
		opacity: 0.9;
		transform: translateY(-1px);
	}

	.empty-message {
		text-align: center;
		padding: var(--novel-spacing-xl);
		color: var(--text-muted);
		font-size: var(--novel-font-size-base);
	}

	.filter-input {
		padding: var(--novel-spacing-sm) var(--novel-spacing-md);
		border-radius: var(--novel-radius-md);
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		height: 36px;
		box-sizing: border-box;
		font-size: var(--novel-font-size-base);
	}

	.search-container {
		display: flex;
		gap: var(--novel-spacing-xs);
		flex: 1;
	}

	.search-button {
		white-space: nowrap;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		cursor: pointer;
		border: none;
		transition: all 0.2s;
		display: flex;
		align-items: center;
		gap: var(--novel-spacing-xs);
		justify-content: center;
	}

	.search-button:hover {
		background: var(--interactive-accent-hover);
		transform: translateY(-1px);
	}

	.novel-select,
	.sort-select {
		min-width: 120px;
	}

	.date-input {
		min-width: 130px;
	}

	/* SVG图标样式 */
	.icon svg {
		display: inline-block;
		vertical-align: middle;
		width: 16px;
		height: 16px;
		stroke: currentColor;
		fill: none;
	}

	.search-button .icon svg,
	.edit-button .icon svg,
	.delete-button .icon svg {
		width: 14px;
		height: 14px;
	}
</style>
