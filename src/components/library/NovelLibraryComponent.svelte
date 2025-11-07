<script lang="ts">
	import {createEventDispatcher, onMount} from 'svelte';
	import type {Novel} from "../../types";
	import type {Category, CustomShelf, Shelf, Tag} from '../../types/shelf';
	import CategoryManagerModal from "../CategoryManagerModal.svelte";
	import ShelfManagerModal from "../ShelfManagerModal.svelte";
	import {cubicInOut, cubicOut} from "svelte/easing";
	import {Notice} from "obsidian";
	import type NovelReaderPlugin from "../../main";
	import {slide} from 'svelte/transition';
	import TagManagerModal from "../TagManagerModal.svelte";

	const dispatch = createEventDispatcher();

	export let novels = [] as Novel[];
	export let shelves = [] as Shelf[];
	export let tags = [] as Tag[];
	export let categories = [] as Category[];
	export let customShelves: CustomShelf[] = [];
	export let plugin: NovelReaderPlugin;

	// 标签和分类管理的状态
	let showTagManager = false;
	let showCategoryManager = false;
	let currentNovel: Novel | null = null;
	// 添加分类筛选的状态
	let currentCategoryId = '';

	let currentShelf = 'all';
	let selectedTags: string[] = [];
	let sortField: 'lastRead' | 'addTime' | 'title' = 'lastRead';
	let sortOrder: 'asc' | 'desc' = 'desc';
	let searchQuery = '';
	let currentView = 'library'; // 当前视图：library, favorites, notes, shelf:id
	let isComposing = false;
	let actualSearchQuery = '';
	let activeMenuNovel: Novel | null = null;
	let menuPosition: {
		direction: 'bottom' | 'top' | 'left',
		alignment: 'left' | 'right'
	} | null = null;

	// 添加状态变量
	let showShelfManager = false;
	let showAdvancedFilter = false;  // 控制高级筛选的显示/隐藏
	// 筛选后的图书列表
	let filteredNovels = novels;
	let showNewShelfForm = false;
	let newShelfName = '';
	export let selectedShelfId: string | null = null;

	$: novelsList = novels || [];

	$: filteredNovels = novels
		.filter(novel => {
			// 基础视图筛选
			let isInView = true;
			if (currentView === 'favorites') {
				isInView = plugin.customShelfService.isFavorite(novel.id);
			} else if (currentView === 'notes') {
				isInView = !!novel.notePath;
			} else if (currentView.startsWith('shelf:')) {
				const shelfId = currentView.split(':')[1];
				isInView = novel.shelfId === shelfId;
			}
			if (!isInView) return false;

			// 搜索过滤
			const matchesSearch = novel.title.toLowerCase().includes(searchQuery.toLowerCase());

			// 书架过滤
			const matchesShelf = currentShelf === 'all' || novel.shelfId === currentShelf;

			// 分类过滤
			const matchesCategory = !currentCategoryId || novel.categoryId === currentCategoryId;

			// 标签过滤
			const matchesTags = selectedTags.length === 0 ||
				selectedTags.every(tagId => novel.tags?.includes(tagId));

			return matchesSearch && matchesShelf && matchesCategory && matchesTags && isInView;
		})
		.sort((a, b) => {
			let compareResult = 0;
			if (sortField === 'lastRead') {
				const aTime = a.lastRead || 0;
				const bTime = b.lastRead || 0;
				compareResult = aTime - bTime;
			} else if (sortField === 'addTime') {
				compareResult = a.addTime - b.addTime;
			} else {
				compareResult = a.title.localeCompare(b.title);
			}
			return sortOrder === 'desc' ? -compareResult : compareResult;
		});

	// 确保在组件的最顶部添加响应式声明
	$: {
		if (currentView === 'favorites') {
			(async () => {
				const favoriteIds = await plugin.customShelfService.getFavoriteNovels();
				filteredNovels = novels.filter(novel => favoriteIds.includes(novel.id));
			})();
		}
	}

	onMount(() => {
		document.addEventListener('click', handleClickOutside);
		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	});

	export let onAddNovel = async () => {
		console.log('Default onAddNovel');
	};
	export let onRemoveNovel = async (novel: Novel) => {
		console.log('Default onRemoveNovel', novel);
	};
	export let onOpenNovel = async (novel: Novel) => {
		console.log('Default onOpenNovel', novel);
	};
	export let onOpenNovelChapter = async (novel: Novel) => {
		console.log('Default onOpenNovelChapter', novel);
	};
	export let onOpenNote = async (novel: Novel) => {
		console.log('Default onOpenNote', novel);
	};
	export let onUpdateNovel = async (novel: Novel) => {
		console.log('Default onUpdateNovel', novel);
	};
	export let onCreateTag = async (name: string, color: string) => {
		console.log('Default onCreateTag', name, color);
	};
	export let onDeleteTag = async (tagId: string) => {
		console.log('Default onDeleteTag', tagId);
	};
	export let onCreateCategory = async (name: string) => {
		console.log('Default onCreateCategory', name);
	};
	export let onDeleteCategory = async (categoryId: string) => {
		console.log('Default onDeleteCategory', categoryId);
	};

	// 处理输入法事件
	function handleCompositionStart() {
		isComposing = true;
	}

	function handleCompositionEnd(event: CompositionEvent) {
		isComposing = false;
		actualSearchQuery = searchQuery;
	}

	function handleInput() {
		if (!isComposing) {
			actualSearchQuery = searchQuery;
		}
	}

	function toggleMenu(event: MouseEvent, novel: Novel) {
		event.stopPropagation();

		if (activeMenuNovel === novel) {
			activeMenuNovel = null;
			menuPosition = null;
			return;
		}

		activeMenuNovel = novel;

		// 获取按钮元素和其位置信息
		const button = event.currentTarget as HTMLElement;
		const buttonRect = button.getBoundingClientRect();
		const cardElement = (button.closest('.book-card') as HTMLElement);
		const cardRect = cardElement.getBoundingClientRect();

		// 获取图书库容器的边界
		const libraryContainer = document.querySelector('.library-container') as HTMLElement;
		const libraryRect = libraryContainer.getBoundingClientRect();

		// 计算关键距离 - 使用容器边界而不是视口
		const distanceToBottom = libraryRect.bottom - buttonRect.bottom;
		const distanceToRight = libraryRect.right - cardRect.right;
		const spaceOnLeft = cardRect.left - libraryRect.left;

		// 智能判断菜单显示方向
		if (distanceToRight < 180) { // 右侧空间不足
			if (spaceOnLeft >= 180) { // 左侧有足够空间
				menuPosition = {
					direction: 'left',
					alignment: 'right'
				};
			} else { // 左右两侧都空间不足，向下展示并右对齐
				menuPosition = {
					direction: 'bottom',
					alignment: 'right'
				};
			}
		} else { // 右侧有足够空间
			if (distanceToBottom < 200) { // 底部空间不足，向上展示
				menuPosition = {
					direction: 'top',
					alignment: 'left'
				};
			} else { // 默认向下右侧展示
				menuPosition = {
					direction: 'bottom',
					alignment: 'left'
				};
			}
		}
	}

	// 处理移除
	async function handleRemove(novel: Novel, event: MouseEvent) {
		event.stopPropagation();
		closeMenu();
		await onRemoveNovel(novel);
	}

	// 关闭菜单
	function closeMenu() {
		activeMenuNovel = null;
		menuPosition = null;
	}

	function getProgressClass(progress: number): string {
		if (progress === 0) return 'progress-new';
		if (progress === 100) return 'progress-finished';
		return 'progress-reading';
	}

	function formatLastRead(timestamp: number): string {
		const date = new Date(timestamp);
		const now = new Date();
		const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

		if (diffDays === 0) return '今天';
		if (diffDays === 1) return '昨天';
		if (diffDays < 7) return `${diffDays}天前`;
		if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
		return `${Math.floor(diffDays / 30)}月前`;
	}

	// 点击外部关闭菜单
	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		const isMenuClick = target.closest('.more-menu');
		const isButtonClick = target.closest('.more-button');

		if (!isMenuClick && !isButtonClick) {
			closeMenu();
		}
	}

	// 判断是否为新书的函数
	function isNewBook(novel: Novel): boolean {
		const sevenDays = 7 * 24 * 60 * 60 * 1000;
		return Date.now() - novel.addTime < sevenDays && (!novel.progress || novel.progress === 0);
	}

	// 处理笔记打开
	async function handleOpenNote(novel: Novel, event: MouseEvent) {
		event.stopPropagation();
		closeMenu();
		await onOpenNote(novel);
	}

	// 修改处理函数，在函数内部进行类型检查
	async function handleRemoveWithCheck(novel: Novel | null, event: MouseEvent) {
		if (novel) {
			await handleRemove(novel, event);
		}
	}

	async function handleOpenNoteWithCheck(novel: Novel | null, event: MouseEvent) {
		if (novel) {
			await handleOpenNote(novel, event);
		}
	}

	export let onOpenStats = async (novel: Novel) => {
		console.log('Default onOpenStats', novel);
	};

	// 打开"阅读统计视图"
	async function handleOpenStats(novel: Novel | null, event: MouseEvent) {
		event.stopPropagation();
		closeMenu();
		if (novel) {
			await onOpenStats(novel);
		}
	}

	// 添加刷新方法
	function handleRefresh() {
		console.log('Refresh triggered');
		dispatch('refresh');
	}

	// 获取书架颜色（使用CSS变量）
	function getShelfColor(shelfId: string): string {
		switch (shelfId) {
			case 'reading':
				return 'var(--novel-color-shelf-reading)';
			case 'toread':
				return 'var(--novel-color-shelf-toread)';
			case 'finished':
				return 'var(--novel-color-shelf-finished)';
			default:
				return 'var(--novel-color-shelf-archived)';
		}
	}

	// 获取书架名称
	function getShelfName(shelfId: string): string {
		const shelf = shelves.find(s => s.id === shelfId);
		return shelf?.name || '未分类';
	}

	// 获取标签颜色（使用CSS变量作为默认值）
	function getTagColor(tagId: string): string {
		const tag = tags.find(t => t.id === tagId);
		return tag?.color || 'var(--novel-color-shelf-archived)';
	}

	// 获取标签名称
	function getTagName(tagId: string): string {
		const tag = tags.find(t => t.id === tagId);
		return tag?.name || '';
	}

	// 标签管理相关方法
	function handleTagManage(novel: Novel | null, event: MouseEvent) {
		event.stopPropagation();
		currentNovel = novel;
		showTagManager = true;
		closeMenu();
	}

	async function handleTagSave(event: CustomEvent) {
		const {novelId, tagIds} = event.detail;
		const novel = novels.find(n => n.id === novelId);
		if (novel) {
			novel.tags = tagIds;
			await onUpdateNovel(novel);
			showTagManager = false;
			currentNovel = null;
		}
	}

	// 分类管理相关方法
	function handleCategoryManage(novel: Novel | null, event: MouseEvent) {
		event.stopPropagation();
		currentNovel = novel;
		showCategoryManager = true;
		closeMenu();
	}

	async function handleCategorySave(event: CustomEvent) {
		const {novelId, categoryId} = event.detail;
		const novel = novels.find(n => n.id === novelId);
		if (novel) {
			novel.categoryId = categoryId;
			await onUpdateNovel(novel);
			showCategoryManager = false;
			currentNovel = null;
		}
	}

	function handleCreateTag(event: CustomEvent) {
		const {name, color} = event.detail;
		onCreateTag(name, color);
	}

	function handleDeleteTag(event: CustomEvent) {
		const {tagId} = event.detail;
		onDeleteTag(tagId);
	}

	function handleCreateCategory(event: CustomEvent) {
		const {name} = event.detail;
		onCreateCategory(name);
	}

	function handleDeleteCategory(event: CustomEvent) {
		const {categoryId} = event.detail;
		onDeleteCategory(categoryId);
	}

	// 书架管理相关方法
	function handleShelfManage(novel: Novel | null, event: MouseEvent) {
		event.stopPropagation();
		currentNovel = novel;
		showShelfManager = true;
		closeMenu();
	}

	async function handleShelfSave(event: CustomEvent) {
		const {novelId, shelfId} = event.detail;
		const novel = novels.find(n => n.id === novelId);
		if (novel) {
			novel.shelfId = shelfId;
			await onUpdateNovel(novel);
			showShelfManager = false;
			currentNovel = null;
		}
	}

	// 高级筛选切换
	function toggleAdvancedFilter() {
		showAdvancedFilter = !showAdvancedFilter;
	}

	// 处理视图切换
	async function handleViewChange(view: string) {
		currentView = view;
		// 重置其他筛选条件
		currentShelf = 'all';
		selectedTags = [];
		searchQuery = '';

		// 刷新显示
		await refresh();
	}

	// 获取书架名称
	function getCurrentShelfName(view: string): string {
		if (view.startsWith('shelf:')) {
			const shelfId = view.split(':')[1];
			const shelf = customShelves.find(s => s.id === shelfId);
			return shelf ? shelf.name : '书架';
		}
		return '图书库';
	}

	// 切换喜爱状态
	async function toggleFavorite(novel: Novel | null) {
		if (!novel) return;

		try {
			if (isFavorite(novel.id)) {
				// 取消喜爱
				await plugin.customShelfService.removeFromFavorites(novel.id);
				new Notice(`已从喜爱中移除《${novel.title}》`);
			} else {
				// 添加喜爱
				await plugin.customShelfService.addToFavorites(novel.id);
				new Notice(`已添加《${novel.title}》到喜爱`);
			}

			// 如果当前在喜爱视图，需要立即刷新显示
			if (currentView === 'favorites') {
				// 获取最新的喜爱列表
				const favoriteIds = await plugin.customShelfService.getFavoriteNovels();
				// 更新显示的小说列表
				filteredNovels = novels.filter(n => favoriteIds.includes(n.id));
			}
		} catch (error) {
			console.error('Error toggling favorite:', error);
			new Notice('操作失败');
		}
	}

	// 检查是否收藏
	function isFavorite(novelId: string): boolean {
		return plugin.customShelfService.isFavorite(novelId);
	}

	// 添加到自定义书架
	async function addToCustomShelf(novel: Novel | null, shelf: CustomShelf) {
		try {
			if (!novel) {
				return;
			}

			await plugin.customShelfService.addToCustomShelf(novel.id, shelf.id);
			// 如果当前在该书架视图，需要刷新列表
			if (currentView === `shelf:${shelf.id}`) {
				await refresh();
			}
			new Notice(`已添加《${novel.title}》到"${shelf.name}"`);
		} catch (error) {
			console.error('Error adding to custom shelf:', error);
			new Notice('添加失败');
		}
	}

	// 添加刷新方法
	async function refresh() {
		try {
			novels = await getBaseNovelsList();  // 更新基础数据集

			// filteredNovels 会自动基于新的 novels 重新计算
		} catch (error) {
			console.error('Error refreshing novels:', error);
			new Notice('刷新图书失败');
		}
	}

	// 在"全部图书"按钮的点击事件中调用刷新
	function switchToAllBooks() {
		currentView = 'library';
		refresh();
	}

	// 添加侧边栏状态控制
	let showSidebar = false;

	// 切换侧边栏
	function toggleSidebar() {
		showSidebar = !showSidebar;
	}

	// 处理创建新书架
	async function handleCreateShelf() {
		if (newShelfName.trim()) {
			dispatch('createCustomShelf', {
				name: newShelfName
			});
			newShelfName = '';
			showNewShelfForm = false;
		}
	}

	// 切换视图
	function switchView(view: string) {
		dispatch('viewChange', {view});
		currentView = view;
		selectedShelfId = null;
	}

	// 选择书架
	function selectShelf(shelfId: string) {
		dispatch('selectShelf', {shelfId});
		selectedShelfId = shelfId;
		currentView = 'customShelf';
	}

	async function getBaseNovelsList(): Promise<Novel[]> {
		switch (currentView) {
			case 'favorites': {
				const favoriteIds = await plugin.customShelfService.getFavoriteNovels();
				return novels.filter(novel => favoriteIds.includes(novel.id));
			}
			case 'notes':
				return novels.filter(novel => novel.notePath);
			default:
				if (currentView.startsWith('shelf:')) {
					const shelfId = currentView.split(':')[1];
					const shelfNovels = await plugin.customShelfService.getCustomShelfNovels(shelfId);
					return novels.filter(novel => shelfNovels.includes(novel.id));
				}
				return novels;
		}
	}

	async function handleOpenChapterGrid(novel: Novel | null, event: MouseEvent) {
		if (!novel) {
			return;
		}
		event.stopPropagation();
		closeMenu();

		await onOpenNovelChapter(novel);
	}

