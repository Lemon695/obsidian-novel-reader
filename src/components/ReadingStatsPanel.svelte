<script lang="ts">
	import {createEventDispatcher} from 'svelte';
	import {onMount} from 'svelte';
	import type {Novel} from "../types";

	const dispatch = createEventDispatcher();

	export let isOpen = false;
	export let novelId: string;
	export let novel: Novel;

	export let readingStats: any = null;
	let processedData: any = null;

	function processStats() {
		if (!readingStats?.stats) return;

		// 计算今日阅读时间(转换为分钟)
		const todayKey = new Date().toISOString().split('T')[0];
		const todayStats = readingStats.stats.dailyStats[todayKey];
		const todayTime = todayStats ? Math.round(todayStats.totalDuration / (1000 * 60)) : 0;

		// 计算总阅读时间(转换为分钟)
		const totalTime = Math.round(readingStats.stats.totalReadingTime / (1000 * 60));

		// 计算平均每次阅读时间(分钟)
		const avgSessionTime = Math.round(readingStats.stats.averageSessionTime / (1000 * 60));

		// 获取阅读天数
		const readingDays = Object.keys(readingStats.stats.dailyStats).length;

		// 计算连续阅读天数
		const readingStreak = calculateReadingStreak(readingStats.stats.dailyStats);

		// 处理阅读进度
		const progress = calculateProgress();

		// 处理每日阅读记录
		const dailyRecords = processDailyStats();

		// 更新组件状态
		return {
			todayTime,
			totalTime,
			avgSessionTime,
			readingDays,
			readingStreak,
			firstReadTime: formatFirstReadTime(readingStats.stats.firstReadTime),
			progress,
			dailyRecords
		};
	}

	// 计算连续阅读天数
	function calculateReadingStreak(dailyStats: any): number {
		let streak = 0;
		const today = new Date();
		let currentDate = new Date(today);

		while (true) {
			const dateKey = currentDate.toISOString().split('T')[0];
			if (!dailyStats[dateKey]) break;

			streak++;
			currentDate.setDate(currentDate.getDate() - 1);
		}

		return streak;
	}

	// 格式化首次阅读时间
	function formatFirstReadTime(timestamp: number): string {
		if (!timestamp) return '未开始阅读';

		const date = new Date(timestamp);
		return date.toLocaleDateString('zh-CN', {
			year: 'numeric',
			month: '2-digit',
			day: '2-digit'
		});
	}

	// 格式化时间展示
	function formatTime(minutes: number): string {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return hours > 0 ? `${hours}小时${mins}分钟` : `${mins}分钟`;
	}

	// 计算阅读进度
	function calculateProgress(): number {
		if (!readingStats?.stats?.chapterStats) return 0;

		const lastChapterId = Math.max(...Object.keys(readingStats.stats.chapterStats).map(Number));
		const totalChapters = novel?.totalChapters || 0;

		if (totalChapters === 0) return 0;
		return Math.round((lastChapterId / totalChapters) * 100);
	}

	// 处理每日阅读记录
	function processDailyStats(): Array<{ date: string; duration: number }> {
		if (!readingStats?.stats?.dailyStats) return [];

		return Object.entries(readingStats.stats.dailyStats)
			.map(([date, stats]: [string, any]) => ({
				date,
				duration: Math.round(stats.totalDuration / (1000 * 60)) // 转换为分钟
			}))
			.sort((a, b) => b.date.localeCompare(a.date)) // 按日期倒序
			.slice(0, 7); // 只取最近7天
	}

	onMount(() => {
		if (readingStats) {
			processedData = processStats();
		}
	});

	// 监听readingStats变化
	$: if (readingStats) {
		processedData = processStats();
	}

	// 添加日期格式化函数
	function formatDate(dateStr: string): string {
		const date = new Date(dateStr);
		return date.toLocaleDateString('zh-CN', {
			month: '2-digit',
			day: '2-digit'
		});
	}

</script>

