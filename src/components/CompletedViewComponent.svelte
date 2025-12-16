<script lang="ts">
  import { onMount } from 'svelte';
  import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
  } from 'recharts';
  import type { Novel } from '../types';
  import { icons } from './library/icons';
  import { formatDate, formatPercentage } from '../utils/format-utils';

  export let novels: Novel[] = [];
  export let stats: {
    totalCompleted: number;
    monthlyStats: number[];
    yearlyGoal: {
      current: number;
      target: number;
    };
  };
  export let onRefresh: () => Promise<void>;

  // 排序和过滤状态
  let sortBy: 'date' | 'title' = 'date';
  let filterFormat: 'all' | 'txt' | 'epub' | 'pdf' = 'all';
  let searchQuery = '';

  const months = [
    '一月',
    '二月',
    '三月',
    '四月',
    '五月',
    '六月',
    '七月',
    '八月',
    '九月',
    '十月',
    '十一月',
    '十二月',
  ];

  // 准备图表数据
  $: chartData = months.map((month, index) => ({
    name: month,
    value: stats.monthlyStats[index],
  }));

  // 计算目标完成率
  $: completionRate = formatPercentage(
    stats.yearlyGoal.current,
    stats.yearlyGoal.target,
    0
  ).replace('%', '');

  // 过滤和排序图书
  $: filteredAndSortedNovels = novels
    .filter((novel) => {
      // 格式过滤
      if (filterFormat !== 'all' && novel.format !== filterFormat) {
        return false;
      }
      // 搜索过滤
      if (searchQuery && !novel.title.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    })
    .sort((a, b) => {
      if (sortBy === 'date') {
        return (b.lastRead || 0) - (a.lastRead || 0);
      } else {
        return a.title.localeCompare(b.title, 'zh-CN');
      }
    });

  // 统计格式分布
  $: formatStats = {
    txt: novels.filter((n) => n.format === 'txt').length,
    epub: novels.filter((n) => n.format === 'epub').length,
    pdf: novels.filter((n) => n.format === 'pdf').length,
  };
</script>

<div class="completed-view">
  <div class="header">
    <h2>阅读完成情况</h2>
    <button class="refresh-button" on:click={onRefresh}>
      <span class="refresh-icon">{@html icons.refresh}</span>
      刷新
    </button>
  </div>

  <div class="stats-cards">
    <div class="stat-card">
      <h3>今年已读完</h3>
      <div class="stat-value">{stats.yearlyGoal.current}</div>
      <div class="stat-subtext">目标: {stats.yearlyGoal.target}本</div>
      <div class="progress-bar">
        <div class="progress" style="width: {completionRate}%"></div>
      </div>
      <div class="stat-subtext">{completionRate}% 完成</div>
    </div>

    <div class="stat-card">
      <h3>总计读完</h3>
      <div class="stat-value">{stats.totalCompleted}</div>
      <div class="stat-subtext">累计完成书籍</div>
    </div>

    <div class="stat-card">
      <h3>格式分布</h3>
      <div class="format-stats">
        <div class="format-item">
          <span class="format-label">TXT:</span>
          <span class="format-value">{formatStats.txt}</span>
        </div>
        <div class="format-item">
          <span class="format-label">EPUB:</span>
          <span class="format-value">{formatStats.epub}</span>
        </div>
        <div class="format-item">
          <span class="format-label">PDF:</span>
          <span class="format-value">{formatStats.pdf}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="chart-container">
    <h3>月度完成情况</h3>
    <div class="chart" style="height: 300px;">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--interactive-accent)"
            strokeWidth={2}
            dot={{ fill: 'var(--interactive-accent)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  </div>

  <div class="completed-list">
    <div class="list-header">
      <h3>已读完图书 ({filteredAndSortedNovels.length})</h3>

      <div class="controls">
        <!-- 搜索框 -->
        <div class="search-box">
          <input type="text" placeholder="搜索书名..." bind:value={searchQuery} />
        </div>

        <!-- 格式过滤 -->
        <div class="filter-group">
          <label>格式:</label>
          <select bind:value={filterFormat}>
            <option value="all">全部</option>
            <option value="txt">TXT</option>
            <option value="epub">EPUB</option>
            <option value="pdf">PDF</option>
          </select>
        </div>

        <!-- 排序选择 -->
        <div class="sort-group">
          <label>排序:</label>
          <select bind:value={sortBy}>
            <option value="date">完成时间</option>
            <option value="title">书名</option>
          </select>
        </div>
      </div>
    </div>

    <!-- 卡片式布局 -->
    <div class="book-grid">
      {#each filteredAndSortedNovels as novel}
        <div class="book-card">
          <div class="book-card-header">
            <h4 class="book-title">{novel.title}</h4>
            <span class="format-badge {novel.format}">{novel.format.toUpperCase()}</span>
          </div>

          <div class="book-card-body">
            <div class="book-meta">
              <span class="meta-item">
                <span class="meta-label">完成日期:</span>
                <span class="meta-value">{formatDate(novel.lastRead)}</span>
              </span>
              {#if novel.author && novel.author !== 'Unknown'}
                <span class="meta-item">
                  <span class="meta-label">作者:</span>
                  <span class="meta-value">{novel.author}</span>
                </span>
              {/if}
            </div>

            {#if novel.tags?.length}
              <div class="book-tags">
                {#each novel.tags as tagId}
                  <span class="tag">{tagId}</span>
                {/each}
              </div>
            {/if}
          </div>
        </div>
      {/each}
    </div>

    {#if filteredAndSortedNovels.length === 0}
      <div class="empty-state">
        <p>没有找到已读完的图书</p>
      </div>
    {/if}
  </div>
</div>

<style>
  .completed-view {
    padding: var(--novel-spacing-lg);
    height: 100%;
    overflow-y: auto;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--novel-spacing-lg);
  }

  .refresh-button {
    display: flex;
    align-items: center;
    gap: var(--novel-spacing-xs);
    padding: var(--novel-spacing-sm) var(--novel-spacing-md);
    border-radius: var(--novel-radius-md);
    border: 1px solid var(--background-modifier-border);
    background: var(--background-primary);
    cursor: pointer;
    transition: var(--novel-transition-base);
  }

  .refresh-button:hover {
    background: var(--background-modifier-hover);
    transform: translateY(-1px);
  }

  .refresh-icon :global(svg) {
    width: 16px;
    height: 16px;
    stroke: currentColor;
  }

  .stats-cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: var(--novel-spacing-lg);
    margin-bottom: var(--novel-spacing-2xl);
  }

  .stat-card {
    background: var(--background-secondary);
    padding: var(--novel-spacing-lg);
    border-radius: var(--novel-radius-md);
    text-align: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .stat-value {
    font-size: var(--novel-font-size-3xl);
    font-weight: bold;
    color: var(--interactive-accent);
    margin: var(--novel-spacing-sm) 0;
  }

  .stat-subtext {
    color: var(--text-muted);
    font-size: var(--novel-font-size-base);
  }

  .format-stats {
    display: flex;
    flex-direction: column;
    gap: var(--novel-spacing-xs);
    margin-top: var(--novel-spacing-md);
  }

  .format-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .format-label {
    font-size: var(--novel-font-size-sm);
    color: var(--text-muted);
  }

  .format-value {
    font-size: var(--novel-font-size-md);
    font-weight: 600;
    color: var(--text-normal);
  }

  .progress-bar {
    width: 100%;
    height: 6px;
    background: var(--background-modifier-border);
    border-radius: var(--novel-radius-sm);
    margin: var(--novel-spacing-sm) 0;
  }

  .progress {
    height: 100%;
    background: var(--interactive-accent);
    border-radius: var(--novel-radius-sm);
    transition: var(--novel-transition-slow);
  }

  .chart-container {
    background: var(--background-secondary);
    padding: var(--novel-spacing-lg);
    border-radius: var(--novel-radius-md);
    margin-bottom: var(--novel-spacing-2xl);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .completed-list {
    background: var(--background-secondary);
    padding: var(--novel-spacing-lg);
    border-radius: var(--novel-radius-md);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .list-header {
    margin-bottom: var(--novel-spacing-lg);
  }

  .list-header h3 {
    margin-bottom: var(--novel-spacing-md);
  }

  .controls {
    display: flex;
    gap: var(--novel-spacing-md);
    flex-wrap: wrap;
    align-items: center;
  }

  .search-box input {
    padding: var(--novel-spacing-sm) var(--novel-spacing-md);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--novel-radius-md);
    background: var(--background-primary);
    min-width: 200px;
  }

  .filter-group,
  .sort-group {
    display: flex;
    align-items: center;
    gap: var(--novel-spacing-xs);
  }

  .filter-group label,
  .sort-group label {
    font-size: var(--novel-font-size-sm);
    color: var(--text-muted);
  }

  .filter-group select,
  .sort-group select {
    padding: var(--novel-spacing-sm) var(--novel-spacing-md);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--novel-radius-md);
    background: var(--background-primary);
    cursor: pointer;
  }

  /* 卡片网格布局 */
  .book-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: var(--novel-spacing-lg);
  }

  .book-card {
    background: var(--background-primary);
    border: 1px solid var(--background-modifier-border);
    border-radius: var(--novel-radius-md);
    padding: var(--novel-spacing-md);
    transition: var(--novel-transition-base);
    display: flex;
    flex-direction: column;
    gap: var(--novel-spacing-md);
  }

  .book-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .book-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--novel-spacing-sm);
  }

  .book-title {
    margin: 0;
    font-size: var(--novel-font-size-md);
    font-weight: 600;
    flex: 1;
  }

  .format-badge {
    padding: 2px 8px;
    border-radius: var(--novel-radius-sm);
    font-size: 10px;
    font-weight: 600;
    text-transform: uppercase;
  }

  .format-badge.txt {
    background: rgba(99, 102, 241, 0.2);
    color: rgb(99, 102, 241);
  }

  .format-badge.epub {
    background: rgba(168, 85, 247, 0.2);
    color: rgb(168, 85, 247);
  }

  .format-badge.pdf {
    background: rgba(239, 68, 68, 0.2);
    color: rgb(239, 68, 68);
  }

  .book-card-body {
    flex: 1;
  }

  .book-meta {
    display: flex;
    flex-direction: column;
    gap: var(--novel-spacing-xs);
    margin-bottom: var(--novel-spacing-sm);
  }

  .meta-item {
    display: flex;
    gap: var(--novel-spacing-xs);
    font-size: var(--novel-font-size-sm);
  }

  .meta-label {
    color: var(--text-muted);
  }

  .meta-value {
    color: var(--text-normal);
  }

  .book-tags {
    display: flex;
    gap: var(--novel-spacing-xs);
    flex-wrap: wrap;
    margin-top: var(--novel-spacing-sm);
  }

  .tag {
    font-size: var(--novel-font-size-xs);
    padding: 2px 8px;
    border-radius: var(--novel-radius-lg);
    background: var(--background-modifier-success);
    color: var(--text-on-accent);
  }

  .empty-state {
    text-align: center;
    padding: var(--novel-spacing-2xl);
    color: var(--text-muted);
  }
</style>