</script>

<div class="library-container">
	<div class="toolbar-container">
		<div class="toolbar">
			<div class="toolbar-left">
				<button
					class="sidebar-toggle"
					class:active={showSidebar}
					on:click={toggleSidebar}
					title={showSidebar ? '隐藏侧边栏' : '显示侧边栏'}
				>
					≡
				</button>

				<button type="button" on:click={() => onAddNovel()} class="add-button">
					添加图书
				</button>
				<!-- 添加刷新按钮 -->
				<button type="button" on:click={handleRefresh} class="refresh-button">
					<span class="refresh-icon">🔄</span>
					刷新
				</button>
				<button
					type="button"
					on:click={toggleAdvancedFilter}
					class="advanced-filter-button"
					class:active={showAdvancedFilter}
				>
					<span class="filter-icon">🔍</span>
					高级筛选
				</button>
			</div>
			<div class="toolbar-right">
				<select
					bind:value={sortField}
					class="sort-select"
				>
					<option value="lastRead">最近阅读</option>
					<option value="addTime">添加时间</option>
					<option value="title">书名</option>
				</select>

				<button
					class="order-button"
					on:click={() => sortOrder = sortOrder === 'asc' ? 'desc' : 'asc'}
				>
					{sortOrder === 'asc' ? '↑' : '↓'}
				</button>

				<input
					type="text"
					bind:value={searchQuery}
					on:compositionstart={handleCompositionStart}
					on:compositionend={handleCompositionEnd}
					on:input={handleInput}
					placeholder="搜索图书..."
					class="search-input"
				/>
			</div>
		</div>
	</div>

	<!-- 条件渲染筛选器区域 -->
	{#if showAdvancedFilter}
		<div class="advanced-filters"
			 transition:slide={{
            	duration: 50,
            	easing: cubicInOut
        	}}
		>
			<!-- 添加书架选择器 -->
			<div class="shelf-selector">
				<div class="shelf-tabs">
					{#each shelves as shelf}
						<button
							class="shelf-tab"
							class:active={currentShelf === shelf.id}
							on:click={() => currentShelf = shelf.id}
						>
							{shelf.name}
							{#if shelf.count !== undefined}
								<span class="count">({shelf.count})</span>
							{/if}
						</button>
					{/each}
				</div>

				<!-- 添加分类选择器 -->
				<div class="category-selector">
					<select
						bind:value={currentCategoryId}
						class="category-select"
					>
						<option value="">全部分类</option>
						{#each categories as category}
							<option value={category.id}>
								{category.name}
							</option>
						{/each}
					</select>
				</div>
			</div>

			<!-- 添加标签选择器 -->
			<div class="tags-container">
				{#each tags as tag}
					<button
						class="tag-button"
						class:selected={selectedTags.includes(tag.id)}
						style="background-color: {tag.color || 'var(--interactive-accent)'}"
						on:click={() => {
                    if (selectedTags.includes(tag.id)) {
                        selectedTags = selectedTags.filter(t => t !== tag.id);
                    } else {
                        selectedTags = [...selectedTags, tag.id];
                    }
                }}
					>
						{tag.name}
					</button>
				{/each}
			</div>
		</div>
	{/if}

	<!-- 根据当前视图显示相应的标题 -->
	<div class="view-header">
		{#if currentView === 'favorites'}
			<h2>我的喜爱</h2>
		{:else if currentView.startsWith('shelf:')}
			<h2>{getCurrentShelfName(currentView)}</h2>
		{:else}
			<h2>图书库</h2>
		{/if}
	</div>

	<!-- 内容包装器 -->
	<div class="content-wrapper" class:with-sidebar={showSidebar}>
		<!-- 侧边栏 -->
		{#if showSidebar}
			<div
				class="sidebar"
				transition:slide={{
            		duration: 300,
            		easing: cubicOut
        		}}
			>
				<div class="sidebar-content">
					<div class="sidebar-section">
						<button
							class="sidebar-item"
							class:active={currentView === 'library'}
							on:click={switchToAllBooks}
						>
							<span class="icon">📚</span>
							全部图书
						</button>

						<button
							class="sidebar-item"
							class:active={currentView === 'favorites'}
							on:click={() => switchView('favorites')}
						>
							<span class="icon">❤️</span>
							我的喜爱
						</button>
					</div>

					<div class="sidebar-divider"></div>

					<div class="sidebar-section">
						<div class="sidebar-header">
							<span>收藏书架</span>
							<button
								class="add-shelf-button"
								on:click={() => showNewShelfForm = !showNewShelfForm}
							>
								+
							</button>
						</div>

						{#if showNewShelfForm}
							<div class="new-shelf-form">
								<input
									type="text"
									bind:value={newShelfName}
									placeholder="输入书架名称"
								/>
								<div class="form-buttons">
									<button
										on:click={handleCreateShelf}
										disabled={!newShelfName.trim()}
									>
										创建
									</button>
									<button
										class="cancel"
										on:click={() => {
                                            showNewShelfForm = false;
                                            newShelfName = '';
                                        }}
									>
										取消
									</button>
								</div>
							</div>
						{/if}

						{#each customShelves as shelf}
							<button
								class="sidebar-item"
								class:active={currentView === `shelf:${shelf.id}`}
								on:click={() => selectShelf(shelf.id)}
							>
								<span class="icon">📚</span>
								{shelf.name}
								<span class="count">({shelf.novels.length})</span>
							</button>
						{/each}
					</div>
				</div>
			</div>
		{/if}

		<!-- 主内容区域 -->
		<div class="main-content">
			<div class="books-grid">
				{#if filteredNovels.length > 0}
					{#each filteredNovels as novel}
						<div class="book-card" on:click={() => onOpenNovel(novel)}>
							<div class="book-cover-wrapper">
								{#if novel.cover}
									<img
										src={novel.cover}
										alt={novel.title}
										class="book-cover"
										on:error={() => {
                        					novel.cover = undefined;
                    					}}
									/>
								{:else}
									<div class="book-cover placeholder">
										<span>📚</span>
									</div>
								{/if}
							</div>

							<div class="book-info">
								<h3 class="book-title">{novel.title}</h3>

								<div class="book-tags">
									{#if novel.shelfId}
                    					<span class="status-tag"
											  style="background-color: {getShelfColor(novel.shelfId)}">
                        					{getShelfName(novel.shelfId)}
                    					</span>
									{/if}

									{#each novel.tags || [] as tagId}
										{#if tags.find(t => t.id === tagId)}
                        					<span class="tag"
												  style="background-color: {getTagColor(tagId)}">
                            					{getTagName(tagId)}
                        					</span>
										{/if}
									{/each}
								</div>

								<div class="book-footer">
									<div class="book-status">
										{#if isNewBook(novel) && (!novel.progress || novel.progress === 0)}
											<div class="new-badge">新增</div>
										{:else if novel.progress !== undefined && novel.progress > 0}
											<span class="progress-text">{Math.floor(novel.progress)}%</span>
										{/if}
									</div>

									<div class="menu-container">
										<button
											class="more-button"
											on:click|stopPropagation={(e) => toggleMenu(e, novel)}
											aria-label="更多操作"
										>
											•••
										</button>

										{#if activeMenuNovel === novel}
											<div
												class="more-menu"
												class:menu-top={menuPosition?.direction === 'top'}
												class:menu-left={menuPosition?.direction === 'left'}
												data-alignment={menuPosition?.alignment}
												on:click|stopPropagation
											>
												<button
													class="menu-item"
													on:click|stopPropagation={() => toggleFavorite(activeMenuNovel)}
												>
            										<span class="menu-icon">
                										{#if isFavorite(activeMenuNovel.id)}
                    										❤️
														{:else}
                    										🤍
                										{/if}
            										</span>
													<span>{isFavorite(activeMenuNovel.id) ? '取消喜爱' : '添加到喜爱'}</span>
												</button>

												<div class="menu-divider"></div>

												<button
													class="menu-item"
													on:click|stopPropagation={(e) => handleOpenChapterGrid(activeMenuNovel, e)}
												>
													<span class="menu-icon">📑</span>
													<span>图书目录</span>
												</button>

												<div class="submenu">
													<button class="menu-item">
														<span class="menu-icon">📚</span>
														<span>添加到书架</span>
													</button>
													<div class="submenu-content">
														{#each customShelves as shelf}
															<button
																class="menu-item submenu-item"
																on:click|stopPropagation={() => addToCustomShelf(activeMenuNovel, shelf)}
															>
																{shelf.name}
															</button>
														{/each}
													</div>
												</div>

												<button
													class="menu-item"
													on:click|stopPropagation={(e) => handleShelfManage(activeMenuNovel, e)}
												>
													<span class="menu-icon">📚</span>
													<span>选择书架</span>
												</button>

												<button
													class="menu-item"
													on:click|stopPropagation={(e) => handleTagManage(activeMenuNovel, e)}
												>
													<span class="menu-icon">🏷️</span>
													<span>管理标签</span>
												</button>

												<button
													class="menu-item"
													on:click|stopPropagation={(e) => handleCategoryManage(activeMenuNovel, e)}
												>
													<span class="menu-icon">📁</span>
													<span>管理分类</span>
												</button>

												<button
													class="menu-item"
													on:click|stopPropagation={(e) => handleOpenNoteWithCheck(activeMenuNovel, e)}
												>
													<span class="menu-icon">📝️</span>
													<span>图书信息</span>
												</button>

												<button
													class="menu-item"
													on:click|stopPropagation={(e) => handleOpenStats(activeMenuNovel, e)}
												>
													<span class="menu-icon">📊</span>
													<span>阅读统计</span>
												</button>

												<button
													class="menu-item"
													on:click|stopPropagation={(e) => handleRemoveWithCheck(activeMenuNovel, e)}
												>
													<span class="menu-icon">🗑️</span>
													<span>移除图书</span>
												</button>
											</div>
										{/if}
									</div>
								</div>
							</div>

						</div>
					{/each}
				{/if}
			</div>
		</div>
	</div>


	{#if novelsList.length === 0}
		<div class="empty-message">
			{searchQuery ? '没有找到匹配的图书' : '暂无图书，请点击"添加图书"按钮添加'}
		</div>
	{/if}

	<!-- 添加模态框组件 -->
	{#if showTagManager && currentNovel}
		<div class="modal-backdrop" on:click|self={() => showTagManager = false}>
			<TagManagerModal
				novel={currentNovel}
				tags={tags}
				selectedTags={currentNovel.tags || []}
				on:close={() => {
                    showTagManager = false;
                    currentNovel = null;
                }}
				on:save={handleTagSave}
				on:createTag={handleCreateTag}
				on:deleteTag={handleDeleteTag}
			/>
		</div>
	{/if}

	{#if showCategoryManager && currentNovel}
		<div class="modal-backdrop" on:click|self={() => showCategoryManager = false}>
			<CategoryManagerModal
				novel={currentNovel}
				categories={categories}
				on:close={() => {
                    showCategoryManager = false;
                    currentNovel = null;
                }}
				on:save={handleCategorySave}
				on:createCategory={handleCreateCategory}
				on:deleteCategory={handleDeleteCategory}
			/>
		</div>
	{/if}

	<!-- 添加书架管理模态框 -->
	{#if showShelfManager && currentNovel}
		<div class="modal-backdrop" on:click|self={() => showShelfManager = false}>
			<ShelfManagerModal
				novel={currentNovel}
				shelves={shelves}
				on:close={() => {
                showShelfManager = false;
                currentNovel = null;
            }}
				on:save={handleShelfSave}
			/>
		</div>
	{/if}
</div>

<style>
	.toolbar-container {
		position: sticky;
		top: 0;
		background-color: var(--background-primary);
		padding: 8px 0;
		z-index: 10;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.toolbar {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 0 16px;
		border: none; /* 移除可能的边框 */
		background: var(--background-primary);
	}

	.add-button {
		background-color: var(--interactive-accent);
		color: var(--text-on-accent);
		padding: 8px 16px;
		border-radius: 20px;
		border: none;
		cursor: pointer;
		font-size: 14px;
		font-weight: 500;
		transition: all 0.2s;
	}

	.add-button:hover {
		background-color: var(--interactive-accent-hover);
		transform: scale(1.02);
	}

	.books-grid {
		display: grid;
		/* 关键改动在这里 */
		grid-template-columns: repeat(auto-fill, minmax(min(160px, calc((100% - 120px) / 4)), 1fr));
		gap: 24px;
		padding: 0 16px 16px;
		overflow-y: auto;
		margin: 0 auto;
		justify-content: center;
		width: 100%;
		box-sizing: border-box;
	}

	/* 针对不同屏幕宽度的响应式调整 */
	@media (max-width: 1200px) {
		.books-grid {
			/* 确保在较窄屏幕上显示6列 */
			grid-template-columns: repeat(6, minmax(160px, 1fr));
		}
	}

	.book-card {
		display: flex;
		flex-direction: column;
		cursor: pointer;
		transition: transform 0.2s;
		position: relative; /* 确保相对定位 */
		width: 160px;
		padding: 0;
		z-index: 1; /* 添加基础层级 */
		max-width: 200px; /* 防止在非常宽的屏幕上变得过大 */
		min-width: 160px; /* 保持最小宽度 */
	}

	/* 当菜单打开时提高卡片层级 */
	.book-card:has(.more-menu) {
		z-index: 2;
	}

	.book-card:hover {
		transform: translateY(-2px);
	}

	.book-card:active {
		transform: scale(0.98);
	}

	.book-cover-wrapper {
		position: relative;
		width: 100%;
		aspect-ratio: 3/4;
		margin-bottom: 12px;
		border-radius: 8px;
		overflow: hidden;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		background-color: var(--background-secondary);
	}

	.book-cover {
		width: 100%;
		height: 100%;
		object-fit: cover;
		background-color: var(--background-secondary);
		transition: opacity 0.2s;
	}

	.book-cover.placeholder {
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(45deg, var(--background-secondary), var(--background-secondary-alt));
		font-size: 48px;
	}

	.book-info {
		padding: 0 4px;
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.book-title {
		margin: 0;
		font-size: 14px;
		font-weight: 500;
		color: var(--text-normal);
		line-height: 1.4;
		margin-bottom: 4px;
		display: -webkit-box;
		-webkit-line-clamp: 1;
		-webkit-box-orient: vertical;
		overflow: hidden;
		text-align: center;
	}

	.book-footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 0;
		margin-top: auto;
		position: relative; /* 添加相对定位 */
	}

	.book-status {
		display: flex;
		align-items: center;
	}

	.menu-container {
		position: relative;
		display: inline-block;
	}

	.submenu {
		position: relative;
	}

	.submenu-content {
		position: absolute;
		left: 100%;
		top: 0;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 4px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		min-width: 160px;
		display: none;
	}

	/* 调整子菜单在左侧显示时的位置 */
	.menu-left .submenu-content {
		left: auto;
		right: 100%;
	}

	.submenu:hover .submenu-content {
		display: block;
	}

	.submenu-item {
		padding-left: 24px;
	}

	.progress-text {
		font-size: 12px;
		color: var(--text-muted);
		min-width: 32px;
	}

	.more-button {
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		padding: 4px 8px;
		border-radius: 4px;
		font-size: 14px;
		transition: all 0.2s;
		opacity: 0.6;
		z-index: 2;
	}

	.more-button:hover {
		color: var(--text-normal);
		opacity: 1;
		background-color: var(--background-modifier-hover);
	}

	.new-badge {
		font-size: 11px;
		padding: 2px 6px;
		border-radius: 4px;
		background-color: var(--interactive-accent);
		color: white;
		font-weight: 500;
	}

	.more-menu {
		position: absolute;
		background: var(--background-primary);
		border: 1px solid var(--background-modifier-border);
		border-radius: 8px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		min-width: 180px;
		transition: transform 0.2s ease;
	}

	/* 底部显示 */
	.more-menu.menu-bottom {
		top: 100%;
		margin-top: 4px;
	}

	/* 从按钮左侧对齐 */
	.more-menu[data-alignment="left"] {
		left: 0;
	}

	/* 从按钮右侧对齐 */
	.more-menu[data-alignment="right"] {
		right: 0;
	}

	/* 顶部显示 */
	.more-menu.menu-top {
		bottom: 100%;
		margin-bottom: 4px;
	}

	/* 左侧显示 */
	.more-menu.menu-left {
		right: calc(100% + 4px);
		top: 0;
	}

	.menu-divider {
		height: 1px;
		background: var(--background-modifier-border);
		margin: 4px 12px;
	}

	@keyframes menuFadeIn {
		from {
			opacity: 0;
			transform: scale(0.95) translateY(10px);
		}
		to {
			opacity: 1;
			transform: scale(1) translateY(0);
		}
	}

	.menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		width: 100%;
		border: none;
		background: none;
		color: var(--text-normal);
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.2s;
		font-size: 14px;
		text-align: left;
		white-space: nowrap;
	}

	.menu-item:hover {
		background-color: var(--background-modifier-hover);
	}

	.menu-item:active {
		background-color: var(--background-modifier-active);
	}

	/* 添加菜单项分隔线 */
	.menu-item + .menu-item {
		border-top: 1px solid var(--background-modifier-border-hover);
	}

	/* 添加菜单动画 */
	@keyframes menuFadeIn {
		from {
			opacity: 0;
			transform: translateY(-4px);
		}
		to {
			opacity: 1;
			transform: translateY(0);
		}
	}

	/* 确保菜单在小屏幕上也能正常显示 */
	@media screen and (max-width: 768px) {
		.more-menu {
			right: 0;
			max-width: calc(100vw - 32px);
		}

		.submenu-content {
			left: auto;
			right: 100%;
		}
	}

	.menu-icon {
		font-size: 16px;
		opacity: 0.8;
	}

	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 12px;
	}

	.toolbar-left {
		display: flex;
		gap: 8px;
		align-items: center;
	}

	.refresh-button {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 12px;
		border-radius: 20px;
		border: 1px solid var(--background-modifier-border);
		background-color: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
		font-size: 14px;
		transition: all 0.2s;
	}

	.refresh-button:hover {
		background-color: var(--background-modifier-hover);
		border-color: var(--interactive-accent);
	}

	.refresh-icon {
		font-size: 16px;
	}

	/* 添加刷新动画 */
	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	.refresh-button:active .refresh-icon {
		animation: spin 0.5s linear;
	}

	.sort-select,
	.search-input {
		padding: 6px 12px;
		border-radius: 16px;
		border: 1px solid var(--background-modifier-border);
		background-color: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
		transition: all 0.2s;
	}

	.sort-select:hover,
	.search-input:hover {
		border-color: var(--interactive-accent);
	}

	.sort-select:focus,
	.search-input:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.1);
	}

	.order-button {
		padding: 6px 12px;
		border-radius: 16px;
		border: 1px solid var(--background-modifier-border);
		background-color: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
		transition: all 0.2s;
	}

	.order-button:hover {
		border-color: var(--interactive-accent);
		color: var(--interactive-accent);
	}

	.empty-message {
		text-align: center;
		color: var(--text-muted);
		padding: 20px;
		grid-column: 1 / -1;
	}

	.shelf-selector {
		padding: 8px 16px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.shelf-tabs {
		display: flex;
		gap: 8px;
	}

	.shelf-tab {
		padding: 6px 12px;
		border-radius: 16px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		cursor: pointer;
		transition: all 0.2s;
	}

	.shelf-tab.active {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: var(--interactive-accent);
	}

	.tags-container {
		padding: 8px 16px;
		display: flex;
		flex-wrap: wrap;
		gap: 8px;
		align-items: center;
		background: var(--background-secondary);
		border-radius: 8px;
		margin: 8px 0;
	}

	.tag-button {
		padding: 6px 12px;
		border-radius: 16px;
		border: 2px solid transparent; /* 添加边框为透明 */
		color: white;
		cursor: pointer;
		font-size: 12px;
		opacity: 0.75;
		transition: all 0.2s ease-in-out;
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}

	.tag-button:hover {
		opacity: 0.9;
		transform: translateY(-1px);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.tag-button.selected {
		opacity: 1;
		transform: scale(1.05);
		/* 添加白色边框突出显示 */
		border: 2px solid rgba(255, 255, 255, 0.8);
		/* 添加发光效果 */
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2),
		0 0 0 2px rgba(255, 255, 255, 0.1);
		font-weight: 500;
	}

	/* 添加选中图标 */
	.tag-button.selected::after {
		content: "✓";
		margin-left: 4px;
		font-size: 12px;
	}

	/* 未选中的标签样式 */
	.tag-button:not(.selected) {
		filter: grayscale(20%);
	}

	.book-tags {
		display: flex;
		flex-wrap: wrap;
		gap: 4px;
		margin-top: 8px;
	}

	.status-tag {
		padding: 2px 6px;
		border-radius: 12px;
		font-size: 11px;
		color: white;
	}

	.tag {
		padding: 2px 6px;
		border-radius: 12px;
		font-size: 11px;
		color: white;
		opacity: 0.8;
	}

	/* 添加模态框背景样式 */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 1000;
	}

	/* 菜单项样式 */
	.menu-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		width: 100%;
		border: none;
		background: none;
		color: var(--text-normal);
		cursor: pointer;
		border-radius: 6px;
		transition: background-color 0.2s;
		font-size: 14px;
		text-align: left;
	}

	.menu-item:hover {
		background-color: var(--background-modifier-hover);
	}

	.menu-icon {
		font-size: 16px;
		opacity: 0.8;
	}

	.shelf-selector {
		padding: 8px 16px;
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		align-items: center;
	}

	.category-selector {
		flex: 0 0 auto;
	}

	.category-select {
		padding: 6px 12px;
		border-radius: 16px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		color: var(--text-normal);
		font-size: 14px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.category-select:hover {
		border-color: var(--interactive-accent);
	}

	.category-select:focus {
		outline: none;
		border-color: var(--interactive-accent);
		box-shadow: 0 0 0 2px rgba(var(--interactive-accent-rgb), 0.1);
	}

	/* 优化书架选择器样式以适应新布局 */
	.shelf-tabs {
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.advanced-filter-button {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 12px;
		border-radius: 20px;
		border: 1px solid var(--background-modifier-border);
		background-color: var(--background-primary);
		color: var(--text-normal);
		cursor: pointer;
		font-size: 14px;
		transition: all 0.2s;
	}

	.advanced-filter-button.active {
		background-color: var(--interactive-accent);
		color: var(--text-on-accent);
		border-color: var(--interactive-accent);
	}

	.advanced-filters {
		padding: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
		background: var(--background-secondary);
		transition: width 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
	}

	.view-header {
		padding: 16px 24px;
		position: relative; /* 添加相对定位 */
		background: var(--background-primary);
		display: flex;
		align-items: center;
		margin-bottom: 16px;
	}

	.view-header::after {
		content: '';
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		height: 1px;
		background: var(--background-modifier-border);
		opacity: 0.3; /* 降低分隔线的透明度 */
	}

	.view-header h2 {
		margin: 0;
		font-size: 18px;
		color: var(--text-normal);
		font-weight: 500;
		line-height: 1.4; /* 添加行高 */
		z-index: 1; /* 确保文字在分隔线上层 */
	}

	.library-container {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	.content-wrapper {
		display: flex;
		width: 100%;
		height: 100%;
		position: relative;
	}

	.sidebar {
		width: 0;
		flex-shrink: 0;
		background: var(--background-secondary);
		border-right: 1px solid var(--background-modifier-border);
		display: flex;
		flex-direction: column;
		overflow: hidden;
		box-shadow: 2px 0 8px rgba(0, 0, 0, 0.05);
		transition: width 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
		will-change: width;
	}

	.with-sidebar .sidebar {
		width: 240px;
	}

	.sidebar-content {
		padding: 12px;
		overflow-y: auto;
		height: 100%;
		opacity: 0;
		animation: fadeIn 200ms ease-out 150ms forwards;
	}

	@keyframes fadeIn {
		from {
			opacity: 0;
			transform: translateX(-20px);
		}
		to {
			opacity: 1;
			transform: translateX(0);
		}
	}

	:global(.sidebar-transition-enter-active),
	:global(.sidebar-transition-leave-active) {
		transition: transform 300ms cubic-bezier(0.4, 0, 0.2, 1);
	}

	:global(.sidebar-transition-enter-from),
	:global(.sidebar-transition-leave-to) {
		transform: translateX(-100%);
	}

	.sidebar-section {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.sidebar-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 4px 8px;
		color: var(--text-muted);
		font-size: 0.9em;
	}

	.sidebar-item {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 8px;
		border: none;
		background: none;
		color: var(--text-normal);
		cursor: pointer;
		border-radius: 4px;
		text-align: left;
		font-size: 14px;
		transition: all 0.2s;
	}

	.sidebar-item:hover {
		background: var(--background-modifier-hover);
	}

	.sidebar-item.active {
		background: var(--background-modifier-active);
		color: var(--text-accent);
	}

	.sidebar-toggle {
		font-size: 20px;
		padding: 4px 8px;
		background: none;
		border: none;
		color: var(--text-muted);
		cursor: pointer;
		border-radius: 4px;
		transition: all 0.2s;
	}

	.sidebar-toggle:hover {
		background: var(--background-modifier-hover);
		color: var(--text-normal);
	}

	.sidebar-toggle.active {
		color: var(--text-accent);
		background: var(--background-modifier-active);
	}

	.main-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
		transition: all 300ms cubic-bezier(0.34, 1.56, 0.64, 1);
		will-change: transform, margin;
	}

	.with-sidebar .main-content {
		margin-left: 0;
	}

	@keyframes slideIn {
		0% {
			opacity: 0;
			transform: translateX(-20px);
		}
		100% {
			opacity: 1;
			transform: translateX(0);
		}
	}

	.sidebar-content {
		padding: 12px;
		width: 240px; /* 固定宽度 */
		opacity: 0;
		animation: slideIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) 100ms forwards;
	}

	.icon {
		font-size: 16px;
		opacity: 0.8;
	}

	.count {
		margin-left: auto;
		font-size: 12px;
		color: var(--text-muted);
	}

	.sidebar-divider {
		height: 1px;
		background: var(--background-modifier-border);
		margin: 8px 0;
	}

	.new-shelf-form {
		padding: 8px;
		background: var(--background-primary);
		border-radius: 4px;
		margin: 4px 0;
	}

	.new-shelf-form input {
		width: 100%;
		padding: 4px 8px;
		margin-bottom: 8px;
		border-radius: 4px;
		border: 1px solid var(--background-modifier-border);
	}

	.form-buttons {
		display: flex;
		gap: 8px;
	}

	.form-buttons button {
		flex: 1;
		padding: 4px 8px;
		border-radius: 4px;
		border: none;
		cursor: pointer;
		font-size: 12px;
	}

	.form-buttons button:not(.cancel) {
		background: var(--interactive-accent);
		color: var(--text-on-accent);
	}

	.form-buttons .cancel {
		background: var(--background-modifier-error);
		color: white;
	}


</style>
