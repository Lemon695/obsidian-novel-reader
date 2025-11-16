<script lang="ts">
	import type {Novel} from '../types';
	import {onMount} from 'svelte';
	import Chart from 'chart.js/auto';
	import type {EnhancedNovelStats} from "../types/enhanced-stats";
	import type NovelReaderPlugin from '../main';

	export let novel: Novel;
	export let plugin: NovelReaderPlugin;

	let stats: EnhancedNovelStats | null = null;
	let loading = true;
	let chartCanvas: HTMLCanvasElement;
	let speedChartCanvas: HTMLCanvasElement;
	let chart: Chart;
	let speedChart: Chart;

	onMount(async () => {
		await loadStats();

		return () => {
			if (chart) chart.destroy();
			if (speedChart) speedChart.destroy();
		};
	});

	async function loadStats() {
		loading = true;
		try {
			// 尝试从新系统加载
			if (plugin.settings.useEnhancedStats && plugin.statsAdapter) {
				stats = await plugin.statsAdapter.getEnhancedNovelStats(novel.id);
			}

			if (stats) {
				initCharts();
			}
		} catch (error) {
			console.error('加载统计数据失败:', error);
		} finally {
			loading = false;
		}
	}

	function initCharts() {
		if (!stats) return;

		// 阅读时长趋势图
		initDurationChart();

		// 阅读速度趋势图
		initSpeedChart();
	}

	function initDurationChart() {
		const ctx = chartCanvas?.getContext('2d');
		if (!ctx || !stats) return;

		const dailyStats = Object.entries(stats.timeAnalysis.dailyStats).map(([date, stat]) => ({
			date,
			duration: Math.round(stat.totalDuration / (1000 * 60)) // 分钟
		})).sort((a, b) => a.date.localeCompare(b.date)).slice(-30); // 最近30天

		const accentColor = getComputedStyle(document.body).getPropertyValue('--interactive-accent');

		chart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: dailyStats.map(stat => formatShortDate(stat.date)),
				datasets: [{
					label: '阅读时长（分钟）',
					data: dailyStats.map(stat => stat.duration),
					borderColor: accentColor,
					backgroundColor: `${accentColor}33`,
					tension: 0.3,
					fill: true
				}]
			},
			options: getChartOptions('阅读时长（分钟）')
		});
	}

	function initSpeedChart() {
		const ctx = speedChartCanvas?.getContext('2d');
		if (!ctx || !stats) return;

		const speedData = stats.behaviorStats.speedHistory.slice(-20); // 最近20个记录

		const accentColor = getComputedStyle(document.body).getPropertyValue('--interactive-accent');
		const successColor = getComputedStyle(document.body).getPropertyValue('--text-success') || '#4caf50';

		speedChart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: speedData.map((_, i) => `#${i + 1}`),
				datasets: [{
					label: '阅读速度（字/分钟）',
					data: speedData.map(s => s.speed),
					backgroundColor: `${successColor}99`,
					borderColor: successColor,
					borderWidth: 1
				}]
			},
			options: getChartOptions('阅读速度（字/分钟）')
		});
	}

	function getChartOptions(label: string) {
		return {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				legend: {
					labels: {
						color: getComputedStyle(document.body).getPropertyValue('--text-normal')
					}
				},
				tooltip: {
					backgroundColor: getComputedStyle(document.body).getPropertyValue('--background-secondary'),
					titleColor: getComputedStyle(document.body).getPropertyValue('--text-normal'),
					bodyColor: getComputedStyle(document.body).getPropertyValue('--text-normal'),
					borderColor: getComputedStyle(document.body).getPropertyValue('--background-modifier-border'),
					borderWidth: 1
				}
			},
			scales: {
				y: {
					beginAtZero: true,
					grid: {
						color: getComputedStyle(document.body).getPropertyValue('--background-modifier-border')
					},
					ticks: {
						color: getComputedStyle(document.body).getPropertyValue('--text-muted')
					}
				},
				x: {
					grid: {
						color: getComputedStyle(document.body).getPropertyValue('--background-modifier-border')
					},
					ticks: {
						color: getComputedStyle(document.body).getPropertyValue('--text-muted'),
						maxRotation: 45,
						minRotation: 0
					}
				}
			}
		};
	}

	function formatShortDate(dateStr: string): string {
		const date = new Date(dateStr);
		return `${date.getMonth() + 1}/${date.getDate()}`;
	}

	function formatDate(timestamp: number): string {
		if (!timestamp) return '未读';
		const date = new Date(timestamp);
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	}

	function formatDuration(ms: number): string {
		const hours = Math.floor(ms / (1000 * 60 * 60));
		const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

		if (hours > 0) {
			return `${hours}小时${minutes}分钟`;
		}
		return `${minutes}分钟`;
	}

	function formatSpeed(speed: number): string {
		return speed > 0 ? `${Math.round(speed)} 字/分钟` : '无数据';
	}

	// ============================================
	// 导出功能
	// ============================================

	async function exportAsMarkdown() {
		if (!stats) return;

		const markdown = generateMarkdownReport(stats);
		const filename = `${novel.title}-阅读统计-${formatDate(Date.now())}.md`;

		await plugin.app.vault.create(filename, markdown);
		new (window as any).Notice(`已导出为 Markdown: ${filename}`);
	}

	async function exportAsJSON() {
		if (!stats) return;

		const json = JSON.stringify(stats, null, 2);
		const filename = `${novel.title}-阅读统计-${formatDate(Date.now())}.json`;

		await plugin.app.vault.create(filename, json);
		new (window as any).Notice(`已导出为 JSON: ${filename}`);
	}

	async function exportAsCSV() {
		if (!stats) return;

		const csv = generateCSVReport(stats);
		const filename = `${novel.title}-阅读统计-${formatDate(Date.now())}.csv`;

		await plugin.app.vault.create(filename, csv);
		new (window as any).Notice(`已导出为 CSV: ${filename}`);
	}

	function generateMarkdownReport(stats: EnhancedNovelStats): string {
		return `# ${novel.title} - 阅读统计报告

> 生成时间: ${formatDate(Date.now())}

## 📖 基础统计

- **总阅读时间**: ${formatDuration(stats.basicStats.totalReadingTime)}
- **阅读会话数**: ${stats.basicStats.sessionsCount} 次
- **首次阅读**: ${formatDate(stats.basicStats.firstReadTime)}
- **最近阅读**: ${formatDate(stats.basicStats.lastReadTime)}

## 📊 阅读进度

- **当前进度**: ${stats.progressTracking.currentProgress.toFixed(1)}%
- **已完成章节**: ${stats.progressTracking.completedChapters.length} 章
- **总章节数**: ${stats.novel.totalChapters || 0} 章
- **书签数量**: ${stats.progressTracking.bookmarkedChapters.length} 个

## 🚀 阅读行为

- **平均阅读速度**: ${formatSpeed(stats.behaviorStats.averageReadingSpeed)}
- **最快速度**: ${formatSpeed(stats.behaviorStats.speedHistory.reduce((max, s) => Math.max(max, s.speed), 0))}
- **跳读次数**: ${stats.behaviorStats.jumpEvents.length} 次
- **重读次数**: ${Object.keys(stats.behaviorStats.rereadStats).length} 次
- **暂停/恢复**: ${stats.behaviorStats.pauseResumeCount} 次

## ⏰ 时间分析

### 偏好时段
- **偏好时段**: ${getTimeSlotName(stats.timeAnalysis.preferredTimeSlot)}

### 小时分布（Top 3）
${getTopHours(stats.timeAnalysis.hourlyDistribution).map(([hour, duration]) =>
	`- **${hour}:00**: ${formatDuration(duration)}`
).join('\n')}

### 星期分布（Top 3）
${getTopWeekdays(stats.timeAnalysis.weekdayDistribution).map(([day, duration]) =>
	`- **${getWeekdayName(day)}**: ${formatDuration(duration)}`
).join('\n')}

## 📝 章节统计（Top 10）

| 章节 | 阅读时长 | 阅读次数 | 平均速度 |
|------|----------|----------|----------|
${getTopChapters(stats.chapterStats).map(([id, chapter]) =>
	`| 第${id}章 | ${formatDuration(chapter.timeSpent)} | ${chapter.readCount}次 | ${formatSpeed(chapter.averageSpeed)} |`
).join('\n')}

## 📌 笔记关联

- **总笔记数**: ${stats.notesCorrelation.totalNotes} 条
- **平均每章笔记**: ${stats.notesCorrelation.averageNotesPerChapter.toFixed(1)} 条
- **笔记最多的章节**: ${stats.notesCorrelation.heatmapChapters.slice(0, 3).map(id => `第${id}章`).join('、')}

## 🏆 成就记录

### 里程碑
${stats.achievements.milestonesReached.length > 0 ? stats.achievements.milestonesReached.map(m => `- ${m}`).join('\n') : '暂无成就'}

### 连续阅读
- **当前连续天数**: ${stats.achievements.streakRecords.current} 天
- **最长连续天数**: ${stats.achievements.streakRecords.longest} 天
- **最长连续时间段**: ${stats.achievements.streakRecords.longestStartDate} 至 ${stats.achievements.streakRecords.longestEndDate}

### 时长记录
- **最长单次会话**: ${formatDuration(stats.achievements.timeRecords.singleSession)}
- **最长单日阅读**: ${formatDuration(stats.achievements.timeRecords.singleDay)}
- **最长单周阅读**: ${formatDuration(stats.achievements.timeRecords.singleWeek)}

---

*报告由 Novel Reader 插件自动生成*
`;
	}

	function generateCSVReport(stats: EnhancedNovelStats): string {
		const lines = [
			'类别,指标,数值',
			`基础统计,总阅读时间,${stats.basicStats.totalReadingTime}`,
			`基础统计,阅读会话数,${stats.basicStats.sessionsCount}`,
			`基础统计,首次阅读,${formatDate(stats.basicStats.firstReadTime)}`,
			`基础统计,最近阅读,${formatDate(stats.basicStats.lastReadTime)}`,
			`阅读进度,当前进度(%),${stats.progressTracking.currentProgress.toFixed(1)}`,
			`阅读进度,已完成章节,${stats.progressTracking.completedChapters.length}`,
			`阅读进度,总章节数,${stats.novel.totalChapters || 0}`,
			`阅读行为,平均速度(字/分钟),${stats.behaviorStats.averageReadingSpeed}`,
			`阅读行为,跳读次数,${stats.behaviorStats.jumpEvents.length}`,
			`阅读行为,重读次数,${Object.keys(stats.behaviorStats.rereadStats).length}`,
			'',
			'章节ID,阅读时长(ms),阅读次数,平均速度',
			...Object.entries(stats.chapterStats).map(([id, chapter]) =>
				`${id},${chapter.timeSpent},${chapter.readCount},${chapter.averageSpeed}`
			)
		];

		return lines.join('\n');
	}

	// 辅助函数
	function getTimeSlotName(slot: string): string {
		const names: {[key: string]: string} = {
			'morning': '上午',
			'afternoon': '下午',
			'evening': '晚上',
			'night': '深夜'
		};
		return names[slot] || slot;
	}

	function getWeekdayName(day: number): string {
		const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
		return names[day] || `Day${day}`;
	}

	function getTopHours(hourly: number[]): Array<[number, number]> {
		return hourly
			.map((duration, hour) => [hour, duration] as [number, number])
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3);
	}

	function getTopWeekdays(weekdays: number[]): Array<[number, number]> {
		return weekdays
			.map((duration, day) => [day, duration] as [number, number])
			.sort((a, b) => b[1] - a[1])
			.slice(0, 3);
	}

	function getTopChapters(chapters: {[key: number]: any}): Array<[number, any]> {
		return Object.entries(chapters)
			.map(([id, chapter]) => [Number(id), chapter] as [number, any])
			.sort((a, b) => b[1].timeSpent - a[1].timeSpent)
			.slice(0, 10);
	}
