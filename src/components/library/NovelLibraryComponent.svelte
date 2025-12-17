<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { Novel } from '../../types';
  import type { Category, CustomShelf, Shelf, Tag } from '../../types/shelf';
  import CategoryManagerModal from '../CategoryManagerModal.svelte';
  import ShelfManagerModal from '../ShelfManagerModal.svelte';
  import NovelStatsModal from '../NovelStatsModal.svelte';
  import { cubicInOut, cubicOut } from 'svelte/easing';
  import { Notice } from 'obsidian';
  import type NovelReaderPlugin from '../../main';
  import { slide } from 'svelte/transition';
  import TagManagerModal from '../TagManagerModal.svelte';
  import { icons, getShelfIcon } from './icons';
  import { debounce } from '../../utils/debounce';
  import { TIMING } from '../../constants/app-config';
  import AdvancedFilterModal from './AdvancedFilterModal.svelte';
  import type { FilterConfig } from '../../types/filter-config';
  import ViewDropdownMenu from './ViewDropdownMenu.svelte';
  import { FilterStateService } from '../../services/filter-state-service';

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
  let showStatsModal = false;
  let statsNovel: Novel | null = null;
  let currentNovel: Novel | null = null;
  // 添加分类筛选的状态
  let currentCategoryId = '';

  let currentShelf = 'all';
  let selectedTags: string[] = [];
  let sortField: 'lastRead' | 'addTime' | 'title' = 'lastRead';
  let sortOrder: 'asc' | 'desc' = 'desc';
  let searchQuery = '';
  let debouncedSearchQuery = ''; // 防抖后的搜索查询
  let currentView = 'library'; // 当前视图：library, favorites, notes, shelf:id
  let isComposing = false;
  let actualSearchQuery = '';

  // 使用 debounce 工具创建防抖搜索函数
  const updateDebouncedSearch = debounce((query: string) => {
    debouncedSearchQuery = query;
  }, TIMING.SEARCH_DEBOUNCE);
  let activeMenuNovel: Novel | null = null;
  let menuPosition: {
    direction: 'bottom' | 'top' | 'left';
    alignment: 'left' | 'right';
  } | null = null;

  // 添加状态变量
  let showShelfManager = false;
  let showFilterModal = false; // 控制筛选模态弹窗的显示
  // 筛选配置
  let currentFilters: FilterConfig = {
    shelfId: 'all',
    categoryId: '',
    categoryIds: [],
    tagIds: [],
    excludeTagIds: [],
    progressStatus: 'all',
    addTimeRange: 'all',
  };

  // 筛选状态服务
  let filterStateService: FilterStateService;
  let hasActiveFilters = false;

  // 计算是否有激活的筛选条件
  $: hasActiveFilters =
    currentFilters.shelfId !== 'all' ||
    currentFilters.categoryId !== '' ||
    (currentFilters.categoryIds && currentFilters.categoryIds.length > 0) ||
    currentFilters.tagIds.length > 0 ||
    (currentFilters.excludeTagIds && currentFilters.excludeTagIds.length > 0) ||
    currentFilters.progressStatus !== 'all' ||
    currentFilters.progressRange !== undefined ||
    (currentFilters.addTimePreset && currentFilters.addTimePreset !== 'all') ||
    currentFilters.stalledBooks?.enabled === true;
  // 筛选后的图书列表
  let filteredNovels = novels;
  export let selectedShelfId: string | null = null;

  $: novelsList = novels || [];

  // 初始化筛选状态服务并加载保存的筛选
  onMount(async () => {
    filterStateService = new FilterStateService(plugin.app, plugin);
    const savedFilters = await filterStateService.loadFilterState();

    if (savedFilters) {
      currentFilters = savedFilters;
      // 同步旧的筛选状态
      currentShelf = savedFilters.shelfId || 'all';
      currentCategoryId = savedFilters.categoryId || '';
      selectedTags = savedFilters.tagIds || [];
    }
  });

  // 防抖搜索查询 - 使用配置的延迟时间
  $: {
    updateDebouncedSearch(searchQuery);
  }

  $: filteredNovels = novels
    .filter((novel) => {
      // 基础视图筛选
      let isInView = true;
      if (currentView === 'favorites') {
        isInView = plugin?.customShelfService?.isFavorite(novel.id) ?? false;
      } else if (currentView === 'notes') {
        isInView = !!novel.notePath;
      } else if (currentView.startsWith('shelf:')) {
        const shelfId = currentView.split(':')[1];
        isInView = novel.shelfId === shelfId;
      }
      if (!isInView) return false;

      // 搜索过滤 - 使用防抖后的搜索查询
      const matchesSearch = novel.title.toLowerCase().includes(debouncedSearchQuery.toLowerCase());

      // 书架过滤
      const matchesShelf = currentShelf === 'all' || novel.shelfId === currentShelf;

      // 分类过滤（支持多分类）
      let matchesCategory = true;
      const novelCategories = novel.categoryIds || (novel.categoryId ? [novel.categoryId] : []);
      if (currentFilters.categoryIds && currentFilters.categoryIds.length > 0) {
        if (currentFilters.categoryMode === 'AND') {
          // AND模式：必须包含所有选中的分类
          matchesCategory = currentFilters.categoryIds.every((catId) =>
            novelCategories.includes(catId)
          );
        } else {
          // OR模式：包含任一选中的分类即可
          matchesCategory = currentFilters.categoryIds.some((catId) =>
            novelCategories.includes(catId)
          );
        }
      } else if (currentCategoryId) {
        // 向后兼容旧的单分类筛选
        matchesCategory = novelCategories.includes(currentCategoryId);
      }

      // 标签过滤（支持AND/OR和排除）
      let matchesTags = true;
      const novelTags = novel.tags || [];

      // 排除筛选：如果图书包含任何排除的标签，则不匹配
      if (currentFilters.excludeTagIds && currentFilters.excludeTagIds.length > 0) {
        const hasExcludedTag = currentFilters.excludeTagIds.some((tagId) =>
          novelTags.includes(tagId)
        );
        if (hasExcludedTag) {
          matchesTags = false;
        }
      }

      // 包含筛选
      if (matchesTags && currentFilters.tagIds && currentFilters.tagIds.length > 0) {
        if (currentFilters.tagMode === 'AND') {
          // AND模式：必须包含所有选中的标签
          matchesTags = currentFilters.tagIds.every((tagId) => novelTags.includes(tagId));
        } else {
          // OR模式：包含任一选中的标签即可
          matchesTags = currentFilters.tagIds.some((tagId) => novelTags.includes(tagId));
        }
      } else if (matchesTags && selectedTags.length > 0) {
        // 向后兼容旧的标签筛选
        matchesTags = selectedTags.every((tagId) => novelTags.includes(tagId));
      }

      // 进度筛选（支持状态和范围）
      let matchesProgress = true;
      const progress = novel.progress || 0;

      // 状态筛选
      if (currentFilters.progressStatus === 'new') {
        matchesProgress = progress === 0;
      } else if (currentFilters.progressStatus === 'reading') {
        matchesProgress = progress > 0 && progress < 100;
      } else if (currentFilters.progressStatus === 'finished') {
        matchesProgress = progress === 100;
      }

      // 进度范围筛选（如果设置了范围，则覆盖状态筛选）
      if (currentFilters.progressRange) {
        const { min, max } = currentFilters.progressRange;
        matchesProgress = progress >= min && progress <= max;
      }

      // 时间筛选（支持更多预设和自定义范围）
      let matchesTime = true;

      // 使用新的预设（如果有）
      const timePreset = currentFilters.addTimePreset || currentFilters.addTimeRange;
      if (timePreset === 'today') {
        const todayStart = new Date().setHours(0, 0, 0, 0);
        matchesTime = novel.addTime >= todayStart;
      } else if (timePreset === 'week') {
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        matchesTime = novel.addTime >= weekAgo;
      } else if (timePreset === 'month') {
        const monthAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        matchesTime = novel.addTime >= monthAgo;
      } else if (timePreset === 'quarter') {
        const quarterAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
        matchesTime = novel.addTime >= quarterAgo;
      } else if (timePreset === 'year') {
        const yearAgo = Date.now() - 365 * 24 * 60 * 60 * 1000;
        matchesTime = novel.addTime >= yearAgo;
      }

      // 自定义时间范围（优先级最高）
      if (currentFilters.addTimeCustom) {
        const { startDate, endDate } = currentFilters.addTimeCustom;
        if (startDate && endDate) {
          matchesTime = novel.addTime >= startDate && novel.addTime <= endDate;
        } else if (startDate) {
          matchesTime = novel.addTime >= startDate;
        } else if (endDate) {
          matchesTime = novel.addTime <= endDate;
        }
      }

      // 停滞图书筛选
      let matchesStalled = true;
      if (currentFilters.stalledBooks?.enabled) {
        const stalledDays = currentFilters.stalledBooks.days || 30;
        matchesStalled = isStalledBook(novel, stalledDays);
      }

      return (
        matchesSearch &&
        matchesShelf &&
        matchesCategory &&
        matchesTags &&
        matchesProgress &&
        matchesTime &&
        matchesStalled &&
        isInView
      );
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
        try {
          if (!plugin?.customShelfService) {
            console.error('customShelfService未初始化');
            filteredNovels = [];
            return;
          }
          const favoriteIds = await plugin.customShelfService.getFavoriteNovels();
          filteredNovels = novels.filter((novel) => favoriteIds.includes(novel.id));
        } catch (error) {
          console.error('加载喜爱列表失败:', error);
          new Notice('加载喜爱列表失败，请重试');
          filteredNovels = [];
        }
      })();
    }
  }

  onMount(() => {
    document.addEventListener('click', handleClickOutside);

    // 监听封面提取完成事件,自动刷新图书列表
    const refreshHandler = plugin.app.workspace.on('library-refresh' as any, async () => {
      console.log('📚 封面加载完成,刷新图书列表');
      novels = await plugin.libraryService.getAllNovels();
    });

    return () => {
      document.removeEventListener('click', handleClickOutside);
      // 清理防抖函数
      updateDebouncedSearch.cancel();
      // 清理事件监听
      plugin.app.workspace.offref(refreshHandler);
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
    const cardElement = button.closest('.book-card') as HTMLElement;
    const cardRect = cardElement.getBoundingClientRect();

    // 获取图书库容器的边界
    const libraryContainer = document.querySelector('.library-container') as HTMLElement;
    const libraryRect = libraryContainer.getBoundingClientRect();

    // 计算关键距离 - 使用容器边界而不是视口
    const distanceToBottom = libraryRect.bottom - buttonRect.bottom;
    const distanceToRight = libraryRect.right - cardRect.right;
    const spaceOnLeft = cardRect.left - libraryRect.left;

    // 智能判断菜单显示方向
    if (distanceToRight < 180) {
      // 右侧空间不足
      if (spaceOnLeft >= 180) {
        // 左侧有足够空间
        menuPosition = {
          direction: 'left',
          alignment: 'right',
        };
      } else {
        // 左右两侧都空间不足，向下展示并右对齐
        menuPosition = {
          direction: 'bottom',
          alignment: 'right',
        };
      }
    } else {
      // 右侧有足够空间
      if (distanceToBottom < 200) {
        // 底部空间不足，向上展示
        menuPosition = {
          direction: 'top',
          alignment: 'left',
        };
      } else {
        // 默认向下右侧展示
        menuPosition = {
          direction: 'bottom',
          alignment: 'left',
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
    // 使用可配置的时间窗口（默认7天）
    const timeWindow = novel.customSettings?.newBadgeTimeWindow || 7;
    const timeWindowMs = timeWindow * 24 * 60 * 60 * 1000;
    const isRecent = Date.now() - novel.addTime < timeWindowMs;

    // 改用 lastRead 判断是否开始阅读（而非 progress）
    // 这样即使进度很小（如0.5%），只要打开过就不再显示"新增"
    const notStarted = !novel.lastRead;

    return isRecent && notStarted;
  }

  // 判断是否为停滞图书的函数
  function isStalledBook(novel: Novel, days: number = 30): boolean {
    // 必须已开始阅读
    if (!novel.lastRead || !novel.progress || novel.progress === 0) {
      return false;
    }

    // 必须未完成
    if (novel.progress >= 100) {
      return false;
    }

    // 检查停滞时间
    const stalledMs = days * 24 * 60 * 60 * 1000;
    return Date.now() - novel.lastRead > stalledMs;
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

  // 打开"阅读统计弹窗"
  async function handleOpenStats(novel: Novel | null, event: MouseEvent) {
    event.stopPropagation();
    closeMenu();
    if (novel) {
      statsNovel = novel;
      showStatsModal = true;
    }
  }

  function closeStatsModal() {
    showStatsModal = false;
    statsNovel = null;
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
    const shelf = shelves.find((s) => s.id === shelfId);
    return shelf?.name || '未分类';
  }

  // 获取标签颜色（使用CSS变量作为默认值）
  function getTagColor(tagId: string): string {
    const tag = tags.find((t) => t.id === tagId);
    return tag?.color || 'var(--novel-color-shelf-archived)';
  }

  // 获取标签名称
  function getTagName(tagId: string): string {
    const tag = tags.find((t) => t.id === tagId);
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
    const { novelId, tagIds } = event.detail;
    const novel = novels.find((n) => n.id === novelId);
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
    const { novelId, categoryId } = event.detail;
    const novel = novels.find((n) => n.id === novelId);
    if (novel) {
      novel.categoryId = categoryId;
      await onUpdateNovel(novel);
      showCategoryManager = false;
      currentNovel = null;
    }
  }

  function handleCreateTag(event: CustomEvent) {
    const { name, color } = event.detail;
    onCreateTag(name, color);
  }

  function handleDeleteTag(event: CustomEvent) {
    const { tagId } = event.detail;
    onDeleteTag(tagId);
  }

  function handleCreateCategory(event: CustomEvent) {
    const { name } = event.detail;
    onCreateCategory(name);
  }

  function handleDeleteCategory(event: CustomEvent) {
    const { categoryId } = event.detail;
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
    const { novelId, shelfId } = event.detail;
    const novel = novels.find((n) => n.id === novelId);
    if (novel) {
      novel.shelfId = shelfId;
      await onUpdateNovel(novel);
      showShelfManager = false;
      currentNovel = null;
    }
  }

  // 打开筛选模态弹窗
  function openFilterModal() {
    showFilterModal = true;
  }

  // 应用筛选
  function handleApplyFilters(event: CustomEvent) {
    const filters = event.detail.filters; // Assuming event.detail contains 'filters' object
    currentFilters = filters;
    showFilterModal = false;

    // 保存筛选状态
    if (filterStateService) {
      filterStateService.saveFilterState(currentFilters);
    }

    // 更新旧的筛选状态以保持兼容
    currentShelf = filters.shelfId;
    currentCategoryId = filters.categoryId;
    selectedTags = filters.tagIds;
  }

  // 重置筛选
  function handleResetFilters() {
    currentFilters = {
      shelfId: 'all',
      categoryId: '',
      categoryIds: [],
      tagIds: [],
      excludeTagIds: [],
      progressStatus: 'all',
      addTimeRange: 'all',
    };

    // 清除保存的筛选状态
    if (filterStateService) {
      filterStateService.clearFilterState();
    }

    currentShelf = 'all';
    currentCategoryId = '';
    selectedTags = [];
    showFilterModal = false;
  }

  // 清除单个筛选条件
  function clearFilter(type: string) {
    switch (type) {
      case 'shelf':
        currentFilters.shelfId = 'all';
        currentShelf = 'all';
        break;
      case 'category':
        currentFilters.categoryId = '';
        currentCategoryId = '';
        break;
      case 'tags':
        currentFilters.tagIds = [];
        selectedTags = [];
        break;
      case 'progress':
        currentFilters.progressStatus = 'all';
        break;
      case 'time':
        currentFilters.addTimeRange = 'all';
        break;
    }
    currentFilters = currentFilters; // 触发响应式更新
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
      const shelf = customShelves.find((s) => s.id === shelfId);
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
        filteredNovels = novels.filter((n) => favoriteIds.includes(n.id));
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
      novels = await getBaseNovelsList(); // 更新基础数据集

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

  // 添加侧边栏状态控制 - 已移除,使用ViewDropdownMenu替代

  // 处理创建新书架 - 已移至ViewDropdownMenu组件

  // 切换视图
  function switchView(view: string) {
    dispatch('viewChange', { view });
    currentView = view;
    selectedShelfId = null;
  }

  // 选择书架
  function selectShelf(shelfId: string) {
    dispatch('selectShelf', { shelfId });
    selectedShelfId = shelfId;
    currentView = 'customShelf';
  }

  async function getBaseNovelsList(): Promise<Novel[]> {
    switch (currentView) {
      case 'favorites': {
        const favoriteIds = await plugin.customShelfService.getFavoriteNovels();
        return novels.filter((novel) => favoriteIds.includes(novel.id));
      }
      case 'notes':
        return novels.filter((novel) => novel.notePath);
      default:
        if (currentView.startsWith('shelf:')) {
          const shelfId = currentView.split(':')[1];
          const shelfNovels = await plugin.customShelfService.getCustomShelfNovels(shelfId);
          return novels.filter((novel) => shelfNovels.includes(novel.id));
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
  <div class="novel-toolbar-container">
    <div class="novel-toolbar">
      <div class="novel-toolbar-left">
        <!-- 视图下拉菜单 -->
        <ViewDropdownMenu
          {customShelves}
          {currentView}
          on:viewChange={(e) => handleViewChange(e.detail.view)}
          on:selectShelf={(e) => selectShelf(e.detail.shelfId)}
          on:createShelf={(e) => dispatch('createCustomShelf', { name: e.detail.name })}
        />

        <button type="button" on:click={() => onAddNovel()} class="novel-add-button">
          添加图书
        </button>
        <!-- 添加刷新按钮 -->
        <button type="button" on:click={handleRefresh} class="novel-refresh-button">
          <span class="refresh-icon">{@html icons.refresh}</span>
          刷新
        </button>
        <button
          type="button"
          on:click={openFilterModal}
          class="novel-advanced-filter-button"
          class:active={hasActiveFilters}
          class:has-filters={hasActiveFilters}
        >
          <span class="filter-icon">{@html icons.filter}</span>
          高级筛选
          {#if hasActiveFilters}
            <span class="filter-badge"></span>
          {/if}
        </button>
      </div>
      <div class="novel-toolbar-right">
        <select bind:value={sortField} class="novel-sort-select">
          <option value="lastRead">最近阅读</option>
          <option value="addTime">添加时间</option>
          <option value="title">书名</option>
        </select>

        <button
          class="novel-order-button"
          on:click={() => (sortOrder = sortOrder === 'asc' ? 'desc' : 'asc')}
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
          class="novel-search-input"
        />
      </div>
    </div>
  </div>

  <!-- 筛选标签显示 -->

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
  <div class="novel-content-wrapper">
    <!-- 侧边栏已移除,使用ViewDropdownMenu替代 -->

    <!-- 主内容区域 -->
    <div class="novel-main-content">
      <div class="novel-books-grid">
        {#if filteredNovels.length > 0}
          {#each filteredNovels as novel}
            <div class="novel-book-card" on:click={() => onOpenNovel(novel)}>
              <div class="novel-book-cover-wrapper">
                {#if novel.cover}
                  <img
                    src={novel.cover}
                    alt={novel.title}
                    class="novel-book-cover"
                    on:error={() => {
                      novel.cover = undefined;
                    }}
                  />
                {:else}
                  <div class="novel-book-cover placeholder">
                    <span class="placeholder-icon">{@html icons.book}</span>
                  </div>
                {/if}
              </div>

              <div class="novel-book-info">
                <h3 class="novel-book-title">{novel.title}</h3>

                <div class="novel-book-tags">
                  {#if novel.shelfId}
                    <span
                      class="novel-status-tag"
                      style="background-color: {getShelfColor(novel.shelfId)}"
                      title={getShelfName(novel.shelfId)}
                    >
                      <span class="shelf-icon">{@html getShelfIcon(novel.shelfId)}</span>
                      <span class="shelf-name">{getShelfName(novel.shelfId)}</span>
                    </span>
                  {/if}

                  {#each novel.tags || [] as tagId}
                    {#if tags.find((t) => t.id === tagId)}
                      <span class="novel-tag" style="background-color: {getTagColor(tagId)}">
                        {getTagName(tagId)}
                      </span>
                    {/if}
                  {/each}
                </div>

                <div class="novel-book-footer">
                  <div class="novel-book-status">
                    {#if isNewBook(novel)}
                      <div class="novel-new-badge">新增</div>
                    {:else if novel.progress !== undefined && novel.progress > 0}
                      <span class="novel-progress-text">{Math.floor(novel.progress)}%</span>
                    {/if}
                  </div>

                  <div class="novel-menu-container">
                    <button
                      class="novel-more-button"
                      on:click|stopPropagation={(e) => toggleMenu(e, novel)}
                      aria-label="更多操作"
                    >
                      •••
                    </button>

                    {#if activeMenuNovel === novel}
                      <div
                        class="novel-more-menu"
                        class:menu-top={menuPosition?.direction === 'top'}
                        class:menu-left={menuPosition?.direction === 'left'}
                        data-alignment={menuPosition?.alignment}
                        on:click|stopPropagation
                      >
                        <button
                          class="novel-menu-item"
                          on:click|stopPropagation={() => toggleFavorite(activeMenuNovel)}
                        >
                          <span class="menu-icon">
                            {@html isFavorite(activeMenuNovel.id) ? icons.heartFilled : icons.heart}
                          </span>
                          <span>{isFavorite(activeMenuNovel.id) ? '取消喜爱' : '添加到喜爱'}</span>
                        </button>

                        <div class="novel-menu-divider"></div>

                        <button
                          class="novel-menu-item"
                          on:click|stopPropagation={(e) =>
                            handleOpenChapterGrid(activeMenuNovel, e)}
                        >
                          <span class="menu-icon">{@html icons.list}</span>
                          <span>图书目录</span>
                        </button>

                        <div class="submenu">
                          <button class="novel-menu-item">
                            <span class="menu-icon">{@html icons.shelf}</span>
                            <span>添加到书架</span>
                          </button>
                          <div class="submenu-content">
                            {#each customShelves as shelf}
                              <button
                                class="novel-menu-item submenu-item"
                                on:click|stopPropagation={() =>
                                  addToCustomShelf(activeMenuNovel, shelf)}
                              >
                                {shelf.name}
                              </button>
                            {/each}
                          </div>
                        </div>

                        <button
                          class="novel-menu-item"
                          on:click|stopPropagation={(e) => handleShelfManage(activeMenuNovel, e)}
                        >
                          <span class="menu-icon">{@html icons.shelf}</span>
                          <span>选择书架</span>
                        </button>

                        <button
                          class="novel-menu-item"
                          on:click|stopPropagation={(e) => handleTagManage(activeMenuNovel, e)}
                        >
                          <span class="menu-icon">{@html icons.tag}</span>
                          <span>管理标签</span>
                        </button>

                        <button
                          class="novel-menu-item"
                          on:click|stopPropagation={(e) => handleCategoryManage(activeMenuNovel, e)}
                        >
                          <span class="menu-icon">{@html icons.folderOpen}</span>
                          <span>管理分类</span>
                        </button>

                        <button
                          class="novel-menu-item"
                          on:click|stopPropagation={(e) =>
                            handleOpenNoteWithCheck(activeMenuNovel, e)}
                        >
                          <span class="menu-icon">{@html icons.info}</span>
                          <span>图书信息</span>
                        </button>

                        <button
                          class="novel-menu-item"
                          on:click|stopPropagation={(e) => handleOpenStats(activeMenuNovel, e)}
                        >
                          <span class="menu-icon">{@html icons.barChart}</span>
                          <span>阅读统计</span>
                        </button>

                        <button
                          class="novel-menu-item"
                          on:click|stopPropagation={(e) =>
                            handleRemoveWithCheck(activeMenuNovel, e)}
                        >
                          <span class="menu-icon">{@html icons.trash}</span>
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

  {#if filteredNovels.length === 0}
    <div class="empty-message">暂无图书，请点击"添加图书"按钮添加</div>
  {/if}

  <!-- 添加模态框组件 -->
  {#if showTagManager && currentNovel}
    <div class="modal-backdrop" on:click|self={() => (showTagManager = false)}>
      <TagManagerModal
        novel={currentNovel}
        {tags}
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
    <div class="modal-backdrop" on:click|self={() => (showCategoryManager = false)}>
      <CategoryManagerModal
        novel={currentNovel}
        {categories}
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
    <div class="modal-backdrop" on:click|self={() => (showShelfManager = false)}>
      <ShelfManagerModal
        novel={currentNovel}
        {shelves}
        on:close={() => {
          showShelfManager = false;
          currentNovel = null;
        }}
        on:save={handleShelfSave}
      />
    </div>
  {/if}

  <!-- 阅读统计弹窗 -->
  {#if showStatsModal && statsNovel}
    <NovelStatsModal
      novel={statsNovel}
      {plugin}
      isOpen={showStatsModal}
      on:close={closeStatsModal}
    />
  {/if}

  <!-- 高级筛选模态弹窗 -->
  <AdvancedFilterModal
    bind:show={showFilterModal}
    {shelves}
    {categories}
    {tags}
    {currentFilters}
    on:apply={handleApplyFilters}
    on:reset={handleResetFilters}
    on:close={() => (showFilterModal = false)}
  />
</div>

<!-- 样式已整合到全局 styles.css 中 -->
