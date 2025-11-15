<script lang="ts">
	import {createEventDispatcher, onDestroy, onMount} from 'svelte';
	import type {Novel, ReadingProgress} from '../../types';
	import type NovelReaderPlugin from "../../main";
	import type {ChapterHistory} from "../../types/reading-stats";
	import type { ChapterProgress} from "../../types/txt/txt-reader";
	import {handleChapterChange, parseChapters, switchChapter} from "../../lib/txt.reader/chapter-logic";
	import {saveReadingProgress} from "../../lib/txt.reader/progress-logic";
	import {scrollPage} from "../../lib/txt.reader/scroll-control";
	import type{Note} from "../../types/notes";
	import NoteDialog from "../NoteDialog.svelte";
	import {v4 as uuidv4} from 'uuid';
	import NoteViewer from "../NoteViewer.svelte";
	import ReaderSettingsMenu from "../setting/ReaderSettingsMenu.svelte";
	import {Notice} from "obsidian";
	import TextSelectionMenu from "../TextSelectionMenu.svelte";
	import {NotesService} from "../../services/note/notes-service";
	import { icons } from '../library/icons';
	import { debounce, throttle } from '../../utils/debounce';

	const dispatch = createEventDispatcher();

	export let plugin: NovelReaderPlugin;
	export let novel: Novel;
	export let content: string = '';
	export let displayMode: 'hover' | 'outline' | 'sidebar' = 'sidebar';
	export let currentChapterId: number | null = null;
	export let initialChapterId: number | null = null; //初始打开图书选择的章节ID
	export let savedProgress: ReadingProgress | null = null;
	export let chapters: ChapterProgress[] = [];

	let notesService: NotesService; //笔记

	let isActive = false;

	let currentChapter: ChapterProgress | null = null;
	let contentLoaded = false;
	let isMenuVisible = false;

	let readingSessionInterval: ReturnType<typeof setInterval> | null = null;
	let isReadingActive = false;
	const INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5分钟无操作视为暂停
	let lastActivityTime = Date.now();
	let sessionStartTime: number | null = null;

	let hoverChaptersContainer: HTMLElement;
	let outlineChaptersContainer: HTMLElement;
	let sidebarChaptersContainer: HTMLElement;
	let chapterElements: Map<number, HTMLElement> = new Map();
	let isSidebarCollapsed = false; // sidebar折叠状态

	let notes: Note[] = [];
	let noteViewerPosition = {x: 0, y: 0};

	let showNoteDialog = false;      // 控制笔记对话框显示
	let noteViewerVisible = false;   // 控制笔记查看器显示
	let selectedNote: Note | null = null;
	let selectedTextForNote = '';
	let selectedTextIndex = 0;
	let currentLineNumber = 0;

	let readingStats: any = null;

	let processedContent: { notes: Note[]; text: string; lineNumber: number }[];
	let chapterHistory: ChapterHistory[] = [];
	let selectedTextChapterId = 0;
	let showNoteList = false;

	// TXT 悬浮目录：目录/页码切换功能
	const LINES_PER_PAGE = 160; // 每页显示160行
	let viewMode: 'chapters' | 'pages' = 'chapters';
	let virtualPages: Array<{
		pageNum: number,
		chapterId: number,
		chapterTitle: string,
		startLine: number,
		endLine: number
	}> = [];
	let currentPageNum = 1;
	let currentVirtualPage: typeof virtualPages[0] | null = null;

	// 计算基于行数的虚拟页码
	function calculateVirtualPages() {
		virtualPages = [];
		let pageNum = 1;

		chapters.forEach(chapter => {
			const lines = chapter.content.split('\n');
			const totalLines = lines.length;

			// 为每个章节按行数分页
			for (let startLine = 0; startLine < totalLines; startLine += LINES_PER_PAGE) {
				const endLine = Math.min(startLine + LINES_PER_PAGE - 1, totalLines - 1);

				virtualPages.push({
					pageNum: pageNum++,
					chapterId: chapter.id,
					chapterTitle: chapter.title,
					startLine: startLine,
					endLine: endLine
				});
			}
		});

		// 初始化第一页
		if (virtualPages.length > 0) {
			currentVirtualPage = virtualPages[0];
			currentPageNum = 1;
		}
	}

	// 根据当前章节计算当前页码
	function updateCurrentPage() {
		if (viewMode === 'chapters') {
			// 章节模式：基于当前章节
			if (!currentChapter || virtualPages.length === 0) return;
			const page = virtualPages.find(p =>
				p.chapterId === currentChapter.id && p.startLine === 0
			);
			if (page) {
				currentPageNum = page.pageNum;
			}
		} else {
			// 页码模式：基于当前虚拟页
			if (currentVirtualPage) {
				currentPageNum = currentVirtualPage.pageNum;
			}
		}
	}

	// 跳转到指定页码
	function jumpToPage(pageNum: number) {
		const page = virtualPages.find(p => p.pageNum === pageNum);
		if (!page) return;

		currentVirtualPage = page;
		currentPageNum = pageNum;

		// 同时更新当前章节引用
		const targetChapter = chapters.find(ch => ch.id === page.chapterId);
		if (targetChapter) {
			currentChapter = targetChapter;
		}
	}

	// 切换到上一页/下一页
	function switchPage(direction: 'prev' | 'next') {
		const currentIndex = virtualPages.findIndex(p => p.pageNum === currentPageNum);
		if (currentIndex === -1) return;

		let nextIndex: number;
		if (direction === 'prev') {
			nextIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
		} else {
			nextIndex = currentIndex < virtualPages.length - 1 ? currentIndex + 1 : currentIndex;
		}

		if (nextIndex !== currentIndex) {
			jumpToPage(virtualPages[nextIndex].pageNum);
		}
	}

	// 获取当前虚拟页的内容
	function getCurrentPageContent(): string[] {
		if (!currentVirtualPage || !currentChapter) return [];

		const lines = currentChapter.content.split('\n');
		return lines.slice(currentVirtualPage.startLine, currentVirtualPage.endLine + 1);
	}

	// 从 novel.customSettings 读取用户偏好
	$: {
		if (novel?.customSettings?.txtViewMode) {
			viewMode = novel.customSettings.txtViewMode;
		} else {
			// 优先显示目录，如果没有目录则显示页码
			viewMode = chapters.length > 0 ? 'chapters' : 'pages';
		}
	}

	// 当章节变化时更新页码
	$: if (currentChapter && virtualPages.length > 0) {
		updateCurrentPage();
	}

	// 切换目录/页码显示模式
	async function toggleViewMode() {
		viewMode = viewMode === 'chapters' ? 'pages' : 'chapters';

		// 保存用户选择到 novel.customSettings
		if (!novel.customSettings) {
			novel.customSettings = {};
		}
		novel.customSettings.txtViewMode = viewMode;

		// 更新到数据库
		await plugin.libraryService.updateNovel(novel);
	}

	// 合并所有 onMount 逻辑，避免重复的事件监听器
	onMount(async () => {
		// 1. 初始化笔记服务
		notesService = new NotesService(plugin.app, plugin);
		notes = await notesService.loadNotes(novel.id);
		await loadReadingStats();

		// 2. 解析章节和恢复阅读进度
		if (content) {
			parseAndSetChapters();
			contentLoaded = true;

			// 恢复上次阅读进度
			if (savedProgress?.position?.chapterId) {
				currentChapterId = savedProgress.position.chapterId;
				const savedChapter = chapters.find(ch => ch.id === currentChapterId);
				if (savedChapter) {
					currentChapter = savedChapter;
				}
			} else if (initialChapterId !== null) {
				// 如果有初始章节ID，加载该章节
				const savedChapter = chapters.find(ch => ch.id === initialChapterId);
				if (savedChapter) {
					currentChapter = savedChapter;
					currentChapterId = savedChapter.id;
				}
			} else if (chapters.length > 0) {
				// 否则加载第一章
				currentChapter = chapters[0];
				currentChapterId = chapters[0].id;
			}
		}

		// 初始化时滚动到当前章节
		if (currentChapter) {
			if (displayMode === 'hover' && hoverChaptersContainer) {
				scrollToActiveChapter(hoverChaptersContainer);
			} else if (displayMode === 'outline' && outlineChaptersContainer) {
				scrollToActiveChapter(outlineChaptersContainer);
			} else if (displayMode === 'sidebar' && sidebarChaptersContainer) {
				scrollToActiveChapter(sidebarChaptersContainer);
			}
		}

		// 3. 初始化阅读会话
		initializeReadingSession();

		// 4. 添加笔记图标点击事件监听
		const handleNoteIconClick = (event: CustomEvent) => {
			const noteId = event.detail.noteId;
			const note = notes.find(n => n.id === noteId);
			if (note) {
				selectedNote = note;
				const noteMarker = document.querySelector(`[data-note-id="${noteId}"]`);
				if (noteMarker) {
					const rect = noteMarker.getBoundingClientRect();
					noteViewerPosition = {
						x: rect.left + (rect.width / 2),
						y: rect.top
					};
					noteViewerVisible = true;
				}
			}
		};

		// 5. 页面可见性变化处理
		const handleVisibilityHandler = () => {
			isActive = !document.hidden;
			handleVisibilityChange();
		};

		// 6. 用户活动处理（使用节流，避免高频触发）
		let activityTimeout: ReturnType<typeof setTimeout> | null = null;
		const throttledUpdateActivity = () => {
			if (activityTimeout) return;
			activityTimeout = setTimeout(() => {
				updateActivity();
				activityTimeout = null;
			}, 1000); // 节流1秒
		};

		// 7. 添加所有事件监听器（确保每个事件只监听一次）
		window.addEventListener('keydown', handleKeyDown);
		window.addEventListener('noteIconClick', handleNoteIconClick as EventListener);
		document.addEventListener('visibilitychange', handleVisibilityHandler);

		// 用户活动监听（移除 mousemove 以提高性能，使用节流）
		const activityEvents = ['keydown', 'scroll', 'click'];
		activityEvents.forEach(event => {
			window.addEventListener(event, throttledUpdateActivity);
		});

		// 8. 返回清理函数，移除所有事件监听器
		return () => {
			// 清理定时器
			if (readingSessionInterval) {
				clearInterval(readingSessionInterval);
			}
			if (activityTimeout) {
				clearTimeout(activityTimeout);
			}

			// 结束当前会话
			if (isReadingActive) {
				endCurrentSession();
			}

			// 清理防抖函数，防止内存泄漏
			debouncedRenderChapter.cancel();
			debouncedScrollToChapter.cancel();

			// 移除所有事件监听器
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('noteIconClick', handleNoteIconClick as EventListener);
			document.removeEventListener('visibilitychange', handleVisibilityHandler);

			activityEvents.forEach(event => {
				window.removeEventListener(event, throttledUpdateActivity);
			});
		};
	})

	$: if (content && !contentLoaded) {
		parseAndSetChapters();
		contentLoaded = true;
	}

	$: if (currentChapterId !== null && chapters.length > 0) {
		const chapter = chapters.find(c => c.id === currentChapterId);
		if (chapter) {
			currentChapter = chapter;
			// 无论是通过大纲还是切换章节，只要章节ID变化就保存进度
			saveReadingProgress(novel, currentChapter, chapters);
		}
	}

	// 防抖的章节内容渲染（延迟300ms执行，减少DOM重绘）
	const debouncedRenderChapter = debounce((chapter: ChapterProgress) => {
		processedContent = renderChapterContent(chapter);
	}, 300);

	// 防抖的滚动操作（延迟200ms执行）
	const debouncedScrollToChapter = debounce((container: HTMLElement) => {
		scrollToActiveChapter(container);
	}, 200);

	// 章节切换时更新会话
	$: if (currentChapter) {
		if (isReadingActive) {
			endCurrentSession();
		}

		startNewSession();

		handleChapterChange(
			currentChapter,
			novel,
			plugin.chapterHistoryService,
			(newHistory) => {
				chapterHistory = newHistory;
			}
		);

		// 根据显示模式滚动到对应位置（使用防抖）
		if (displayMode === 'hover' && hoverChaptersContainer) {
			debouncedScrollToChapter(hoverChaptersContainer);
		} else if (displayMode === 'outline' && outlineChaptersContainer) {
			debouncedScrollToChapter(outlineChaptersContainer);
		} else if (displayMode === 'sidebar' && sidebarChaptersContainer) {
			debouncedScrollToChapter(sidebarChaptersContainer);
		}

		// 使用防抖渲染章节内容，减少高频DOM操作
		debouncedRenderChapter(currentChapter);
	}

	function parseAndSetChapters() {
		chapters = parseChapters(content, novel);
		if (chapters.length > 0) {
			currentChapter = chapters[0];
		}
		// 计算虚拟页码
		calculateVirtualPages();
		// 触发自定义事件通知父组件章节更新
		const event = new CustomEvent('chaptersUpdated', {
			detail: {chapters}
		});
		window.dispatchEvent(event);
	}

	function handleMouseEnter() {
		if (displayMode === 'hover') {
			isMenuVisible = true;
		}
	}

	function handleMouseLeave() {
		if (displayMode === 'hover') {
			isMenuVisible = false;
		}
	}

	// sidebar切换函数
	function toggleSidebar() {
		isSidebarCollapsed = !isSidebarCollapsed;
	}

	function handleKeyDown(event: KeyboardEvent) {
		// 只有当页面激活时才处理键盘事件
		if (!isActive) return;

		if (event.key === 'ArrowLeft') {
			// 根据模式选择切换方式
			if (viewMode === 'pages') {
				switchPage('prev');
			} else {
				handleSwitchChapter('prev');
			}
			event.preventDefault();
		} else if (event.key === 'ArrowRight') {
			// 根据模式选择切换方式
			if (viewMode === 'pages') {
				switchPage('next');
			} else {
				handleSwitchChapter('next');
			}
			event.preventDefault();
		} else if (event.key === 'ArrowUp') {
			event.preventDefault();
			handleScroll('up');
		} else if (event.key === 'ArrowDown') {
			event.preventDefault();
			handleScroll('down');
		}
	}

	function handleFocus() {
		isActive = true;
	}

	function handleBlur() {
		isActive = false;
	}

	function smoothScrollToTop(element: HTMLElement | Window, duration: number) {
		const start = element === window ? window.scrollY : (element as HTMLElement).scrollTop;
		const change = -start; // 滚动到顶部，目标位置是 0
		const startTime = performance.now();

		function animateScroll(currentTime: number) {
			const elapsed = currentTime - startTime;
			const progress = Math.min(elapsed / duration, 1); // 限制进度在 0 到 1 之间
			const easeInOutQuad = progress < 0.5
				? 2 * progress * progress
				: -1 + (4 - 2 * progress) * progress; // 缓动函数
			const position = start + change * easeInOutQuad;

			if (element === window) {
				window.scrollTo(0, position);
			} else {
				(element as HTMLElement).scrollTop = position;
			}

			if (elapsed < duration) {
				requestAnimationFrame(animateScroll);
			}
		}

		requestAnimationFrame(animateScroll);
	}


	// 处理章节切换
	function handleSwitchChapter(direction: 'prev' | 'next') {
		switchChapter(
			direction,
			currentChapter,
			chapters,
			(newChapter) => {
				currentChapter = newChapter;
				currentChapterId = newChapter.id;
				dispatch('chapterChanged', {chapterId: newChapter.id});
			},
			() => {
				setTimeout(() => {
					const contentElement = document.querySelector('.content-area');
					const duration = 100; // 滚动持续时间（毫秒）

					if (contentElement instanceof HTMLElement) {
						smoothScrollToTop(contentElement, duration);
					}

					smoothScrollToTop(window, duration);
				}, 100);
			}
		);
	}

	function selectChapter(chapter: ChapterProgress) {
		currentChapter = chapter;
		currentChapterId = chapter.id;

		// 根据当前模式滚动到选中的章节（使用防抖优化）
		if (displayMode === 'hover' && hoverChaptersContainer) {
			debouncedScrollToChapter(hoverChaptersContainer);
		} else if (displayMode === 'outline' && outlineChaptersContainer) {
			debouncedScrollToChapter(outlineChaptersContainer);
		} else if (displayMode === 'sidebar' && sidebarChaptersContainer) {
			debouncedScrollToChapter(sidebarChaptersContainer);
		}
	}

	// 初始化阅读会话
	function initializeReadingSession() {
		if (!currentChapter) return;

		startNewSession();

		// 每分钟检查用户活动
		if (readingSessionInterval) clearInterval(readingSessionInterval);
		readingSessionInterval = setInterval(() => {
			const now = Date.now();
			if (now - lastActivityTime > INACTIVITY_THRESHOLD) {
				// 用户不活跃，暂停会话
				if (isReadingActive) {
					endCurrentSession();
				}
			}
		}, 60000); // 每分钟检查一次
	}

	// 开始新会话
	function startNewSession() {
		if (!currentChapter) return;

		sessionStartTime = Date.now();
		isReadingActive = true;
		lastActivityTime = Date.now();

		dispatch('startReading', {
			chapterId: currentChapter.id,
			chapterTitle: currentChapter.title,
			startTime: sessionStartTime
		});
	}

	// 结束当前会话
	function endCurrentSession() {
		if (!isReadingActive || !sessionStartTime) return;

		const sessionEndTime = Date.now();
		const sessionDuration = sessionEndTime - sessionStartTime;

		dispatch('endReading', {
			endTime: sessionEndTime,
			duration: sessionDuration
		});

		isReadingActive = false;
		sessionStartTime = null;
	}

	// 更新用户活动时间
	function updateActivity() {
		lastActivityTime = Date.now();

		// 如果之前不活跃，重新开始会话
		if (!isReadingActive) {
			startNewSession();
		}
	}

	// 处理焦点变化
	function handleVisibilityChange() {
		if (document.hidden) {
			if (isReadingActive) {
				endCurrentSession();
			}
		} else {
			updateActivity();
		}
	}

	// 统一的滚动处理函数
	function scrollToActiveChapter(container: HTMLElement) {
		if (!container || currentChapter === null) return;

		const activeElement = chapterElements.get(currentChapter.id);
		if (!activeElement) return;

		const containerHeight = container.clientHeight;
		const elementOffset = activeElement.offsetTop;
		const elementHeight = activeElement.clientHeight;

		// 计算滚动位置，使当前章节居中显示
		const scrollPosition = elementOffset - (containerHeight / 2) + (elementHeight / 2);

		container.scrollTo({
			top: scrollPosition,
			behavior: 'smooth'
		});
	}

	// 跟踪章节元素
	function setChapterElement(node: HTMLElement, id: number) {
		chapterElements.set(id, node);
		return {
			destroy() {
				chapterElements.delete(id);
			}
		};
	}

	function handleScroll(dir: 'up' | 'down') {
		scrollPage(dir, '.content-area');
	}

	async function handleAddNote(event: CustomEvent) {
		console.log('handleAddNote event:', event.detail);
		closeAllNoteDialogs(); // 先关闭所有笔记弹窗

		selectedTextForNote = event.detail.selectedText;
		selectedTextIndex = event.detail.textIndex;
		selectedTextChapterId = event.detail.chapterId;
		currentLineNumber = event.detail.lineNumber; // 保存行号
		showNoteDialog = true;
	}

	// 4. 修改保存笔记的逻辑以匹配新的渲染方式
	async function handleNoteSave(event: CustomEvent) {
		if (!currentChapter) return;

		if (selectedNote) {
			// 编辑已有笔记
			notes = notes.map(note =>
				note.id === selectedNote?.id
					? {...note, content: event.detail.content, timestamp: Date.now()}
					: note
			);
		} else {
			// 添加新笔记
			const note: Note = {
				id: uuidv4(),
				chapterId: currentChapter.id,
				chapterName: currentChapter.title,
				selectedText: selectedTextForNote,
				content: event.detail.content,
				timestamp: Date.now(),
				textIndex: selectedTextIndex,
				textLength: selectedTextForNote.length,
				lineNumber: currentLineNumber
			};
			notes = [...notes, note];
		}

		await saveNotes();
		closeAllNoteDialogs(); // 保存后关闭所有弹窗

		// 触发更新
		if (currentChapter) {
			currentChapter = {...currentChapter};
		}
	}

	function renderChapterContent(chapter: ChapterProgress) {
		if (!chapter) return [];

		const lines = chapter.content.split('\n');

		// 返回行信息对象数组,包含原始文本和笔记信息
		return lines.map((line, lineIdx) => {
			// 获取这一行的笔记
			const lineNotes = notes.filter(note => note.lineNumber === lineIdx);

			return {
				text: line,
				notes: lineNotes,
				lineNumber: lineIdx
			};
		});
	}

	// 监听章节变化时更新统计
	$: if (currentChapter) {
		loadReadingStats();
	}

	function addNoteMarkers(paragraph: string, chapterId: number, lineIndex: number): string {
		if (!notes || !currentChapter) return paragraph;

		// 筛选当前行的笔记
		const lineNotes = notes.filter(note =>
			note.chapterId === chapterId && note.lineNumber === lineIndex
		);

		if (lineNotes.length === 0) return paragraph;

		let result = paragraph;
		const sortedNotes = [...lineNotes].sort((a, b) => b.textIndex - a.textIndex);

		for (const note of sortedNotes) {
			const start = note.textIndex;
			const end = start + note.textLength;

			if (start >= 0 && end <= result.length) {
				const before = result.slice(0, start);
				const highlighted = result.slice(start, end);
				const after = result.slice(end);

				// 修改这里，给笔记图标添加数据属性和点击事件处理
				result = `${before}<span class="note-highlight" data-note-id="${note.id}">
                ${highlighted}
                <button
                    class="note-marker"
                    data-note-id="${note.id}"
                    onclick="event.stopPropagation(); window.dispatchEvent(new CustomEvent('noteIconClick', {detail: {noteId: '${note.id}'}}))"
                    title="点击查看笔记">
                    ${icons.note}
                </button>
            </span>${after}`;
			}
		}

		return result;
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

	function handleNoteEdit(event: CustomEvent) {
		const {note} = event.detail;
		noteViewerVisible = false; // 关闭查看器
		selectedNote = note;  // 保存当前编辑的笔记
		selectedTextForNote = note.selectedText; // 确保显示正确的选中文本
		showNoteDialog = true;  // 显示编辑对话框
	}

	function handleNoteDialogClose() {
		closeAllNoteDialogs();
	}

	function closeAllNoteDialogs() {
		showNoteDialog = false;
		noteViewerVisible = false;
		selectedNote = null;
		selectedTextForNote = '';
	}

	function handleNoteClick(event: MouseEvent, noteId: string) {
		event.stopPropagation();
		const note = notes.find(n => n.id === noteId);
		if (note) {
			closeAllNoteDialogs(); // 先关闭所有笔记弹窗

			selectedNote = note;
			const target = event.target as HTMLElement;
			const rect = target.getBoundingClientRect();
			noteViewerPosition = {
				x: rect.left,
				y: rect.top
			};
			noteViewerVisible = true;
		}
	}

	// 获取阅读统计
	async function loadReadingStats() {
		if (novel) {
			try {
				readingStats = await plugin.dbService?.getNovelStats(novel.id);
			} catch (error) {
				console.error('Failed to load reading stats:', error);
			}
		}
	}

	async function saveNotes() {
		await notesService.saveNotes(novel.id, novel.title, notes);
	}

	async function loadNotesForNovel() {
		notes = await notesService.loadNotes(novel.id);
	}

</script>

<div class="novel-reader" class:outline-mode={displayMode === 'outline' || displayMode === 'sidebar'}
	 on:mouseenter={() => isActive = true}
	 on:mouseleave={() => isActive = false}
	 on:focus={() => isActive = true}
	 on:blur={() => isActive = false}
	 on:mouseenter={handleFocus}
	 on:mouseleave={handleBlur}>

	<!-- 悬浮章节模式 -->
	{#if displayMode === 'hover'}
		<div class="chapter-trigger"
			 on:mouseenter={handleMouseEnter}
			 on:mouseleave={handleMouseLeave}>
			<div class="chapters-panel"
				 class:visible={isMenuVisible}>
				<div class="chapters-header">
					<div class="header-content">
						<h3>{viewMode === 'chapters' ? '目录' : '页码'}</h3>
						{#if chapters.length > 0}
							<button
								class="view-mode-toggle"
								on:click={toggleViewMode}
								title={viewMode === 'chapters' ? '切换到页码视图' : '切换到目录视图'}
							>
								{viewMode === 'chapters' ? '页码' : '目录'}
							</button>
						{/if}
					</div>
				</div>
				<div class="chapters-scroll"
					 bind:this={hoverChaptersContainer}>
					{#if viewMode === 'chapters'}
						<!-- 目录视图 -->
						{#each chapters as chapter}
							<button
								class="chapter-item"
								class:active={currentChapter?.id === chapter.id}
								use:setChapterElement={chapter.id}
								on:click={() => selectChapter(chapter)}
							>
								{chapter.title}
							</button>
						{/each}
					{:else}
						<!-- 页码视图 -->
						{#each virtualPages as page}
							<button
								class="page-item"
								class:active={page.pageNum === currentPageNum}
								on:click={() => jumpToPage(page.pageNum)}
							>
								<span class="page-title">第 {page.pageNum} 页</span>
								<span class="page-chapter">{page.chapterTitle}</span>
							</button>
						{/each}
					{/if}
				</div>
			</div>
		</div>
	{/if}

	<!-- 大纲章节模式 -->
	{#if displayMode === 'outline'}
		<div class="outline-panel">
			<div class="outline-header">
				<h3>章节大纲</h3>
			</div>
			<div class="outline-scroll"
				 bind:this={outlineChaptersContainer}>
				{#each chapters as chapter}
					<button
						class="chapter-item"
						class:active={currentChapter?.id === chapter.id}
						use:setChapterElement={chapter.id}
						on:click={() => selectChapter(chapter)}
					>
						{chapter.title}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- 侧边栏模式（可折叠） -->
	{#if displayMode === 'sidebar'}
		<div class="sidebar-panel" class:collapsed={isSidebarCollapsed}>
			<div class="sidebar-header">
				<h3>目录</h3>
				<button class="toggle-button" on:click={toggleSidebar} title={isSidebarCollapsed ? '展开' : '折叠'}>
					{isSidebarCollapsed ? '▶' : '◀'}
				</button>
			</div>
			{#if !isSidebarCollapsed}
				<div class="sidebar-scroll"
					 bind:this={sidebarChaptersContainer}>
					{#each chapters as chapter}
						<button
							class="chapter-item"
							class:active={currentChapter?.id === chapter.id}
							use:setChapterElement={chapter.id}
							on:click={() => selectChapter(chapter)}
						>
							{chapter.title}
						</button>
					{/each}
				</div>
			{/if}
		</div>
	{/if}

	<!-- 内容区域 -->
	<div class="content-area">
		{#if viewMode === 'chapters'}
			<!-- 章节模式：显示完整章节 -->
			{#if currentChapter}
				<div class="chapter-content">
					<h2>{currentChapter.title}</h2>
					<div class="content-text">
						{#each currentChapter.content.split('\n') as paragraph, index}
							<p data-line-number={index}>
								{@html addNoteMarkers(paragraph, currentChapter.id, index)}
							</p>
						{/each}
					</div>
				</div>
			{:else}
				<div class="no-chapter">
					请选择要阅读的章节
				</div>
			{/if}
		{:else}
			<!-- 页码模式：只显示当前虚拟页的内容 -->
			{#if currentVirtualPage && currentChapter}
				<div class="chapter-content">
					<h2>
						第 {currentVirtualPage.pageNum} 页
						<span class="page-subtitle">
							来自：{currentVirtualPage.chapterTitle}
						</span>
					</h2>
					<div class="content-text">
						{#each getCurrentPageContent() as paragraph, index}
							<p data-line-number={currentVirtualPage.startLine + index}>
								{@html addNoteMarkers(paragraph, currentChapter.id, currentVirtualPage.startLine + index)}
							</p>
						{/each}
					</div>
					<!-- 页码导航 -->
					<div class="page-navigation-footer">
						<button
							class="nav-button"
							disabled={currentPageNum === 1}
							on:click={() => switchPage('prev')}
						>
							← 上一页
						</button>
						<span class="page-info">
							第 {currentPageNum} 页 / 共 {virtualPages.length} 页
						</span>
						<button
							class="nav-button"
							disabled={currentPageNum === virtualPages.length}
							on:click={() => switchPage('next')}
						>
							下一页 →
						</button>
					</div>
				</div>
			{:else}
				<div class="no-chapter">
					请选择要阅读的页面
				</div>
			{/if}
		{/if}

		<TextSelectionMenu
			novelId={novel?.id || ''}
			chapterId={currentChapter?.id || 0}
			on:addNote={handleAddNote}
		/>

		{#if showNoteDialog}
			<NoteDialog
				isOpen={showNoteDialog}
				selectedText={selectedTextForNote}
				existingNote={selectedNote}
				on:save={handleNoteSave}
				on:close={handleNoteDialogClose}
			/>
		{/if}
	</div>

	{#if selectedNote && noteViewerVisible}
		<NoteViewer
			note={selectedNote}
			position={noteViewerPosition}
			visible={noteViewerVisible}
			on:close={closeAllNoteDialogs}
			on:delete={handleNoteDelete}
			on:edit={handleNoteEdit}
		/>
	{/if}

	<div class="toolbar">
		<ReaderSettingsMenu
			plugin={plugin}
			novel={novel}
			content={content}
			readerType="txt"
			currentChapterId={currentChapter?.id}
			notes={notes}
			readingStats={readingStats}
			on:savePattern={async (event) => {
    try {
      const {novel: updatedNovel, chapters: newChapters} = event.detail;

      // 第一步：保存到数据库
      const saveResult = await plugin.libraryService.updateNovel(updatedNovel);

      if (saveResult) {
        // 第二步：只有保存成功后才更新本地状态
        // 使用不可变方式更新，避免触发额外的响应式更新
        novel = Object.assign({}, updatedNovel);
        chapters = [...newChapters];

        // 第三步：通知视图更新
        window.dispatchEvent(new CustomEvent('chaptersUpdated', {
          detail: {chapters: newChapters}
        }));

        new Notice('章节解析规则已保存');
      }
    } catch (error) {
      console.error('Failed to save pattern:', error);
      new Notice('保存章节解析规则失败');
    }
  }}
			on:deleteNote={async (event) => {
            	await handleNoteDelete(event);
            	// 重新渲染当前章节以更新笔记显示
            	if (currentChapter) {
                	currentChapter = {...currentChapter};
            	}
        	}}
			on:editNote={(event) => {
            	handleNoteEdit(event);
            	showNoteList = false; // 关闭列表面板
        	}}
			on:jumpToChapter={async (event) => {
    			const chapter = chapters.find(ch => ch.id === event.detail.chapterId);
    			if (chapter) {
      				currentChapter = chapter;
      				currentChapterId = chapter.id;
      				// 触发滚动到顶部
      				const contentElement = document.querySelector('.content-area');
      				if (contentElement) {
        				contentElement.scrollTo({top: 0, behavior: 'smooth'});
      				}
    			}
  			}}
		/>
	</div>

</div>

<style>
	.novel-reader {
		height: 100%;
		display: flex;
		position: relative;
		overflow: hidden;
	}

	.novel-reader.outline-mode {
		flex-direction: row;
	}

	/* 悬浮模式样式 */
	.chapter-trigger {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 60px;
		z-index: 100;
	}

	.chapters-panel {
		position: absolute;
		left: -240px;
		top: 0;
		bottom: 0;
		width: 240px;
		background: var(--background-primary);
		border-right: 1px solid var(--background-modifier-border);
		transition: transform 0.3s ease-in-out;
		display: flex;
		flex-direction: column;
		box-shadow: 2px 0 8px rgba(0, 0, 0, 0.1);
		z-index: 101;
	}

	.chapters-panel.visible {
		transform: translateX(240px);
	}

	/* 大纲模式样式 */
	.outline-panel {
		width: 240px;
		min-width: 240px; /* 防止内容挤压 */
		flex-shrink: 0;
		border-right: 1px solid var(--background-modifier-border);
		display: flex;
		flex-direction: column;
		background: var(--background-primary);
	}

	.outline-header {
		padding: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.outline-header h3 {
		margin: 0;
	}

	.outline-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		scroll-behavior: smooth; /* 添加平滑滚动效果 */
	}

	/* 侧边栏模式样式（可折叠） */
	.sidebar-panel {
		width: 240px;
		min-width: 240px;
		flex-shrink: 0;
		border-right: 1px solid var(--background-modifier-border);
		display: flex;
		flex-direction: column;
		background: var(--background-primary);
		transition: width 0.3s ease-in-out, min-width 0.3s ease-in-out;
	}

	.sidebar-panel.collapsed {
		width: 40px;
		min-width: 40px;
	}

	.sidebar-header {
		padding: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.sidebar-header h3 {
		margin: 0;
	}

	.sidebar-panel.collapsed .sidebar-header h3 {
		display: none;
	}

	.toggle-button {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px;
		font-size: 14px;
		transition: color 0.2s;
	}

	.toggle-button:hover {
		color: var(--text-normal);
	}

	.sidebar-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		scroll-behavior: smooth;
	}

	/* 共享样式 */
	.chapters-header {
		padding: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.header-content {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.chapters-header h3 {
		margin: 0;
	}

	.view-mode-toggle {
		padding: 4px 12px;
		border: none;
		border-radius: 4px;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		cursor: pointer;
		font-size: 12px;
		transition: all 0.2s;
	}

	.view-mode-toggle:hover {
		background: var(--interactive-accent-hover);
	}

	.chapters-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		scroll-behavior: smooth; /* 添加平滑滚动效果 */
	}

	.chapter-item {
		width: 100%;
		margin-bottom: 4px;
		border: none;
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		text-align: left;
		white-space: nowrap; /* 防止文本换行 */
		overflow: hidden; /* 隐藏溢出的内容 */
		text-overflow: ellipsis; /* 显示省略号 */
		/* 给省略号留出空间 */
		display: block; /* 改变按钮的默认display行为 */
		padding: 8px 16px 8px 8px;
		color: var(--text-normal);
		transition: background-color 0.2s;
		position: relative; /* 添加相对定位以支持滚动定位 */
	}

	.chapter-item:hover {
		background: var(--background-modifier-hover);
	}

	.chapter-item.active {
		background: var(--background-modifier-active);
		color: var(--text-accent);
	}

	.page-item {
		width: 100%;
		margin-bottom: 4px;
		padding: 8px 12px;
		border: none;
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
		text-align: left;
		color: var(--text-normal);
		transition: background-color 0.2s;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.page-item:hover {
		background: var(--background-modifier-hover);
	}

	.page-item.active {
		background: var(--background-modifier-active);
		color: var(--text-accent);
	}

	.page-title {
		font-weight: 500;
	}

	.page-chapter {
		font-size: 0.85em;
		color: var(--text-muted);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.content-area {
		flex: 1;
		overflow-y: auto;
		padding: 16px 32px;
		min-width: 0;
	}

	.chapter-content {
		max-width: 800px;
		margin: 0 auto;
	}

	.chapter-content h2 {
		margin-bottom: 24px;
		padding-bottom: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.page-subtitle {
		font-size: 0.6em;
		color: var(--text-muted);
		font-weight: normal;
	}

	.page-navigation-footer {
		margin-top: 32px;
		padding-top: 24px;
		border-top: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
	}

	.nav-button {
		padding: 8px 16px;
		border: none;
		border-radius: 4px;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		cursor: pointer;
		font-size: 14px;
		transition: all 0.2s;
	}

	.nav-button:hover:not(:disabled) {
		background: var(--interactive-accent-hover);
	}

	.nav-button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.page-info {
		font-size: 14px;
		color: var(--text-muted);
	}

	.content-text {
		line-height: 1.8;
		font-size: 1.1em;
		user-select: text;
		-webkit-user-select: text;
		-moz-user-select: text;
		-ms-user-select: text;
	}

	.content-text p {
		margin: 1em 0;
		text-indent: 2em;
	}

	.no-chapter {
		text-align: center;
		color: var(--text-muted);
		padding: 32px;
	}

	/* 设置 */
	.toolbar {
		position: fixed;
		top: 13px; /* 原来10px，往下3px变成13px */
		right: 15px; /* 原来10px，往左5px变成15px */
		z-index: 1000;
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

	.settings-body {
		display: flex;
		flex: 1;
		min-height: 0;
	}

	.save-button:hover {
		filter: brightness(1.1);
	}

	.delete-button:hover {
		filter: brightness(1.1);
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

	.settings-nav {
		width: 200px;
		padding: 20px 0;
		border-right: 1px solid var(--background-modifier-border);
		background: var(--background-secondary);
	}

	.nav-item {
		width: 100%;
		padding: 12px 24px;
		display: flex;
		align-items: center;
		gap: 12px;
		background: none;
		border: none;
		color: var(--text-muted);
		font-size: 15px;
		cursor: pointer;
		transition: all 0.2s;
		text-align: left;
	}

	.nav-item:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.nav-item.active {
		background: var(--background-modifier-active);
		color: var(--text-accent);
		font-weight: 500;
	}

	.settings-main {
		flex: 1;
		padding: 24px;
		overflow-y: auto;
	}

	.settings-section {
		max-width: 600px;
		margin: 0 auto;
	}

	.section-header {
		margin-bottom: 24px;
	}

	.section-header h4 {
		margin: 0 0 8px 0;
		font-size: 18px;
		font-weight: 500;
	}

	.section-desc {
		margin: 0;
		color: var(--text-muted);
		font-size: 14px;
	}

	.form-group {
		margin-bottom: 24px;
	}

	.form-group label {
		display: block;
		margin-bottom: 8px;
		font-weight: 500;
	}

	.pattern-input {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.pattern-input input {
		padding: 10px 12px;
		border-radius: 6px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		font-size: 14px;
	}

	.button-group {
		display: flex;
		gap: 8px;
	}

	.save-button,
	.delete-button {
		padding: 8px 16px;
		border-radius: 6px;
		border: none;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		display: flex;
		align-items: center;
		gap: 6px;
		transition: all 0.2s;
	}

	.save-button {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.delete-button {
		background: var(--background-modifier-error);
		color: white;
	}

	.settings-container {
		position: relative;
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
		font-size: 16px;
		opacity: 0.8;
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

	:global(.note-highlight) {
		background-color: var(--novel-color-note-highlight);
		border-radius: 3px;
		display: inline;
		position: relative;
		padding: 2px 0;
		transition: background-color 0.2s ease;
	}

	:global(.note-highlight:hover) {
		background-color: rgba(var(--interactive-accent-rgb), 0.25);
	}

	:global(.note-marker) {
		position: absolute;
		right: -18px; /* 微调右侧距离 */
		top: -14px; /* 上移位置使其位于文字上方 */
		font-size: 14px;
		color: var(--interactive-accent);
		opacity: 0.8;
		cursor: pointer;
		z-index: 2;
		transition: all 0.2s ease;
		padding: 2px;
		border-radius: 4px;
		background: none;
		border: none;
	}

	:global(.note-marker:hover) {
		opacity: 1;
		transform: scale(1.1);
		background-color: rgba(var(--interactive-accent-rgb), 0.1);
	}

	:global(.note-highlight:hover .note-marker) {
		opacity: 1;
	}

	.content-text p {
		position: relative;
		line-height: 1.8;
		margin: 1em 0;
		text-indent: 2em;
		padding-right: 2px; /* 为笔记图标留出空间 */
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
		font-size: 16px;
		opacity: 0.8;
	}

	/* 添加统计相关样式 */
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
		font-size: 16px;
		opacity: 0.8;
	}

</style>
