<script lang="ts">
  import { createEventDispatcher, onMount } from 'svelte';
  import type { Novel } from '../types';
  import type NovelReaderPlugin from '../main';
  import { icons } from './library/icons';
  import { ReadingStatsService } from '../services/reading-stats-service';
  import { Notice, FuzzySuggestModal } from 'obsidian';

  const dispatch = createEventDispatcher();

  export let novel: Novel;
  export let plugin: NovelReaderPlugin;
  export let isOpen = false;

  let loading = true;
  let stats: any = null;
  let activeTab = 'overview'; // overview, trends, patterns, achievements
  let selectedPeriod = 'week'; // week, month, quarter, year
  let chartData: any = null;

  // 时间范围选项
  const periodOptions = [
    { value: 'week', label: '最近7天', days: 7 },
    { value: 'month', label: '最近30天', days: 30 },
    { value: 'quarter', label: '最近3个月', days: 90 },
    { value: 'year', label: '最近一年', days: 365 },
  ];

  // 标签页选项
  const tabs = [
    { id: 'overview', label: '概览', icon: 'barChart' },
    { id: 'trends', label: '趋势分析', icon: 'trendingUp' },
    { id: 'patterns', label: '阅读模式', icon: 'clock' },
    { id: 'achievements', label: '成就统计', icon: 'award' },
  ];

  onMount(async () => {
    await loadStats();
  });

  async function loadStats() {
    loading = true;
    try {
      const statsService = new ReadingStatsService(plugin.app, plugin);
      stats = await statsService.getNovelStats(novel.id);
      await generateChartData();
    } catch (error) {
      console.error('Failed to load stats:', error);
      new Notice('加载统计数据失败');
    } finally {
      loading = false;
    }
  }

  async function generateChartData() {
    if (!stats) return;

    const period = periodOptions.find((p) => p.value === selectedPeriod);
    const days = period?.days || 7;

    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

    chartData = {
      daily: generateDailyData(startDate, endDate),
      hourly: generateHourlyData(),
      weekly: generateWeeklyData(),
    };
  }

  function generateDailyData(startDate: Date, endDate: Date) {
    const data = [];
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      const dayStats = stats.dailyStats?.find((d: any) => d.date === dateKey);

      data.push({
        date: dateKey,
        duration: dayStats?.duration || 0,
        sessions: dayStats?.sessions || 0,
        label: currentDate.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }),
      });

      currentDate.setDate(currentDate.getDate() + 1);
    }

    return data;
  }

  function generateHourlyData() {
    // 生成24小时的阅读分布数据
    const hours = Array.from({ length: 24 }, (_, i) => ({
      hour: `${i.toString().padStart(2, '0')}:00`,
      duration: 0,
      sessions: 0,
    }));

    // 这里应该从实际数据中统计，暂时返回空数据
    return hours;
  }

  function generateWeeklyData() {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    // 这里应该从实际数据中统计，暂时返回空数据
    return weekdays.map((day) => ({
      day,
      duration: 0,
      sessions: 0,
    }));
  }

  function close() {
    dispatch('close');
  }

  function formatDuration(ms: number): string {
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}小时${minutes}分钟`;
    }
    return `${minutes}分钟`;
  }

  function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    return date.toLocaleDateString('zh-CN');
  }

  async function exportToMarkdown() {
    try {
      // 创建文件夹选择器
      class FolderSuggestModal extends FuzzySuggestModal<string> {
        folders: string[];
        onChoose: (folder: string) => void;

        constructor(app: any, folders: string[], onChoose: (folder: string) => void) {
          super(app);
          this.folders = folders;
          this.onChoose = onChoose;
        }

        getItems(): string[] {
          return this.folders;
        }

        getItemText(item: string): string {
          return item || '根目录';
        }

        onChooseItem(item: string): void {
          this.onChoose(item);
        }
      }

      // 获取所有文件夹
      const folders = ['']; // 根目录
      plugin.app.vault.getAllLoadedFiles().forEach((file) => {
        if (file.children) {
          // 是文件夹
          folders.push(file.path);
        }
      });

      // 显示文件夹选择器
      new FolderSuggestModal(plugin.app, folders, async (selectedFolder) => {
        const content = generateMarkdownReport();
        const fileName = `${novel.title}_阅读统计_${new Date().toISOString().split('T')[0]}.md`;
        const filePath = selectedFolder ? `${selectedFolder}/${fileName}` : fileName;

        try {
          await plugin.app.vault.create(filePath, content);
          new Notice(`统计报告已导出到: ${filePath}`);
        } catch (error) {
          console.error('Export failed:', error);
          new Notice('导出失败: ' + error.message);
        }
      }).open();
    } catch (error) {
      console.error('Export failed:', error);
      new Notice('导出失败，请检查权限');
    }
  }

  function generateMarkdownReport(): string {
    const now = new Date().toLocaleString('zh-CN');
    const period = periodOptions.find((p) => p.value === selectedPeriod);

    let report = `# ${novel.title} - 阅读统计报告

