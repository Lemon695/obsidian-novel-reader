import { ItemView, Notice, WorkspaceLeaf } from 'obsidian';
import type { Novel } from '../types';
import NovelStatsComponent from '../components/NovelStatsComponent.svelte';
import EnhancedNovelStatsComponent from '../components/EnhancedNovelStatsComponent.svelte';
import { ReadingStatsService } from '../services/reading-stats-service';
import { VIEW_TYPE_STATS } from '../types/constants';
import type NovelReaderPlugin from '../main';
import type { ComponentType } from 'svelte';

export class NovelStatsView extends ItemView {
  private component: { $destroy: () => void } | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private plugin: NovelReaderPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_STATS;
  }

  getDisplayText(): string {
    return '阅读统计';
  }

  async setNovel(novel: Novel) {
    try {
      const container = this.contentEl;
      container.empty();

      // 清理旧组件
      if (this.component) {
        this.component.$destroy();
        this.component = null;
      }

      // 使用统计服务获取数据
      const statsService = new ReadingStatsService(this.app, this.plugin);
      const stats = await statsService.getNovelStats(novel.id);

      if (!stats) {
        new Notice('暂无阅读数据');
      }

      this.component = new (NovelStatsComponent as unknown as ComponentType)({
        target: container,
        props: {
          novel,
          stats: stats || undefined,
        },
      });

      await this.app.workspace.revealLeaf(this.leaf);
    } catch (error) {
      console.error('Error loading stats:', error);
      new Notice('加载统计数据失败');
    }
  }

  async onClose(): Promise<void> {
    if (this.component) {
      this.component.$destroy();
      this.component = null;
    }
  }

  private formatStats(stats: Record<string, unknown>) {
    // 格式化统计数据以适应组件显示
    const dailyStats = Array.isArray(stats.dailyStats) ? stats.dailyStats : [];
    const chapterStats = Array.isArray(stats.chapterStats) ? stats.chapterStats : [];
    const totalStats = (stats.totalStats as Record<string, unknown>) || {};

    return {
      dailyReadTime: dailyStats.map((day: unknown) => {
        const dayObj = day as Record<string, unknown>;
        return {
          date: dayObj.date,
          duration: dayObj.read_time,
        };
      }),
      chapterStats: chapterStats.map((chapter: unknown) => {
        const chapterObj = chapter as Record<string, unknown>;
        return {
          id: chapterObj.chapter_id,
          timeSpent: chapterObj.total_time,
          readCount: chapterObj.read_count,
        };
      }),
      totalStats: {
        totalTime: totalStats.total_time,
        sessionsCount: totalStats.total_sessions,
      },
    };
  }
}
