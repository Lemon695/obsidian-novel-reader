<script lang="ts">
	import { onMount } from 'svelte';
	import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
	import type { Novel } from '../types';

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
	$: completionRate = Math.round((stats.yearlyGoal.current / stats.yearlyGoal.target) * 100);

	function formatDate(timestamp: number): string {
		if (!timestamp) return '未知';
		const date = new Date(timestamp);
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	}
</script>

<div class="completed-view">
	<div class="header">
		<h2>阅读完成情况</h2>
		<button class="refresh-button" on:click={onRefresh}>
			<span class="refresh-icon">🔄</span>
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
		padding: 20px;
		height: 100%;
		overflow-y: auto;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 24px;
	}

	.refresh-button {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 8px 12px;
		border-radius: 20px;
		border: 1px solid var(--background-modifier-border);
		background: var(--background-primary);
		cursor: pointer;
		transition: all 0.2s;
	}

	.refresh-button:hover {
		background: var(--background-modifier-hover);
	}

	.stats-cards {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 20px;
		margin-bottom: 30px;
	}

	.stat-card {
		background: var(--background-secondary);
		padding: 20px;
		border-radius: 10px;
		text-align: center;
	}

	.stat-value {
		font-size: 36px;
		font-weight: bold;
		color: var(--interactive-accent);
		margin: 10px 0;
	}

	.stat-subtext {
		color: var(--text-muted);
		font-size: 14px;
	}

	.progress-bar {
		width: 100%;
		height: 6px;
		background: var(--background-modifier-border);
		border-radius: 3px;
		margin: 10px 0;
	}

	.progress {
		height: 100%;
		background: var(--interactive-accent);
		border-radius: 3px;
		transition: width 0.3s ease;
	}

	.chart-container {
		background: var(--background-secondary);
		padding: 20px;
		border-radius: 10px;
		margin-bottom: 30px;
	}

	.completed-list {
		background: var(--background-secondary);
		padding: 20px;
		border-radius: 10px;
	}

	.book-item {
		padding: 15px;
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
		font-size: 16px;
	}

	.completion-date {
		font-size: 14px;
		color: var(--text-muted);
	}

	.book-tags {
		margin-top: 8px;
		display: flex;
		gap: 8px;
		flex-wrap: wrap;
	}

	.tag {
		font-size: 12px;
		padding: 2px 8px;
		border-radius: 12px;
		background: var(--background-modifier-success);
		color: var(--text-on-accent);
	}
</style>