</script>

<div class="stats-container">
	{#if loading}
		<div class="loading">加载中...</div>
	{:else if !stats}
		<div class="no-data">
			<p>暂无统计数据</p>
			<p class="hint">开始阅读后将自动记录</p>
		</div>
	{:else}
		<!-- 标题和导出按钮 -->
		<div class="header">
			<h2 class="title">{novel.title} - 阅读统计</h2>
			<div class="export-buttons">
				<button class="export-btn" on:click={exportAsMarkdown} title="导出为Markdown">
					<span class="icon">📝</span>
					Markdown
				</button>
				<button class="export-btn" on:click={exportAsJSON} title="导出为JSON">
					<span class="icon">📋</span>
					JSON
				</button>
				<button class="export-btn" on:click={exportAsCSV} title="导出为CSV">
					<span class="icon">📊</span>
					CSV
				</button>
			</div>
		</div>

		<!-- 基础统计卡片 -->
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-icon">⏱️</div>
				<h3>总阅读时间</h3>
				<p class="stat-value">{formatDuration(stats.basicStats.totalReadingTime)}</p>
			</div>
			<div class="stat-card">
				<div class="stat-icon">📚</div>
				<h3>阅读会话</h3>
				<p class="stat-value">{stats.basicStats.sessionsCount} 次</p>
			</div>
			<div class="stat-card">
				<div class="stat-icon">📈</div>
				<h3>阅读进度</h3>
				<p class="stat-value">{stats.progressTracking.currentProgress.toFixed(1)}%</p>
				<p class="stat-sub">{stats.progressTracking.completedChapters.length}/{stats.novel.totalChapters || 0} 章</p>
			</div>
			<div class="stat-card">
				<div class="stat-icon">🚀</div>
				<h3>平均速度</h3>
				<p class="stat-value">{formatSpeed(stats.behaviorStats.averageReadingSpeed)}</p>
			</div>
			<div class="stat-card">
				<div class="stat-icon">📅</div>
				<h3>首次阅读</h3>
				<p class="stat-value">{formatDate(stats.basicStats.firstReadTime)}</p>
			</div>
			<div class="stat-card">
				<div class="stat-icon">🔖</div>
				<h3>书签数量</h3>
				<p class="stat-value">{stats.progressTracking.bookmarkedChapters.length} 个</p>
			</div>
			<div class="stat-card">
				<div class="stat-icon">📝</div>
				<h3>笔记总数</h3>
				<p class="stat-value">{stats.notesCorrelation.totalNotes} 条</p>
			</div>
			<div class="stat-card">
				<div class="stat-icon">🔥</div>
				<h3>连续阅读</h3>
				<p class="stat-value">{stats.achievements.streakRecords.current} 天</p>
				<p class="stat-sub">最长 {stats.achievements.streakRecords.longest} 天</p>
			</div>
		</div>

		<!-- 阅读时长趋势图 -->
		<div class="chart-container">
			<h3>📊 阅读时长趋势（最近30天）</h3>
			<div class="chart">
				<canvas bind:this={chartCanvas}></canvas>
			</div>
		</div>

		<!-- 阅读速度趋势图 -->
		{#if stats.behaviorStats.speedHistory.length > 0}
			<div class="chart-container">
				<h3>🚀 阅读速度变化</h3>
				<div class="chart">
					<canvas bind:this={speedChartCanvas}></canvas>
				</div>
			</div>
		{/if}

		<!-- 阅读行为分析 -->
		<div class="behavior-section">
			<h3>📖 阅读行为分析</h3>
			<div class="behavior-grid">
				<div class="behavior-item">
					<span class="label">跳读次数</span>
					<span class="value">{stats.behaviorStats.jumpEvents.length} 次</span>
				</div>
				<div class="behavior-item">
					<span class="label">重读章节</span>
					<span class="value">{Object.keys(stats.behaviorStats.rereadStats).length} 章</span>
				</div>
				<div class="behavior-item">
					<span class="label">暂停/恢复</span>
					<span class="value">{stats.behaviorStats.pauseResumeCount} 次</span>
				</div>
				<div class="behavior-item">
					<span class="label">连续阅读</span>
					<span class="value">{formatDuration(stats.behaviorStats.continuousReadingTime)}</span>
				</div>
			</div>
		</div>

		<!-- 时间分析 -->
		<div class="time-analysis-section">
			<h3>⏰ 时间分析</h3>
			<div class="time-grid">
				<div class="time-item">
					<span class="label">偏好时段</span>
					<span class="value">{getTimeSlotName(stats.timeAnalysis.preferredTimeSlot)}</span>
				</div>
				<div class="time-item">
					<span class="label">最长单次会话</span>
					<span class="value">{formatDuration(stats.achievements.timeRecords.singleSession)}</span>
				</div>
				<div class="time-item">
					<span class="label">最长单日阅读</span>
					<span class="value">{formatDuration(stats.achievements.timeRecords.singleDay)}</span>
				</div>
				<div class="time-item">
					<span class="label">最长单周阅读</span>
					<span class="value">{formatDuration(stats.achievements.timeRecords.singleWeek)}</span>
				</div>
			</div>
		</div>

		<!-- 章节统计 -->
		<div class="chapters-section">
			<h3>📖 章节统计（阅读时长 Top 10）</h3>
			<div class="chapters-list">
				{#each getTopChapters(stats.chapterStats) as [chapterId, chapter]}
					<div class="chapter-item">
						<span class="chapter-id">第 {chapterId} 章</span>
						<span class="chapter-time">{formatDuration(chapter.timeSpent)}</span>
						<span class="chapter-count">阅读 {chapter.readCount} 次</span>
						<span class="chapter-speed">{formatSpeed(chapter.averageSpeed)}</span>
					</div>
				{/each}
			</div>
		</div>

		<!-- 成就展示 -->
		{#if stats.achievements.milestonesReached.length > 0}
			<div class="achievements-section">
				<h3>🏆 成就记录</h3>
				<div class="achievements-grid">
					{#each stats.achievements.milestonesReached as milestone}
						<div class="achievement-card">
							<div class="achievement-icon">🎉</div>
							<div class="achievement-name">{milestone.name}</div>
							<div class="achievement-date">{formatDate(milestone.achievedAt)}</div>
						</div>
					{/each}
				</div>
			</div>
		{/if}
	{/if}
</div>

<style>
	.stats-container {
		padding: var(--size-4-4);
		height: 100%;
		overflow-y: auto;
	}

	.loading, .no-data {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		height: 400px;
		color: var(--text-muted);
	}

	.no-data .hint {
		font-size: var(--font-ui-small);
		margin-top: var(--size-4-1);
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: var(--size-4-6);
		flex-wrap: wrap;
		gap: var(--size-4-2);
	}

	.title {
		margin: 0;
		font-size: var(--font-ui-large);
		font-weight: 600;
		color: var(--text-normal);
	}

	.export-buttons {
		display: flex;
		gap: var(--size-4-2);
	}

	.export-btn {
		display: flex;
		align-items: center;
		gap: var(--size-4-1);
		padding: var(--size-4-2) var(--size-4-3);
		background-color: var(--interactive-normal);
		color: var(--text-normal);
		border: 1px solid var(--background-modifier-border);
		border-radius: var(--radius-s);
		cursor: pointer;
		transition: all 0.2s;
		font-size: var(--font-ui-small);
	}

	.export-btn:hover {
		background-color: var(--interactive-hover);
		transform: translateY(-1px);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
	}

	.export-btn .icon {
		font-size: 14px;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--size-4-3);
		margin-bottom: var(--size-4-6);
	}

	.stat-card {
		padding: var(--size-4-4);
		background-color: var(--background-secondary);
		border-radius: var(--radius-m);
		text-align: center;
		transition: all 0.2s;
		border: 1px solid transparent;
	}

	.stat-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		border-color: var(--background-modifier-border);
	}

	.stat-icon {
		font-size: 24px;
		margin-bottom: var(--size-4-2);
	}

	.stat-card h3 {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
		margin: 0 0 var(--size-4-2) 0;
		font-weight: 500;
	}

	.stat-value {
		font-size: var(--font-ui-medium);
		color: var(--interactive-accent);
		font-weight: 600;
		margin: 0;
	}

	.stat-sub {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		margin-top: var(--size-4-1);
	}

	.chart-container {
		margin-bottom: var(--size-4-6);
	}

	.chart-container h3 {
		font-size: var(--font-ui-medium);
		margin-bottom: var(--size-4-3);
		color: var(--text-normal);
	}

	.chart {
		background-color: var(--background-secondary);
		padding: var(--size-4-4);
		border-radius: var(--radius-m);
		height: 300px;
		position: relative;
	}

	.behavior-section, .time-analysis-section, .chapters-section, .achievements-section {
		background-color: var(--background-secondary);
		padding: var(--size-4-4);
		border-radius: var(--radius-m);
		margin-bottom: var(--size-4-6);
	}

	.behavior-section h3, .time-analysis-section h3, .chapters-section h3, .achievements-section h3 {
		font-size: var(--font-ui-medium);
		margin: 0 0 var(--size-4-3) 0;
		color: var(--text-normal);
	}

	.behavior-grid, .time-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--size-4-3);
	}

	.behavior-item, .time-item {
		display: flex;
		justify-content: space-between;
		padding: var(--size-4-2) var(--size-4-3);
		background-color: var(--background-primary);
		border-radius: var(--radius-s);
	}

	.behavior-item .label, .time-item .label {
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}

	.behavior-item .value, .time-item .value {
		color: var(--text-normal);
		font-weight: 500;
		font-size: var(--font-ui-small);
	}

	.chapters-list {
		display: grid;
		gap: var(--size-4-2);
	}

	.chapter-item {
		display: grid;
		grid-template-columns: 1fr auto auto auto;
		gap: var(--size-4-3);
		padding: var(--size-4-2) var(--size-4-3);
		background-color: var(--background-primary);
		border-radius: var(--radius-s);
		transition: all 0.2s;
	}

	.chapter-item:hover {
		background-color: var(--background-modifier-hover);
	}

	.chapter-id {
		color: var(--text-normal);
		font-weight: 500;
	}

	.chapter-time, .chapter-count, .chapter-speed {
		color: var(--text-muted);
		font-size: var(--font-ui-small);
	}

	.achievements-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
		gap: var(--size-4-3);
	}

	.achievement-card {
		padding: var(--size-4-3);
		background-color: var(--background-primary);
		border-radius: var(--radius-s);
		text-align: center;
		border: 1px solid var(--background-modifier-border);
	}

	.achievement-icon {
		font-size: 32px;
		margin-bottom: var(--size-4-2);
	}

	.achievement-name {
		color: var(--text-normal);
		font-weight: 500;
		margin-bottom: var(--size-4-1);
		font-size: var(--font-ui-small);
	}

	.achievement-date {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
	}
</style>