<div class="stats-panel" class:open={isOpen}>
	<header class="panel-header">
		<h2>阅读统计</h2>
		<button class="close-button" on:click={() => dispatch('close')}>×</button>
	</header>

	<div class="panel-content">
		<!-- 基础统计卡片 -->
		<div class="stats-cards">
			<div class="stat-card">
				<h3>今日阅读</h3>
				{#if processedData?.todayTime}
					<p class="stat-value">{formatTime(processedData.todayTime)}</p>
				{:else}
					<p class="stat-value">-</p>
				{/if}
			</div>

			<div class="stat-card">
				<h3>累计阅读</h3>
				{#if processedData?.totalTime}
					<p class="stat-value">{formatTime(processedData.totalTime)}</p>
				{:else}
					<p class="stat-value">-</p>
				{/if}
			</div>

			<div class="stat-card">
				<h3>平均时长</h3>
				{#if processedData?.avgSessionTime}
					<p class="stat-value">{formatTime(processedData.avgSessionTime)}</p>
				{:else}
					<p class="stat-value">-</p>
				{/if}
			</div>

			<div class="stat-card">
				<h3>阅读天数</h3>
				{#if processedData?.readingDays}
					<p class="stat-value">{processedData.readingDays}天</p>
				{:else}
					<p class="stat-value">-</p>
				{/if}
			</div>

			<div class="stat-card">
				<h3>首次阅读</h3>
				{#if processedData?.firstReadTime}
					<p class="stat-value">{processedData.firstReadTime}</p>
				{:else}
					<p class="stat-value">-</p>
				{/if}
			</div>

			<div class="stat-card">
				<h3>连续阅读</h3>
				{#if processedData?.readingStreak}
					<p class="stat-value">{processedData.readingStreak}天</p>
				{:else}
					<p class="stat-value">-</p>
				{/if}
			</div>
		</div>

		<!-- 阅读进度 -->
		{#if processedData?.progress !== undefined}
			<div class="progress-section">
				<h3>阅读进度</h3>
				<div class="progress-bar">
					<div
						class="progress"
						style="width: {processedData.progress}%"
					></div>
				</div>
				<p class="progress-text">
					当前进度: {processedData.progress}%
				</p>
			</div>
		{/if}

		<!-- 简单的数据列表替代图表 -->
		{#if processedData?.dailyRecords?.length}
			<div class="data-section">
				<h3>每日阅读记录</h3>
				<div class="data-list">
					{#each processedData.dailyRecords as record}
						<div class="data-item">
							<span class="date">{formatDate(record.date)}</span>
							<span class="value">{formatTime(record.duration)}</span>
						</div>
					{/each}
				</div>
			</div>
		{:else}
			<div class="empty-message">暂无阅读记录</div>
		{/if}

		<!-- 导出按钮 -->
		<div class="actions">
			<button
				class="export-button"
				on:click={() => dispatch('exportStats')}
			>
				导出报告
			</button>
		</div>
	</div>
</div>

<style>
	.stats-panel {
		position: fixed;
		top: 0;
		right: -400px;
		width: 400px;
		height: 90vh;
		background: var(--background-primary);
		border-left: 1px solid var(--background-modifier-border);
		transition: transform 0.3s ease;
		display: flex;
		flex-direction: column;
		z-index: 1000;
	}

	.stats-panel.open {
		transform: translateX(-400px);
	}

	.panel-header {
		padding: 16px;
		border-bottom: 1px solid var(--background-modifier-border);
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.panel-content {
		flex: 1;
		overflow-y: auto;
		padding: 16px;
	}

	.stats-cards {
		display: grid;
		grid-template-columns: repeat(2, 1fr);
		gap: 16px;
		margin-bottom: 24px;
	}

	.stat-card {
		background: var(--background-secondary);
		padding: 16px;
		border-radius: 8px;
		text-align: center;
	}

	.stat-value {
		font-size: 24px;
		font-weight: bold;
		color: var(--interactive-accent);
		margin: 8px 0;
	}

	.progress-section {
		margin: 20px 0;
		padding: 16px;
		background: var(--background-secondary);
		border-radius: 8px;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background: var(--background-modifier-border); /* 背景灰色 */
		border-radius: 4px;
		margin: 16px 0;
		overflow: hidden;  /* 确保子元素不超出圆角边框 */
		position: relative; /* 为子元素定位提供参考 */
	}

	.progress {
		position: absolute;  /* 绝对定位以实现填充效果 */
		left: 0;
		top: 0;
		height: 100%;
		background: var(--interactive-accent); /* 使用主题强调色 */
		border-radius: 4px;
		transition: width 0.3s ease;  /* 平滑过渡动画 */
	}

	.actions {
		text-align: center;
		padding: 16px;
	}

	.export-button {
		padding: 8px 16px;
		background: var(--interactive-accent);
		color: var(--text-on-accent);
		border: none;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s;
	}

	.export-button:hover {
		filter: brightness(1.1);
	}

	.close-button {
		background: none;
		border: none;
		font-size: 24px;
		cursor: pointer;
		color: var(--text-muted);
	}

	.data-section {
		margin-bottom: 24px;
		padding: 16px;
		background: var(--background-secondary);
		border-radius: 8px;
	}

	.data-list {
		max-height: 250px;
		overflow-y: auto;
		margin-top: 12px;
	}

	.data-item {
		display: flex;
		justify-content: space-between;
		padding: 8px 12px;
		border-bottom: 1px solid var(--background-modifier-border);
	}

	.data-item:last-child {
		border-bottom: none;
	}

	.date {
		flex: 1;
	}

	.value {
		flex: 1;
		text-align: center;
	}

	.empty-message {
		text-align: center;
		padding: 20px;
		color: var(--text-muted);
	}
</style>