**生成时间**: ${now}  
**作者**: ${novel.author || '未知'}  
**格式**: ${novel.type?.toUpperCase() || '未知'}  

## 📊 基础统计

| 指标 | 数值 |
|------|------|
| 今日阅读时长 | ${formatDuration(stats?.todayTime || 0)} |
| 总阅读时长 | ${formatDuration(stats?.totalTime || 0)} |
| 平均阅读速度 | ${Math.round(stats?.averageSpeed || 0)} 字/分钟 |
| 阅读天数 | ${stats?.readingDays || 0} 天 |
| 连续阅读天数 | ${stats?.readingStreak || 0} 天 |
| 阅读进度 | ${(stats?.completionRate || 0).toFixed(1)}% |

## 📈 阅读趋势 (${period?.label})

### 每日阅读时长

`;

    if (chartData?.daily && chartData.daily.length > 0) {
      chartData.daily.forEach((day: any) => {
        if (day.duration > 0) {
          report += `- ${day.label}: ${day.duration}分钟 (${day.sessions}次会话)\n`;
        }
      });
    } else {
      report += '暂无数据\n';
    }

    report += `
## 🕐 阅读模式分析

### 阅读习惯
- **最活跃时段**: 待分析
- **平均会话时长**: ${Math.round((stats?.totalTime || 0) / Math.max(1, stats?.readingDays || 1) / 60000)}分钟
- **阅读习惯**: ${stats?.readingStreak > 7 ? '规律阅读者 ⭐' : '偶尔阅读者'}

## 🎯 阅读成就

`;

    // 成就列表
    const achievements = [
      {
        name: '连续阅读达人',
        condition: stats?.readingStreak >= 7,
        progress: `${stats?.readingStreak}/7 天`,
      },
      {
        name: '时间管理大师',
        condition: (stats?.totalTime || 0) >= 3600000,
        progress: `${Math.round((stats?.totalTime || 0) / 60000)}/60 分钟`,
      },
      {
        name: '速读高手',
        condition: (stats?.averageSpeed || 0) >= 300,
        progress: `${Math.round(stats?.averageSpeed || 0)}/300 字/分`,
      },
      {
        name: '阅读进度王',
        condition: (stats?.completionRate || 0) >= 50,
        progress: `${(stats?.completionRate || 0).toFixed(1)}/50.0 %`,
      },
    ];

    achievements.forEach((achievement) => {
      const status = achievement.condition ? '✅' : '⏳';
      report += `- ${status} **${achievement.name}**: ${achievement.progress}\n`;
    });

    report += `
## 📖 阅读记录

- **首次阅读**: ${stats?.firstReadTime || '未开始'}
- **最后阅读**: ${stats?.lastChapter || '无记录'}
- **最长连续阅读**: ${stats?.readingStreak || 0} 天

---

