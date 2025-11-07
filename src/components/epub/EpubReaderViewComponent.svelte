<script lang="ts">
	import {createEventDispatcher, onDestroy, onMount} from 'svelte';
	import {fade} from 'svelte/transition';
	import {v4 as uuidv4} from 'uuid';
	import type NovelReaderPlugin from "../../main";
	import type {Novel, ReadingProgress} from "../../types";
	import type {EpubNote} from "../../types/epub/epub-reader";
	import NoteDialog from "../NoteDialog.svelte";
	import type {EpubBook, EpubChapter, EpubNavigationItem, EpubRendition} from "../../types/epub/epub-rendition";
	import ReaderSettingsMenu from "../setting/ReaderSettingsMenu.svelte";
	import {handleChapterChangeEPUB, parseChapters, switchChapter} from "../../lib/txt.reader/chapter-logic";
	import type {ChapterHistory} from "../../types/reading-stats";
	import {saveReadingProgress} from "../../lib/txt.reader/progress-logic";
	import type {ChapterProgress} from "../../types/txt/txt-reader";
	import type {Note} from "../../types/notes";

	const dispatch = createEventDispatcher();

	export let plugin: NovelReaderPlugin;
	export let novel: Novel;
	export let displayMode: 'hover' | 'outline' | 'sidebar' = 'sidebar';
	export let initialCfi: string | null = null;
	export let savedProgress: ReadingProgress | null = null;
	export let book: EpubBook | null = null;
	export let toc: any[] = [];
	export let chapters: EpubChapter[] = [];

	let rendition: EpubRendition;
	let isLoading = true;
	let showNoteDialog = false;
	let selectedTextForNote = '';
	let notes: EpubNote[] = [];
	let readerContainer: HTMLElement | null = null;
	let currentChapter: EpubChapter | null = null;
	export let currentChapterId: number | null = null;
	const viewInstanceId = `epub-view-${novel.id}-${Date.now()}`;
	// 添加漫画检测逻辑
	let isManga = false;
	let readingStats: any = null;
	let chapterHistory: ChapterHistory[] = []; // 章节历史记录
	let isActive = false;
	let contentLoaded = false;
	let initialChapterId: number | null = null; //初始章节

	let chapterProgressDatas: ChapterProgress[] = []; //当前阅读进度
	let chapterProcessCurrentChapter: ChapterProgress | null = null; //阅读进度格式-章节集合

	let selectedNote: Note | null = null; //笔记
	let noteViewerPosition = {x: 0, y: 0};
	let noteViewerVisible = false;   // 控制笔记查看器显示

	let isReadingActive = false;
	let sessionStartTime: number | null = null;
	let lastActivityTime = Date.now();

	let keydownHandler: (event: KeyboardEvent) => void;

	// hover模式相关状态
	let isMenuVisible = false;

	//添加笔记、右键菜单
	let selectedText = '';
	let currentCfi = '';
	let showMenu = false;

	let menuPosition = {x: 0, y: 0};

	$: if (currentChapter) {
		console.log('EpubReaderViewComponent--->', JSON.stringify(currentChapter))

		handleChapterChangeEPUB(
			currentChapter,
			novel,
			plugin.chapterHistoryService,
			(newHistory) => {
				chapterHistory = newHistory;
			}
		);

		chapterProcessCurrentChapter = {
			id: currentChapter.id,
			title: currentChapter.title,
			content: '',
			startPos: 0,
			endPos: 0,
		};

		currentChapterId = currentChapter.id;

		chapters.forEach(c => {
			const chapterProgress: ChapterProgress = {
				id: c.id,
				title: c.title,
				content: '',
				startPos: 0,
				endPos: 0,
			};
			chapterProgressDatas.push(chapterProgress);
		})

		console.log('EPUB,1---', JSON.stringify(chapterProgressDatas))

		if (currentChapterId !== null && chapters.length > 0) {
			const chapter = chapters.find(c => c.id === currentChapterId);
			if (chapter) {
				console.log('EPUB,准备保存进度.')
				const chapterProgress: ChapterProgress = {
					id: chapter.id,
					title: chapter.title,
					content: '',
					startPos: 0,
					endPos: 0,
				};
				// 无论是通过大纲还是切换章节，只要章节ID变化就保存进度
				saveReadingProgress(novel, chapterProgress, chapterProgressDatas);
			}
		}
	}

	onMount(async () => {
		console.log("Component mounting...");

		// 创建并使用特定实例的内容区域
		const contentArea = document.getElementById(`content-area-${viewInstanceId}`);
		if (!contentArea) {
			console.error('Content area not found');
			return;
		}

		console.log("Content area found, initializing reader...");

		readerContainer = document.createElement('div');
		readerContainer.id = `epub-container-${viewInstanceId}`;
		readerContainer.classList.add('epub-viewer-container');

		contentArea.appendChild(readerContainer);

		await initializeReader();
	});

	onMount(() => {
		if (chapters) {
			//parseAndSetChapters();
			contentLoaded = true;

			console.log('Epub.1---', JSON.stringify(savedProgress))

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

	});

	onMount(() => {
		console.log("Adding keyboard event listener");
		window.addEventListener('keydown', handleKeyDown, {passive: false});
		window.addEventListener('noteIconClick', handleNoteIconClick as EventListener);

		const visibilityHandler = () => {
			isActive = !document.hidden;
		};

		// 监听页面焦点
		document.addEventListener('visibilitychange', visibilityHandler);
		document.addEventListener('visibilitychange', handleVisibilityChange);
		document.addEventListener('click', handleClickOutside);

		// 返回清理函数，移除所有事件监听器
		return () => {
			window.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('noteIconClick', handleNoteIconClick as EventListener);

			document.removeEventListener('visibilitychange', visibilityHandler);
			document.removeEventListener('visibilitychange', handleVisibilityChange);

			document.removeEventListener('click', handleClickOutside);
		};
	});

	// 辅助函数：查找章节对应的spine索引
	function findSpineIndex(chapter: EpubChapter): number | null {
		if (!book || !chapter.href) return null;

		// 清理href
		const cleanHref = chapter.href.split('#')[0].split('?')[0];

		// 在spine中查找匹配的项
		for (let i = 0; i < book.spine.items.length; i++) {
			const spineItem = book.spine.items[i];
			const spineHref = spineItem.href.split('#')[0].split('?')[0];

			// 比较清理后的href，支持相对路径和绝对路径
			if (spineHref === cleanHref || spineHref.endsWith('/' + cleanHref) || cleanHref.endsWith('/' + spineHref)) {
				return i;
			}
		}

		return null;
	}

	// 辅助函数：显示章节内容（带回退机制）
	async function displayChapter(chapter: EpubChapter): Promise<boolean> {
		if (!rendition || !book) return false;

		try {
			// 方法1：尝试使用清理后的href
			const cleanHref = chapter.href.split('#')[0].split('?')[0];
			await rendition.display(cleanHref);
			return true;
		} catch (error) {
			console.warn('Failed to display by href, trying spine index:', error);

			try {
				// 方法2：尝试使用spine索引
				const spineIndex = findSpineIndex(chapter);
				if (spineIndex !== null) {
					await rendition.display(spineIndex);
					return true;
				}
			} catch (spineError) {
				console.error('Failed to display by spine index:', spineError);
			}

			// 方法3：尝试使用原始href（最后的尝试）
			try {
				await rendition.display(chapter.href);
				return true;
			} catch (originalError) {
				console.error('Failed to display chapter by any method:', originalError);
				return false;
			}
		}
	}

	async function initializeReader() {
		if (!readerContainer) {
			console.error('Reader container still not available');
			return;
		}

		try {
			if (!book) {
				return;
			}

			isManga = await isMangaEpub(book, novel, chapters);
			console.log('isManga---' + isManga)

			const container = document.getElementById(`epub-container-${viewInstanceId}`);
			if (!container) {
				throw new Error('Container not found');
			}

			rendition = book.renderTo(container, {
				width: "100%",
				height: "100%",
				flow: "scrolled-doc",         // 漫画模式使用分页
				manager: isManga ? "continuous" : "default",
				orientation: "vertical",
				spread: "none",               // 禁用双页显示
				keyBindings: false  // 禁用默认键盘绑定
			});

			// 添加基本类名到 EPUB 文档
			rendition.hooks.content.register((contents: any) => {
				const body = contents.document.body;
				body.classList.add('epub-doc');

				// 为 iframe 内的文档添加点击事件监听
				contents.document.addEventListener('click', (event: MouseEvent) => {
					// 检查点击是否在选中文本区域外
					const selection = contents.window.getSelection();
					if (!selection || selection.toString().trim() === '') {
						showMenu = false;
						selectedText = '';
					}
				});
			});

			// 加载初始位置或第一页
			if (initialCfi) {
				await rendition.display(initialCfi);
			} else {
				await rendition.display();
			}

			// 设置手势和触摸事件
			rendition.on('touchstart', (event: TouchEvent) => {
				event.preventDefault();
			});
			rendition.on('touchend', (event: TouchEvent) => {
				event.preventDefault();
			});
			// 处理键盘事件
			rendition.on('keyup', (event: KeyboardEvent) => {
				// 阻止默认行为
				//event.preventDefault?.();  // 使用可选链操作符

				if (event.key === 'ArrowLeft') {
					console.log('keyup---ArrowLeft')
				} else if (event.key === 'ArrowRight') {
					console.log('keyup---ArrowRight')
				}

				handleKeyDown(event);
			});

			// 处理文本选择
			rendition.on('selected', handleTextSelection);

			const iframe = document.querySelector("iframe");
			if (iframe) {
				iframe?.contentWindow?.document.addEventListener('contextmenu', (event: MouseEvent) => {
					event.preventDefault();  // 禁用默认右键菜单
					console.log("Right-click disabled inside iframe");
					showMenu = true;
				});
			}

			isLoading = false;

			// 开始阅读会话
			startReadingSession();
		} catch (error) {
			console.error('Error initializing EPUB:', error);
			isLoading = false;
		}
	}

	onDestroy(() => {
		if (rendition) {
			rendition.destroy();
		}
		if (book) {
			book.destroy();
		}

		// 只移除当前实例的容器
		const container = document.getElementById(`epub-container-${viewInstanceId}`);
		if (container) {
			container.remove();
		}

		endReadingSession();

		window.removeEventListener('keydown', handleKeyDown);
	});

	async function handleKeyEvents(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') {
			// await rendition.prev();
			saveProgress();
		} else if (event.key === 'ArrowRight') {
			// await rendition.next();
			saveProgress();
		}
	}

	function handleTextSelection(cfiRange: string, contents: any) {
		const selection = contents.window.getSelection();
		selectedText = selection.toString().trim();

		if (selectedText) {
			currentCfi = cfiRange;

			// 获取EPubJS的iframe元素
			const iframe = document.querySelector(`#epub-container-${viewInstanceId} iframe`);
			if (iframe) {
				const range = selection.getRangeAt(0);
				const rect = range.getBoundingClientRect();

				// 获取iframe的位置
				const iframeRect = iframe.getBoundingClientRect();

				// 计算绝对位置：iframe的偏移量 + 选择区域在iframe中的相对位置
				const absoluteX = iframeRect.left + rect.left + (rect.width / 2);
				// 计算Y轴位置，确保菜单在选中文本下方
				const absoluteY = iframeRect.top + rect.bottom + 5;

				menuPosition = {
					x: absoluteX,
					y: absoluteY
				};
			}
		}
	}

	// 添加右键菜单事件处理
	function handleContextMenu(event: MouseEvent) {
		event.preventDefault();

		if (selectedText) {
			// 使用已经计算好的menuPosition，不需要重新计算
			showMenu = true;
		}
	}

	function handleNoteEdit(event: CustomEvent) {
		const {note} = event.detail;
		selectedNote = note;
		// 确保设置正确的选中文本
		selectedTextForNote = note.selectedText;
		showNoteDialog = true;

		// 重置当前选中的文本，避免影响新增笔记
		selectedText = '';
		currentCfi = '';
	}

	async function handleNoteSave(event: CustomEvent) {
		try {
			if (selectedNote) {
				// 编辑已有笔记
				notes = notes.map(note =>
					note.id === selectedNote?.id
						? {
							...note,
							content: event.detail.content,
							timestamp: Date.now(),
							// 保持原有的选中文本
							selectedText: note.selectedText
						}
						: note
				);
			} else {
				// 添加新笔记
				const note: EpubNote = {
					id: uuidv4(),
					chapterId: currentChapter?.id || 0,
					chapterName: currentChapter?.title || '',
					selectedText: selectedTextForNote, // 使用临时存储的选中文本
					content: event.detail.content,
					timestamp: Date.now(),
					cfi: currentCfi,
					textIndex: 0,
					textLength: selectedText.length,
					lineNumber: 0
				};
				notes = [...notes, note];
			}

			await saveNotes();

			// 清理所有状态
			clearNoteState();
		} catch (error) {
			console.error('Error saving note:', error);
		}
	}

	// 添加状态清理函数
	function clearNoteState() {
		selectedNote = null;
		selectedText = '';
		selectedTextForNote = '';
		currentCfi = '';
		showNoteDialog = false;
		showMenu = false;
	}

	// 修改关闭对话框的处理函数
	function handleNoteDialogClose() {
		clearNoteState();
	}

	async function saveNotes() {
		try {
			const notesData = {
				novelId: novel.id,
				novelName: novel.title,
				notes
			};

			const notesPath = `${plugin.settings.libraryPath}/notes/${novel.id}.json`;
			await plugin.app.vault.adapter.write(
				notesPath,
				JSON.stringify(notesData, null, 2)
			);
		} catch (error) {
			console.error('Failed to save notes:', error);
		}
	}

	async function loadNotes() {
		try {
			const notesPath = `${plugin.settings.libraryPath}/notes/${novel.id}.json`;
			if (await plugin.app.vault.adapter.exists(notesPath)) {
				const data = await plugin.app.vault.adapter.read(notesPath);
				const notesData = JSON.parse(data);
				notes = notesData.notes;
			}
		} catch (error) {
			console.error('Failed to load notes:', error);
			notes = [];
		}
	}

	function saveProgress() {
		if (!rendition || !book) return;

		const progress = {
			novelId: novel.id,
			timestamp: Date.now(),
			position: {
				cfi: rendition.location?.start?.cfi,
				chapterTitle: currentChapter?.title || '',
				percentage: book.locations.percentageFromCfi(rendition.location?.start.cfi)
			}
		};

		dispatch('saveProgress', {progress});
	}

	function startReadingSession() {
		dispatch('startReading', {
			chapterId: currentChapter?.id || 0,
			chapterTitle: currentChapter?.title || ''
		});
	}

	function endReadingSession() {
		dispatch('endReading');
	}

	async function isMangaEpub(book: EpubBook, novel: Novel, chapters: EpubChapter[]): Promise<boolean> {
		// 1. 检查文件名中的关键词
		const pathHasMangaKeyword = novel.path.toLowerCase().includes('manga') ||
			novel.path.toLowerCase().includes('comic') ||
			novel.path.toLowerCase().includes('卷');

		// 2. 检查 spine 数量与章节数的比例
		const spineItemCount = book.spine.length;
		const chapterCount = chapters.length;
		const spineChapterRatio = spineItemCount / (chapterCount || 1);
		const hasHighSpineRatio = spineChapterRatio > 5; // 如果每章平均超过5个文件，可能是漫画

		console.log('Manga.V1 detection results:', {
			spineItemCount,
			chapterCount,
			spineChapterRatio,
			hasHighSpineRatio
		});

		// 3. 检查文件内容特征
		let hasImageDominance = false;
		try {
			// 采样检查前几个章节的内容
			const sampleSize = Math.min(3, book.spine.length);
			let totalImages = 0;
			let totalText = 0;

			for (let i = 0; i < sampleSize; i++) {
				const spineItem = book.spine.get(i);
				const content = await spineItem.load();
				const images = content.querySelectorAll('img');
				const text = content.body.textContent || '';

				totalImages += images.length;
				totalText += text.replace(/\s+/g, '').length;
			}

			// 如果图片数量多且文本较少，很可能是漫画
			hasImageDominance = totalImages > 3 && (totalText / totalImages) < 100;
		} catch (error) {
			console.warn('Error checking content characteristics:', error);
		}

		// 4. 检查元数据中的标题关键词
		const titleHasMangaKeyword = book.package?.metadata?.title?.toLowerCase().includes('卷') ||
			book.package?.metadata?.title?.toLowerCase().includes('vol');

		// 综合判断
		console.log('Manga detection results:', {
			pathHasMangaKeyword,
			hasHighSpineRatio,
			hasImageDominance,
			titleHasMangaKeyword,
			spineChapterRatio
		});

		return pathHasMangaKeyword || hasHighSpineRatio || hasImageDominance || titleHasMangaKeyword;
	}

	function handleFocus() {
		console.log("EPUB,Reader view focused");
		isActive = true;
	}

	function handleBlur() {
		console.log("EPUB,Reader view blurred");
		isActive = false;
	}

	function handleKeyDown(event: KeyboardEvent) {
		console.log("handleKeyDown called with key:", event.key);
		console.log("Active status:", isActive);
		console.log("Event target:", event.target);

		// 检查事件是否已被处理
		if (event.defaultPrevented) {
			console.log("Event was already handled");
			return;
		}

		if (!isActive) {
			console.log("Reader not active, ignoring keypress");
			return;
		}

		if (event.key === 'ArrowLeft') {
			// 向前切换章节
			handleSwitchChapter('prev');
			// 阻止默认行为并停止传播
			//event.preventDefault?.();
		} else if (event.key === 'ArrowRight') {
			// 向后切换章节
			handleSwitchChapter('next');
			// 阻止默认行为并停止传播
			//event.preventDefault?.();
		} else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
			// 处理页面滚动
			const container = document.querySelector(`#epub-container-${viewInstanceId}`);
			if (container) {
				const scrollAmount = 230; // 滚动距离
				const direction = event.key === 'ArrowUp' ? -1 : 1;
				container.scrollBy({
					top: scrollAmount * direction,
					behavior: 'smooth'
				});
			}
			event.preventDefault();
		}
	}

	// 处理章节切换
	async function handleSwitchChapter(direction: 'prev' | 'next') {
		console.log('handleSwitchChapter-1--', direction, currentChapter, chapters)
		if (!currentChapter || !chapters.length) return;

		const currentIndex = chapters.findIndex(ch => ch.id === currentChapter?.id);
		let nextIndex: number;

		if (direction === 'prev') {
			nextIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
		} else {
			nextIndex = currentIndex < chapters.length - 1 ? currentIndex + 1 : currentIndex;
		}

		console.log('handleSwitchChapter-2--', nextIndex, currentIndex)
		if (nextIndex !== currentIndex) {
			const nextChapter = chapters[nextIndex];
			// 更新当前章节并显示
			currentChapter = nextChapter;
			currentChapterId = nextChapter.id;

			// 使用辅助函数显示章节
			await displayChapter(nextChapter);

			// 触发章节更改事件
			dispatch('chapterChanged', {
				chapterId: nextChapter.id,
				chapterTitle: nextChapter.title
			});
		}
	}

	// 添加笔记图标点击事件监听
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

	// 更新用户活动时间
	function updateActivity() {
		lastActivityTime = Date.now();

		// 如果之前不活跃，重新开始会话
		if (!isReadingActive) {
			startNewSession();
		}
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

	async function jumpToChapter(chapterId: number) {
		const chapter = chapters.find(ch => ch.id === chapterId);
		if (chapter) {
			// 更新当前章节
			currentChapter = chapter;
			currentChapterId = chapter.id;

			// 使用辅助函数显示章节
			await displayChapter(chapter);

			// 触发章节切换事件
			dispatch('chapterChanged', {
				chapterId: chapter.id,
				chapterTitle: chapter.title
			});

			// 保存阅读进度
			saveProgress();
		}
	}

	// 处理添加笔记
	async function handleAddNote(event: CustomEvent) {
		// 重置编辑状态
		selectedNote = null;
		if (selectedText) {
			// 确保在打开笔记对话框时选中文本仍然存在
			selectedTextForNote = selectedText;
			showNoteDialog = true;
			showMenu = false; // 关闭菜单
		}
	}

	async function handleCopy() {
		if (selectedText) {
			try {
				await navigator.clipboard.writeText(selectedText);
				showMenu = false; // 关闭菜单
			} catch (err) {
				console.error('Failed to copy text:', err);
			}
		}
	}

	function handleClickOutside(event: MouseEvent) {
		// 检查点击是否在菜单外部
		const target = event.target as HTMLElement;
		const menuElement = document.querySelector('.selection-menu');

		if (menuElement && !menuElement.contains(target)) {
			// 如果点击不在菜单内，并且不是正在选择文本，则隐藏菜单
			const selection = window.getSelection();
			if (!selection || selection.toString().trim() === '') {
				showMenu = false;
				selectedText = '';
			}
		}
	}

	// hover模式事件处理
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

</script>

<div
	class="epub-reader"
	class:outline-mode={displayMode === 'outline'}
	on:mouseenter={() => {
    	console.log("Mouse entered EPUB reader");
    	isActive = true;
  	}}
	on:mouseleave={() => {
    	console.log("Mouse left EPUB reader");
    	isActive = false;
  	}}
	on:focus={() => {
    	console.log("EPUB reader focused");
    	isActive = true;
  	}}
	on:blur={() => {
    	console.log("EPUB reader blurred");
    	isActive = false;
  	}}
	tabindex="0"
>

	<!-- 悬浮章节模式 -->
	{#if displayMode === 'hover'}
		<div class="chapter-trigger"
			 on:mouseenter={handleMouseEnter}
			 on:mouseleave={handleMouseLeave}>
			<div class="chapters-panel"
				 class:visible={isMenuVisible}>
				<div class="chapters-header">
					<h3>目录</h3>
				</div>
				<div class="chapters-scroll">
					{#each chapters as chapter}
						<button
							class="chapter-item"
							class:active={currentChapter?.href === chapter.href}
							class:level-0={chapter.level === 0}
							class:level-1={chapter.level === 1}
							style="margin-left: {chapter.level === 1 ? '20px' : '0'}"
							on:click={async () => {
								const success = await displayChapter(chapter);
								if (success) {
									currentChapter = chapter;
									saveProgress();
								}
							}}
						>
							<span class="chapter-indent">
								{#if chapter.level === 1}
									<span class="chapter-bullet">•</span>
								{/if}
								{chapter.title}
							</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	{/if}

	{#if displayMode === 'outline' || displayMode === 'sidebar'}
		<div class="outline-panel" transition:fade>
			<div class="outline-header">
				<h3>目录</h3>
			</div>
			<div class="outline-content">
				{#each chapters as chapter}
					<button
						class="chapter-item"
						class:active={currentChapter?.href === chapter.href}
						class:level-0={chapter.level === 0}
						class:level-1={chapter.level === 1}
						style="margin-left: {chapter.level === 1 ? '20px' : '0'}"
						on:click={async () => {
							// 使用辅助函数显示章节
							const success = await displayChapter(chapter);
							if (success) {
								currentChapter = chapter;
								saveProgress();
							}
    					}}
					>
    					<span class="chapter-indent">
        					{#if chapter.level === 1}
            					<span class="chapter-bullet">•</span>
        					{/if}
							{chapter.title}
						</span>
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<div class="content-area" id={`content-area-${viewInstanceId}`}>
		{#if isLoading}
			<div class="loading">加载中...</div>
		{/if}

		<!-- 添加文本选择菜单 -->
		{#if showMenu}
			<div
				class="selection-menu"
				style="left: {menuPosition.x}px; top: {menuPosition.y}px"
				on:click|stopPropagation
			>
				<button class="menu-item" on:click={handleCopy}>
					复制
				</button>
				<button class="menu-item" on:click={handleAddNote}>
					添加笔记
				</button>
			</div>
		{/if}

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


</div>

<div class="toolbar">
	<ReaderSettingsMenu
		plugin={plugin}
		novel={novel}
		readerType="epub"
		currentChapterId={currentChapter?.id}
		notes={notes}
		readingStats={readingStats}
		on:jumpToChapter={async (event) => {
    		await jumpToChapter(event.detail.chapterId);
  		}}
		on:editNote={handleNoteEdit}
	/>
</div>

<style>
	/* 设置 */
	.toolbar {
		position: fixed;
		top: 30px;
		right: 10px;
		z-index: 1000;
	}

	.epub-reader {
		height: 100%;
		display: flex;
		flex-direction: row; /* 确保水平布局 */
		position: relative;
		overflow: hidden;
	}

	.epub-reader.outline-mode {
		flex-direction: row;
	}

	/* 悬浮模式样式 */
	.chapter-trigger {
		position: absolute;
		left: 0;
		top: 0;
		bottom: 0;
		width: 40px;
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

	.chapters-header {
		padding: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.chapters-header h3 {
		margin: 0;
	}

	.chapters-scroll {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
		scroll-behavior: smooth;
	}

	/* 大纲和侧边栏模式样式 */
	.outline-panel {
		width: 240px;
		flex-shrink: 0; /* 防止收缩 */
		border-right: 1px solid var(--background-modifier-border);
		display: flex;
		flex-direction: column;
		background: var(--background-primary);
		z-index: 10;
	}

	.outline-header {
		padding: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.outline-content {
		flex: 1;
		overflow-y: auto;
		padding: 8px;
	}

	.chapter-item {
		width: calc(100% - 20px); /* 减去可能的缩进空间 */
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
		font-size: 14px;
	}

	.chapter-item:hover {
		background: var(--background-modifier-hover);
	}

	.chapter-item.active {
		background: var(--background-modifier-active);
		color: var(--text-accent);
		font-weight: 500;
	}

	.chapter-indent {
		display: flex;
		align-items: center;
		width: 100%;
		padding-left: 28px; /* 调整缩进距离 */
	}

	.chapter-bullet {
		font-size: 12px;
		margin-right: 6px;
		color: var(--text-muted);
		margin-left: -14px; /* 调整圆点的位置 */
	}

	/* 大章节保持原样 */
	.chapter-item.level-0 {
		font-weight: 500;
		color: var(--text-normal);
		border-bottom: 1px solid var(--background-modifier-border);
		margin-top: 8px;
	}

	/* 修改小章节的样式 */
	.chapter-item.level-1 {
		font-size: 13px;
		color: var(--text-muted);
		padding-top: 4px;
		padding-bottom: 4px;
		padding-left: 0; /* 移除左内边距 */
		margin-left: -8px; /* 向左移动以对齐 • 符号 */
	}

	.chapter-item.level-1:hover {
		color: var(--text-normal);
	}

	.chapter-item.level-1.active {
		font-weight: 500;
	}

	.content-area {
		flex: 1;
		overflow: hidden;
		position: relative;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		height: 100%;
		color: var(--text-muted);
		font-size: 1.2em;
	}

	.toolbar {
		position: fixed;
		top: 16px;
		right: 16px;
		z-index: 1000;
	}

	:global(.epub-viewer-container) {
		width: 100%;
		height: 100%;
		overflow-y: auto !important;
	}

	/* EPUB iframe 内部样式 */
	:global(.epub-viewer-container iframe) {
		width: 100% !important;
		height: 100% !important;
	}

	/* EPUB 文档样式 */
	:global(.epub-doc) {
		padding: 20px 40px !important;
		line-height: 1.6 !important;
		font-size: 16px !important;
	}

	:global(.epub-doc p) {
		margin: 1em 0 !important;
	}

	/* 漫画阅读器相关样式 */
	:global(.epub-viewer-container.manga-mode) {
		width: 100%;
		height: 100%;
		overflow-y: auto !important;
		scroll-behavior: smooth;
	}

	:global(.epub-viewer-container.manga-mode iframe) {
		width: 100% !important;
		min-height: 100% !important;
		border: none !important;
	}

	:global(.manga-content) {
		margin: 0 !important;
		padding: 0 !important;
		line-height: 0 !important;
	}

	:global(.manga-content img) {
		max-width: 100% !important;
		height: auto !important;
		display: block !important;
		margin: 0 auto !important;
	}

	/* 优化滚动条样式 */
	:global(.epub-viewer-container.manga-mode::-webkit-scrollbar) {
		width: 8px;
	}

	:global(.epub-viewer-container.manga-mode::-webkit-scrollbar-track) {
		background: var(--background-primary);
	}

	:global(.epub-viewer-container.manga-mode::-webkit-scrollbar-thumb) {
		background: var(--background-modifier-border);
		border-radius: 4px;
	}

	:global(.epub-viewer-container.manga-mode::-webkit-scrollbar-thumb:hover) {
		background: var(--background-modifier-hover);
	}

	.selection-menu {
		position: fixed;
		z-index: 1000;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		padding: 4px;
		transform: translate(-50%, -50%);
	}

	/* 添加显示隐藏的动画效果 */
	.selection-menu.entering {
		opacity: 0;
		transform: translate(-50%, 10px);
	}

	.selection-menu.visible {
		opacity: 1;
		transform: translate(-50%, 0);
	}

	.menu-item {
		display: block;
		padding: 6px 12px;
		min-width: 100px;
		background: none;
		border: none;
		cursor: pointer;
		color: var(--text-normal);
		font-size: 14px;
		border-radius: 4px;
		text-align: left;
		width: 100%;
		transition: background-color 0.2s;
	}

	.menu-item:hover {
		background-color: var(--background-modifier-hover);
	}

	.menu-item + .menu-item {
		margin-top: 2px;
	}


</style>
