import { ItemView, WorkspaceLeaf } from 'obsidian';
import type NovelReaderPlugin from '../../main';
import type { Novel, ReadingProgress } from '../../types';
import { VIEW_TYPE_MOBI_READER } from '../../types/constants';
import MobiReaderViewComponent from '../../components/mobi/MobiReaderViewComponent.svelte';

/**
 * MOBI 阅读器视图
 * 管理 MOBI 阅读器组件的生命周期和事件
 */
export class MobiNovelReaderView extends ItemView {
    public component: MobiReaderViewComponent | null = null;
    public novel: Novel | null = null;
    private dataReady = false;
    private currentSessionId: string | undefined;
    private eventUnsubscribers: Array<() => void> = [];

    constructor(leaf: WorkspaceLeaf, private plugin: NovelReaderPlugin) {
        super(leaf);
    }

    getViewType(): string {
        return VIEW_TYPE_MOBI_READER;
    }

    getDisplayText(): string {
        return this.novel?.title || 'MOBI Reader';
    }

    /**
     * 设置小说数据并初始化组件
     */
    async setNovelData(novel: Novel, options?: { initialSection?: number }) {
        this.novel = novel;
        this.dataReady = true;

        await this.leaf.setViewState({
            type: VIEW_TYPE_MOBI_READER,
            state: {
                title: novel.title,
                initialSection: options?.initialSection
            }
        });

        if (this.contentEl) {
            await this.initializeComponent(options?.initialSection);
        }
    }

    /**
     * 初始化 MOBI 阅读器组件
     */
    private async initializeComponent(initialSection?: number) {
        if (!this.dataReady || !this.novel) {
            console.log('[MobiView] Data not ready yet');
            return;
        }

        console.log('[MobiView] Initializing MOBI component:', this.novel.title);
        const container = this.contentEl;
        container.empty();

        // 获取上次阅读进度
        const progress = await this.plugin.libraryService.getProgress(this.novel.id);
        console.log('[MobiView] Retrieved reading progress:', progress);

        // 确定初始章节
        let selectSection = initialSection;
        if (selectSection === undefined && progress?.position?.chapterId !== undefined) {
            selectSection = progress.position.chapterId;
        }
        if (selectSection === undefined) {
            selectSection = 0;
        }

        console.log('[MobiView] Selected section:', selectSection);

        try {
            // 开始新的阅读会话
            this.currentSessionId = await this.plugin.statsService?.startReadingSession(
                this.novel.id,
                selectSection,
                `Section ${selectSection}`
            );
            console.log('[MobiView] Started reading session:', this.currentSessionId);
        } catch (error) {
            console.error('[MobiView] Failed to start reading session:', error);
        }

        // 创建 Svelte 组件
        this.component = new MobiReaderViewComponent({
            target: container,
            props: {
                novel: this.novel,
                plugin: this.plugin,
                initialSection: selectSection
            }
        });

        // 注册事件监听
        this.registerEventListeners();
    }

    /**
     * 注册事件监听器
     */
    private registerEventListeners(): void {
        if (!this.component) return;

        // 监听进度保存事件
        const saveProgressHandler = async (event: CustomEvent) => {
            if (!this.novel) return;

            try {
                await this.plugin.libraryService.updateProgress(
                    this.novel.id,
                    event.detail.progress
                );
                console.log('[MobiView] Progress saved');
            } catch (error) {
                console.error('[MobiView] Failed to save progress:', error);
            }
        };

        // 监听章节变化事件
        const sectionChangedHandler = async (event: CustomEvent) => {
            if (!this.novel) return;

            const { sectionId, sectionTitle } = event.detail;
            console.log('[MobiView] Section changed:', sectionId, sectionTitle);

            try {
                // 记录历史
                await this.plugin.chapterHistoryService.addHistory(
                    this.novel.id,
                    sectionId,
                    sectionTitle
                );

                // 更新阅读会话
                if (this.currentSessionId) {
                    await this.plugin.statsService?.endReadingSession(this.currentSessionId);
                }

                this.currentSessionId = await this.plugin.statsService?.startReadingSession(
                    this.novel.id,
                    sectionId,
                    sectionTitle
                );
            } catch (error) {
                console.error('[MobiView] Failed to handle section change:', error);
            }
        };

        // 订阅事件
        const unsubSaveProgress = this.component.$on('saveProgress', saveProgressHandler);
        const unsubSectionChanged = this.component.$on('sectionChanged', sectionChangedHandler);

        this.eventUnsubscribers.push(
            unsubSaveProgress,
            unsubSectionChanged
        );
    }

    /**
     * 视图关闭时的清理
     */
    async onClose(): Promise<void> {
        console.log('[MobiView] Closing view');

        // 结束阅读会话
        if (this.currentSessionId) {
            await this.plugin.statsService?.endReadingSession(this.currentSessionId);
            this.currentSessionId = undefined;
        }

        // 取消事件订阅
        if (this.component) {
            this.eventUnsubscribers.forEach(unsub => {
                try {
                    unsub();
                } catch (error) {
                    console.error('[MobiView] Error unsubscribing event:', error);
                }
            });
            this.eventUnsubscribers = [];
        }

        // 销毁组件
        if (this.component) {
            this.component.$destroy();
            this.component = null;
        }
    }

    /**
     * 查找已存在的 MOBI 阅读视图
     */
    static findExistingView(app: any, novelId: string): MobiNovelReaderView | null {
        const leaves = app.workspace.getLeavesOfType(VIEW_TYPE_MOBI_READER);
        for (const leaf of leaves) {
            const view = leaf.view as MobiNovelReaderView;
            if (view?.novel?.id === novelId) {
                return view;
            }
        }
        return null;
    }
}
