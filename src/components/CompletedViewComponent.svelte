<script lang="ts">
	import { onMount } from 'svelte';
	import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

	const months = ['一月', '二月', '三月', '四月', '五月', '六月',
		'七月', '八月', '九月', '十月', '十一月', '十二月'];

	// 准备图表数据
	$: chartData = months.map((month, index) => ({
		name: month,
		value: stats.monthlyStats[index]
	}));

	// 计算目标完成率
	$: completionRate = formatPercentage(stats.yearlyGoal.current, stats.yearlyGoal.target, 0).replace('%', '');
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
		<h3>已读完图书</h3>
		<div class="list-container">
			{#each novels.sort((a, b) => (b.lastRead || 0) - (a.lastRead || 0)) as novel}
				<div class="book-item">
					<div class="book-info">
						<h4>{novel.title}</h4>
						<span class="completion-date">完成于: {formatDate(novel.lastRead)}</span>
					</div>
					{#if novel.tags?.length}
						<div class="book-tags">
							{#each novel.tags as tagId}
								<span class="tag">{tagId}</span>
							{/each}
						</div>
					{/if}
				</div>
			{/each}
		</div>
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
		padding: var(--novel-spacing-sm);
		border-radius: var(--novel-radius-full);
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		cursor: pointer;
		transition: var(--novel-transition-base);
	}

	.refresh-button:hover {
		background: var(--background-modifier-hover);
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
	}

	.completed-list {
		background: var(--background-secondary);
		padding: var(--novel-spacing-lg);
		border-radius: var(--novel-radius-md);
	}

	.book-item {
		padding: var(--novel-spacing-md);
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.book-item:last-child {
		border-bottom: none;
	}

	.book-info {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.book-info h4 {
		margin: 0;
		font-size: var(--novel-font-size-md);
	}

	.completion-date {
		font-size: var(--novel-font-size-base);
		color: var(--text-muted);
	}

	.book-tags {
		margin-top: var(--novel-spacing-sm);
		display: flex;
		gap: var(--novel-spacing-sm);
		flex-wrap: wrap;
	}

	.tag {
		font-size: var(--novel-font-size-sm);
		padding: var(--novel-spacing-xs) var(--novel-spacing-sm);
		border-radius: var(--novel-radius-lg);
		background: var(--background-modifier-success);
		color: var(--text-on-accent);
	}
</style>