*报告由 Novel Reader 插件自动生成*
`;

    return report;
  }

  function switchTab(tabId: string) {
    activeTab = tabId;
  }

  async function changePeriod(period: string) {
    selectedPeriod = period;
    await generateChartData();
  }
</script>

{#if isOpen}
  <div class="modal-backdrop" on:click={close}>
    <div class="stats-modal" on:click|stopPropagation>
      <div class="modal-header">
        <div class="header-left">
          <h2>
            <span class="header-icon">{@html icons.barChart}</span>
            阅读统计分析
          </h2>
          <p class="novel-title">{novel.title}</p>
        </div>
        <div class="header-actions">
          <button class="export-btn" on:click={exportToMarkdown} title="导出Markdown报告">
            {@html icons.download}
            <span>导出</span>
          </button>
          <button class="close-btn" on:click={close} title="关闭">
            {@html icons.close}
          </button>
        </div>
      </div>

      <div class="modal-body">
        {#if loading}
          <div class="loading">
            <div class="loading-spinner"></div>
            <p>加载统计数据中...</p>
          </div>
        {:else if stats}
          <!-- 标签页导航 -->
          <div class="tabs-nav">
            {#each tabs as tab}
              <button
                class="tab-btn"
                class:active={activeTab === tab.id}
                on:click={() => switchTab(tab.id)}
              >
                <span class="tab-icon">{@html icons[tab.icon] || icons.barChart}</span>
                {tab.label}
              </button>
            {/each}
          </div>

          <!-- 时间范围选择器 -->
          {#if activeTab === 'trends'}
            <div class="period-selector">
              <label>时间范围:</label>
              <select bind:value={selectedPeriod} on:change={() => changePeriod(selectedPeriod)}>
                {#each periodOptions as option}
                  <option value={option.value}>{option.label}</option>
                {/each}
              </select>
            </div>
          {/if}

          <!-- 标签页内容 -->
          <div class="tab-content">
            {#if activeTab === 'overview'}
              <!-- 概览页面 -->
              <div class="stats-grid">
                <div class="stat-card primary">
                  <div class="stat-icon">{@html icons.clock}</div>
                  <div class="stat-content">
                    <div class="stat-label">今日阅读</div>
                    <div class="stat-value">{formatDuration(stats.todayTime)}</div>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon">{@html icons.bookOpen}</div>
                  <div class="stat-content">
                    <div class="stat-label">总阅读时长</div>
                    <div class="stat-value">{formatDuration(stats.totalTime)}</div>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon">{@html icons.zap}</div>
                  <div class="stat-content">
                    <div class="stat-label">平均速度</div>
                    <div class="stat-value">{Math.round(stats.averageSpeed)} 字/分</div>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon">{@html icons.calendar}</div>
                  <div class="stat-content">
                    <div class="stat-label">阅读天数</div>
                    <div class="stat-value">{stats.readingDays} 天</div>
                  </div>
                </div>

                <div class="stat-card highlight">
                  <div class="stat-icon">{@html icons.flame}</div>
                  <div class="stat-content">
                    <div class="stat-label">连续阅读</div>
                    <div class="stat-value">{stats.readingStreak} 天</div>
                    <div class="stat-trend">🔥 保持良好习惯</div>
                  </div>
                </div>

                <div class="stat-card">
                  <div class="stat-icon">{@html icons.target}</div>
                  <div class="stat-content">
                    <div class="stat-label">阅读进度</div>
                    <div class="stat-value">{stats.completionRate.toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              <!-- 快速洞察 -->
              <div class="insights-section">
                <h3>📊 阅读洞察</h3>
                <div class="insights-grid">
                  <div class="insight-card">
                    <h4>阅读习惯</h4>
                    <p>
                      {stats.readingStreak > 7
                        ? '您是一位规律的阅读者！'
                        : '建议保持更规律的阅读习惯'}
                    </p>
                  </div>
                  <div class="insight-card">
                    <h4>阅读效率</h4>
                    <p>
                      您的阅读速度为 {Math.round(stats.averageSpeed)} 字/分钟，{stats.averageSpeed >
                      300
                        ? '效率很高！'
                        : '可以适当提升'}
                    </p>
                  </div>
                  <div class="insight-card">
                    <h4>进度预测</h4>
                    <p>
                      按当前进度，预计还需 {Math.ceil(
                        (100 - stats.completionRate) /
                          Math.max(1, stats.completionRate / stats.readingDays)
                      )} 天完成
                    </p>
                  </div>
                </div>
              </div>
            {:else if activeTab === 'trends'}
              <!-- 趋势分析页面 -->
              <div class="trends-section">
                <h3>📈 阅读趋势分析</h3>

                <!-- 每日趋势图表 -->
                <div class="chart-container">
                  <h4>
                    每日阅读时长 ({periodOptions.find((p) => p.value === selectedPeriod)?.label})
                  </h4>
                  <div class="daily-chart">
                    {#if chartData?.daily && chartData.daily.length > 0}
                      {#each chartData.daily as day}
                        <div class="chart-bar">
                          <div
                            class="bar-fill"
                            style="height: {Math.min(100, (day.duration / 120) * 100)}%"
                            title="{day.label}: {day.duration}分钟, {day.sessions}次会话"
                          ></div>
                          <div class="bar-label">
                            {day.label.split('/')[1] || day.label.split('-')[2]}
                          </div>
                        </div>
                      {/each}
                    {:else}
                      <p class="no-chart-data">暂无数据</p>
                    {/if}
                  </div>
                </div>

                <!-- 统计摘要 -->
                <div class="trend-summary">
                  <div class="summary-card">
                    <h4>平均每日</h4>
                    <p>
                      {Math.round(
                        (stats.totalTime || 0) / Math.max(1, stats.readingDays || 1) / 60000
                      )} 分钟
                    </p>
                  </div>
                  <div class="summary-card">
                    <h4>最长单日</h4>
                    <p>{Math.max(...(chartData?.daily?.map((d) => d.duration) || [0]))} 分钟</p>
                  </div>
                  <div class="summary-card">
                    <h4>活跃天数</h4>
                    <p>{chartData?.daily?.filter((d) => d.duration > 0).length || 0} 天</p>
                  </div>
                </div>
              </div>
            {:else if activeTab === 'patterns'}
              <!-- 阅读模式页面 -->
              <div class="patterns-section">
                <h3>🕐 阅读模式分析</h3>

                <div class="pattern-info">
                  <div class="info-card">
                    <h4>平均会话时长</h4>
                    <p class="info-value">
                      {Math.round(
                        (stats.totalTime || 0) / Math.max(1, stats.readingDays || 1) / 60000
                      )} 分钟
                    </p>
                  </div>
                  <div class="info-card">
                    <h4>阅读习惯</h4>
                    <p class="info-value">
                      {stats.readingStreak > 7 ? '规律阅读者 ⭐' : '偶尔阅读者'}
                    </p>
                  </div>
                </div>

                {#if stats.firstReadTime}
                  <div class="reading-history">
                    <h4>阅读记录</h4>
                    <p><strong>首次阅读：</strong>{stats.firstReadTime}</p>
                    {#if stats.lastChapter}
                      <p><strong>最后阅读：</strong>{stats.lastChapter}</p>
                    {/if}
                  </div>
                {/if}
              </div>
            {:else if activeTab === 'achievements'}
              <!-- 成就统计页面 -->
              <div class="achievements-section">
                <h3>🎯 阅读成就</h3>

                <div class="achievements-grid">
                  <div class="achievement-card {stats.readingStreak >= 7 ? 'unlocked' : 'locked'}">
                    <div class="achievement-icon">🔥</div>
                    <div class="achievement-content">
                      <h4>连续阅读达人</h4>
                      <p>连续阅读7天</p>
                      <div class="progress-bar">
                        <div
                          class="progress-fill"
                          style="width: {Math.min(100, (stats.readingStreak / 7) * 100)}%"
                        ></div>
                      </div>
                      <span class="progress-text">{stats.readingStreak}/7 天</span>
                    </div>
                  </div>

                  <div
                    class="achievement-card {stats.totalTime >= 3600000 ? 'unlocked' : 'locked'}"
                  >
                    <div class="achievement-icon">⏰</div>
                    <div class="achievement-content">
                      <h4>时间管理大师</h4>
                      <p>累计阅读1小时</p>
                      <div class="progress-bar">
                        <div
                          class="progress-fill"
                          style="width: {Math.min(100, (stats.totalTime / 3600000) * 100)}%"
                        ></div>
                      </div>
                      <span class="progress-text"
                        >{Math.round(stats.totalTime / 60000)}/60 分钟</span
                      >
                    </div>
                  </div>

                  <div class="achievement-card {stats.averageSpeed >= 300 ? 'unlocked' : 'locked'}">
                    <div class="achievement-icon">⚡</div>
                    <div class="achievement-content">
                      <h4>速读高手</h4>
                      <p>阅读速度达到300字/分钟</p>
                      <div class="progress-bar">
                        <div
                          class="progress-fill"
                          style="width: {Math.min(100, (stats.averageSpeed / 300) * 100)}%"
                        ></div>
                      </div>
                      <span class="progress-text">{Math.round(stats.averageSpeed)}/300 字/分</span>
                    </div>
                  </div>

                  <div
                    class="achievement-card {stats.completionRate >= 50 ? 'unlocked' : 'locked'}"
                  >
                    <div class="achievement-icon">📖</div>
                    <div class="achievement-content">
                      <h4>阅读进度王</h4>
                      <p>完成50%阅读进度</p>
                      <div class="progress-bar">
                        <div
                          class="progress-fill"
                          style="width: {Math.min(100, (stats.completionRate / 50) * 100)}%"
                        ></div>
                      </div>
                      <span class="progress-text">{stats.completionRate.toFixed(1)}/50.0 %</span>
                    </div>
                  </div>
                </div>
              </div>
            {/if}
          </div>
        {:else}
          <div class="no-data">
            <div class="no-data-icon">{@html icons.bookOpen}</div>
            <h3>暂无阅读统计数据</h3>
            <p>开始阅读后将自动记录统计信息</p>
          </div>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style>
  .modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    padding: var(--size-4-4);
    animation: fadeIn 0.2s ease-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }

  .stats-modal {
    background: var(--background-primary);
    border-radius: var(--novel-radius-lg);
    max-width: 1200px;
    width: 100%;
    max-height: 90vh;
    display: flex;
    flex-direction: column;
    box-shadow: var(--novel-shadow-lg);
    border: 1px solid var(--background-modifier-border);
    overflow: hidden;
    animation: modalSlideIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  @keyframes modalSlideIn {
    from {
      opacity: 0;
      transform: scale(0.9) translateY(20px);
    }
    to {
      opacity: 1;
      transform: scale(1) translateY(0);
    }
  }

  .modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--novel-spacing-lg) var(--novel-spacing-xl);
    border-bottom: 1px solid var(--background-modifier-border);
    background: var(--background-secondary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .header-left h2 {
    margin: 0;
    font-size: var(--novel-font-size-xl);
    display: flex;
    align-items: center;
    gap: var(--size-4-3);
    color: var(--text-normal);
    font-weight: var(--novel-font-weight-semibold);
  }

  .novel-title {
    margin: var(--size-4-1) 0 0 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
    font-weight: 500;
  }

  .header-icon :global(svg) {
    width: 24px;
    height: 24px;
    color: var(--text-on-accent);
    filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.2));
  }

  .header-actions {
    display: flex;
    gap: var(--size-4-2);
  }

  .export-btn,
  .close-btn {
    background: var(--background-modifier-hover);
    border: 1px solid var(--background-modifier-border);
    cursor: pointer;
    padding: var(--size-4-2) var(--size-4-4);
    color: var(--text-normal);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: var(--size-4-2);
    border-radius: var(--radius-m);
    transition: all 0.2s ease;
    font-size: var(--font-ui-small);
    font-weight: 500;
  }

  .export-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .close-btn:hover {
    background: rgba(255, 255, 255, 0.2);
    border-color: rgba(255, 255, 255, 0.4);
    transform: scale(1.1);
  }

  .export-btn :global(svg),
  .close-btn :global(svg) {
    width: 16px;
    height: 16px;
  }

  .modal-body {
    padding: var(--size-4-6);
    overflow-y: auto;
    flex: 1;
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--size-4-12);
    color: var(--text-muted);
  }

  .loading-spinner {
    width: 40px;
    height: 40px;
    border: 3px solid var(--background-modifier-border);
    border-top: 3px solid var(--interactive-accent);
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin-bottom: var(--size-4-4);
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .tabs-nav {
    display: flex;
    gap: var(--size-4-2);
    margin-bottom: var(--size-4-6);
    border-bottom: 2px solid var(--background-modifier-border);
    padding: 0 var(--size-4-2);
  }

  .tab-btn {
    background: none;
    border: none;
    padding: var(--size-4-3) var(--size-4-5);
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: var(--size-4-2);
    color: var(--text-muted);
    border-radius: var(--radius-m) var(--radius-m) 0 0;
    transition: all 0.2s ease;
    font-size: var(--font-ui-small);
    font-weight: 500;
    position: relative;
  }

  .tab-btn:hover {
    background: var(--background-modifier-hover);
    color: var(--text-normal);
    transform: translateY(-2px);
  }

  .tab-btn.active {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    box-shadow: 0 -2px 8px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .tab-btn.active::after {
    content: '';
    position: absolute;
    bottom: -2px;
    left: 0;
    right: 0;
    height: 3px;
    background: var(--interactive-accent);
  }

  .tab-icon :global(svg) {
    width: 16px;
    height: 16px;
  }

  .period-selector {
    display: flex;
    align-items: center;
    gap: var(--size-4-3);
    margin-bottom: var(--size-4-4);
    padding: var(--size-4-4);
    background: var(--background-secondary);
    border-radius: var(--radius-l);
    border: 2px solid var(--background-modifier-border);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .period-selector label {
    font-size: var(--font-ui-small);
    font-weight: 600;
    color: var(--text-normal);
  }

  .period-selector select {
    background: var(--background-primary);
    border: 2px solid var(--background-modifier-border);
    border-radius: var(--radius-m);
    padding: var(--size-4-2) var(--size-4-3);
    color: var(--text-normal);
    cursor: pointer;
    font-weight: 500;
    transition: all 0.2s ease;
  }

  .period-selector select:hover {
    border-color: var(--interactive-accent);
  }

  .period-selector select:focus {
    outline: none;
    border-color: var(--interactive-accent);
    box-shadow: 0 0 0 3px rgba(var(--interactive-accent-rgb), 0.15);
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--size-4-4);
    margin-bottom: var(--size-4-6);
  }

  .stat-card {
    background: var(--background-secondary);
    padding: var(--size-4-6);
    border-radius: var(--radius-l);
    display: flex;
    align-items: center;
    gap: var(--size-4-4);
    transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    border: 2px solid var(--background-modifier-border);
    position: relative;
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  }

  .stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: var(--interactive-accent);
    opacity: 0;
    transition: opacity 0.3s ease;
  }

  .stat-card:hover {
    transform: translateY(-6px);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.15);
    border-color: var(--interactive-accent);
  }

  .stat-card:hover::before {
    opacity: 1;
  }

  .stat-card.primary {
    background: var(--interactive-accent);
    color: var(--text-on-accent);
    border-color: transparent;
    box-shadow: 0 4px 16px rgba(var(--interactive-accent-rgb), 0.3);
  }

  .stat-card.primary:hover {
    box-shadow: 0 12px 32px rgba(var(--interactive-accent-rgb), 0.4);
  }

  .stat-card.highlight {
    border-color: var(--text-warning);
  }

  .stat-icon {
    font-size: 32px;
    color: var(--interactive-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: var(--radius-m);
    background-color: rgba(var(--interactive-accent-rgb), 0.1);
  }

  .stat-card.primary .stat-icon {
    color: var(--text-on-accent);
    background-color: rgba(255, 255, 255, 0.2);
  }

  .stat-icon :global(svg) {
    width: 24px;
    height: 24px;
  }

  .stat-content {
    flex: 1;
  }

  .stat-label {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
    margin-bottom: var(--size-4-1);
    font-weight: 500;
  }

  .stat-card.primary .stat-label {
    color: rgba(255, 255, 255, 0.8);
  }

  .stat-value {
    font-size: var(--font-ui-large);
    color: var(--text-normal);
    font-weight: 700;
    margin-bottom: var(--size-4-1);
  }

  .stat-card.primary .stat-value {
    color: var(--text-on-accent);
  }

  .stat-trend {
    font-size: var(--font-ui-smaller);
    color: var(--text-success);
    font-weight: 500;
  }

  .insights-section {
    margin-top: var(--size-4-8);
  }

  .insights-section h3 {
    margin: 0 0 var(--size-4-4) 0;
    color: var(--text-normal);
    font-size: var(--font-ui-medium);
  }

  .insights-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--size-4-4);
  }

  .insight-card {
    background-color: var(--background-secondary);
    padding: var(--size-4-4);
    border-radius: var(--radius-m);
    border-left: 4px solid var(--interactive-accent);
  }

  .insight-card h4 {
    margin: 0 0 var(--size-4-2) 0;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
  }

  .insight-card p {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
    line-height: 1.4;
  }

  .chart-container {
    background-color: var(--background-secondary);
    padding: var(--size-4-4);
    border-radius: var(--radius-m);
    margin-bottom: var(--size-4-4);
  }

  .chart-container h4 {
    margin: 0 0 var(--size-4-4) 0;
    font-size: var(--font-ui-medium);
    color: var(--text-normal);
  }

  .daily-chart {
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    height: 200px;
    gap: var(--size-4-1);
    padding: var(--size-4-4);
    background-color: var(--background-primary);
    border-radius: var(--radius-m);
  }

  .chart-bar {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    max-width: 40px;
  }

  .bar-fill {
    width: 100%;
    background: var(--interactive-accent);
    border-radius: var(--radius-s) var(--radius-s) 0 0;
    transition: all 0.3s;
    cursor: pointer;
    min-height: 4px;
  }

  .bar-fill:hover {
    opacity: 0.8;
    transform: scaleY(1.05);
  }

  .bar-label {
    margin-top: var(--size-4-2);
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .no-chart-data {
    text-align: center;
    color: var(--text-muted);
    padding: var(--size-4-8);
  }

  .trend-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
    gap: var(--size-4-3);
  }

  .summary-card {
    background-color: var(--background-secondary);
    padding: var(--size-4-3);
    border-radius: var(--radius-m);
    text-align: center;
  }

  .summary-card h4 {
    margin: 0 0 var(--size-4-2) 0;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }

  .summary-card p {
    margin: 0;
    font-size: var(--font-ui-medium);
    font-weight: 600;
    color: var(--text-normal);
  }

  .pattern-info {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: var(--size-4-4);
    margin-bottom: var(--size-4-6);
  }

  .info-card {
    background-color: var(--background-secondary);
    padding: var(--size-4-4);
    border-radius: var(--radius-m);
    text-align: center;
  }

  .info-card h4 {
    margin: 0 0 var(--size-4-2) 0;
    font-size: var(--font-ui-small);
    color: var(--text-muted);
  }

  .info-value {
    margin: 0;
    font-size: var(--font-ui-large);
    font-weight: 600;
    color: var(--text-normal);
  }

  .reading-history {
    background-color: var(--background-secondary);
    padding: var(--size-4-4);
    border-radius: var(--radius-m);
  }

  .reading-history h4 {
    margin: 0 0 var(--size-4-3) 0;
    font-size: var(--font-ui-medium);
    color: var(--text-normal);
  }

  .reading-history p {
    margin: var(--size-4-2) 0;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
  }

  .achievements-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: var(--size-4-4);
  }

  .achievement-card {
    background-color: var(--background-secondary);
    padding: var(--size-4-5);
    border-radius: var(--radius-l);
    display: flex;
    align-items: center;
    gap: var(--size-4-4);
    transition: all 0.3s;
    border: 2px solid transparent;
  }

  .achievement-card.unlocked {
    border-color: var(--text-success);
    background: linear-gradient(
      135deg,
      var(--background-secondary),
      rgba(var(--text-success-rgb), 0.1)
    );
  }

  .achievement-card.locked {
    opacity: 0.6;
  }

  .achievement-icon {
    font-size: 32px;
    width: 48px;
    height: 48px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-m);
    background-color: rgba(var(--interactive-accent-rgb), 0.1);
  }

  .achievement-content {
    flex: 1;
  }

  .achievement-content h4 {
    margin: 0 0 var(--size-4-1) 0;
    color: var(--text-normal);
    font-size: var(--font-ui-small);
  }

  .achievement-content p {
    margin: 0 0 var(--size-4-2) 0;
    color: var(--text-muted);
    font-size: var(--font-ui-smaller);
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background-color: var(--background-modifier-border);
    border-radius: var(--radius-s);
    overflow: hidden;
    margin-bottom: var(--size-4-1);
  }

  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--interactive-accent), var(--interactive-accent-hover));
    transition: width 0.3s;
  }

  .progress-text {
    font-size: var(--font-ui-smaller);
    color: var(--text-muted);
  }

  .no-data {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: var(--size-4-12);
    text-align: center;
  }

  .no-data-icon {
    font-size: 64px;
    color: var(--text-muted);
    margin-bottom: var(--size-4-4);
    opacity: 0.5;
  }

  .no-data-icon :global(svg) {
    width: 64px;
    height: 64px;
  }

  .no-data h3 {
    margin: 0 0 var(--size-4-2) 0;
    color: var(--text-normal);
  }

  .no-data p {
    margin: 0;
    color: var(--text-muted);
    font-size: var(--font-ui-small);
  }
</style>
