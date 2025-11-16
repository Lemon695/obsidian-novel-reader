<script lang="ts">
	import { onMount } from 'svelte';
	import Chart from 'chart.js/auto';
	import type { Novel } from '../types';
	import type NovelReaderPlugin from '../main';
	import type { EnhancedGlobalStats, EnhancedNovelStats } from '../types/enhanced-stats';
	import { icons } from './library/icons';

	export let plugin: NovelReaderPlugin;

	let globalStats: EnhancedGlobalStats | null = null;
	let allNovelStats: EnhancedNovelStats[] = [];
	let loading = true;

	// 图表实例 (使用 any 避免 Chart.js 类型冲突)
	let readingTimeChart: any = null;
	let speedDistributionChart: any = null;
	let timeSlotChart: any = null;
	let weekdayChart: any = null;

	// Canvas 元素
	let readingTimeCanvas: HTMLCanvasElement;
	let speedDistributionCanvas: HTMLCanvasElement;
	let timeSlotCanvas: HTMLCanvasElement;
	let weekdayCanvas: HTMLCanvasElement;

	onMount(async () => {
		await loadStats();

		return () => {
			// 清理图表
			readingTimeChart?.destroy();
			speedDistributionChart?.destroy();
			timeSlotChart?.destroy();
			weekdayChart?.destroy();
		};
	});

	async function loadStats() {
		loading = true;
		try {
			if (plugin.settings.useEnhancedStats && plugin.statsAdapter) {
				// 从新存储加载全局统计
				globalStats = await plugin.statsAdapter.newStorage?.getGlobalStats() || null;

				if (!globalStats) {
					// 如果没有数据，重新计算
					globalStats = await plugin.statsAdapter.newStorage?.recalculateGlobalStats() || null;
				}

				// 加载所有小说的统计数据（用于图表）
				if (globalStats) {
					await loadAllNovelStats();
					await initCharts();
				}
			}
		} catch (error) {
			console.error('加载全局统计失败:', error);
		} finally {
			loading = false;
		}
	}

	async function loadAllNovelStats() {
		try {
			const novels = await plugin.libraryService.getAllNovels();
			const statsPromises = novels.map(async (novel) => {
				try {
					return await plugin.statsAdapter?.newStorage?.getNovelStats(novel.id);
				} catch {
					return null;
				}
			});
			const results = await Promise.all(statsPromises);
			allNovelStats = results.filter((s): s is EnhancedNovelStats => s !== null);
		} catch (error) {
			console.error('加载小说统计失败:', error);
			allNovelStats = [];
		}
	}

	async function initCharts() {
		if (!globalStats) return;

		// 等待下一个渲染周期确保 canvas 已挂载
		await new Promise(resolve => setTimeout(resolve, 100));

		initReadingTimeChart();
		initSpeedDistributionChart();
		initTimeSlotChart();
		initWeekdayChart();
	}

	function initReadingTimeChart() {
		const ctx = readingTimeCanvas?.getContext('2d');
		if (!ctx || !globalStats) return;

		// 从个别小说统计聚合最近30天数据
		const dailyMap: { [date: string]: number } = {};

		allNovelStats.forEach(novelStats => {
			if (novelStats.timeAnalysis?.dailyStats) {
				Object.entries(novelStats.timeAnalysis.dailyStats).forEach(([date, stats]) => {
					if (!dailyMap[date]) dailyMap[date] = 0;
					dailyMap[date] += stats.totalDuration || 0;
				});
			}
		});

		const dailyData = Object.entries(dailyMap)
			.map(([date, duration]) => ({
				date,
				duration: duration / (1000 * 60) // 转换为分钟
			}))
			.sort((a, b) => a.date.localeCompare(b.date))
			.slice(-30);

		const accentColor = getComputedStyle(document.body).getPropertyValue('--interactive-accent');

		readingTimeChart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: dailyData.map(d => formatShortDate(d.date)),
				datasets: [{
					label: '阅读时长（分钟）',
					data: dailyData.map(d => d.duration),
					borderColor: accentColor,
					backgroundColor: `${accentColor}33`,
					tension: 0.3,
					fill: true
				}]
			},
			options: getChartOptions()
		});
	}

	function initSpeedDistributionChart() {
		const ctx = speedDistributionCanvas?.getContext('2d');
		if (!ctx) return;

		// 速度分布数据（分成6个区间）
		const speeds = allNovelStats
			.map(stats => stats.speedAnalysis?.averageSpeed || 0)
			.filter(speed => speed > 0);

		const bins = [
			{ label: '0-100', min: 0, max: 100, count: 0 },
			{ label: '100-200', min: 100, max: 200, count: 0 },
			{ label: '200-300', min: 200, max: 300, count: 0 },
			{ label: '300-400', min: 300, max: 400, count: 0 },
			{ label: '400-500', min: 400, max: 500, count: 0 },
			{ label: '500+', min: 500, max: Infinity, count: 0 }
		];

		speeds.forEach(speed => {
			const bin = bins.find(b => speed >= b.min && speed < b.max);
			if (bin) bin.count++;
		});

		const successColor = getComputedStyle(document.body).getPropertyValue('--text-success') || '#4caf50';

		speedDistributionChart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: bins.map(b => b.label),
				datasets: [{
					label: '书籍数量',
					data: bins.map(b => b.count),
					backgroundColor: `${successColor}99`,
					borderColor: successColor,
					borderWidth: 1
				}]
			},
			options: getChartOptions()
		});
	}

	function initTimeSlotChart() {
		const ctx = timeSlotCanvas?.getContext('2d');
		if (!ctx) return;

		// 聚合所有小说的时段数据
		const hourly = new Array(24).fill(0);

		allNovelStats.forEach(novelStats => {
			if (novelStats.timeAnalysis?.hourlyDistribution) {
				novelStats.timeAnalysis.hourlyDistribution.forEach((duration, hour) => {
					hourly[hour] += duration || 0;
				});
			}
		});

		const timeSlots = {
			'凌晨 (0-6)': hourly.slice(0, 6).reduce((a, b) => a + b, 0),
			'上午 (6-12)': hourly.slice(6, 12).reduce((a, b) => a + b, 0),
			'下午 (12-18)': hourly.slice(12, 18).reduce((a, b) => a + b, 0),
			'晚上 (18-24)': hourly.slice(18, 24).reduce((a, b) => a + b, 0)
		};

		const colors = ['#f44336', '#ffeb3b', '#4caf50', '#2196f3'];

		timeSlotChart = new Chart(ctx, {
			type: 'doughnut',
			data: {
				labels: Object.keys(timeSlots),
				datasets: [{
					data: Object.values(timeSlots).map(v => v / (1000 * 60)), // 转换为分钟
					backgroundColor: colors.map(c => `${c}cc`),
					borderColor: colors,
					borderWidth: 2
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					legend: {
						position: 'right',
						labels: {
							color: getComputedStyle(document.body).getPropertyValue('--text-normal')
						}
					},
					tooltip: {
						callbacks: {
							label: (context) => {
								const value = context.parsed;
								return `${context.label}: ${formatDuration(value * 60 * 1000)}`;
							}
						}
					}
				}
			}
		});
	}

	function initWeekdayChart() {
		const ctx = weekdayCanvas?.getContext('2d');
		if (!ctx) return;

		// 聚合所有小说的星期数据
		const weekdayData = new Array(7).fill(0);

		allNovelStats.forEach(novelStats => {
			if (novelStats.timeAnalysis?.weekdayDistribution) {
				novelStats.timeAnalysis.weekdayDistribution.forEach((duration, day) => {
					weekdayData[day] += duration || 0;
				});
			}
		});

		const weekdayNames = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
		const weekdayMinutes = weekdayData.map(v => v / (1000 * 60));

		const accentColor = getComputedStyle(document.body).getPropertyValue('--interactive-accent');

		weekdayChart = new Chart(ctx, {
			type: 'bar',
			data: {
				labels: weekdayNames,
				datasets: [{
					label: '阅读时长（分钟）',
					data: weekdayMinutes,
					backgroundColor: `${accentColor}99`,
					borderColor: accentColor,
					borderWidth: 1
				}]
			},
			options: getChartOptions()
		});
	}

	function getChartOptions() {
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
						color: getComputedStyle(document.body).getPropertyValue('--text-muted')
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

	// 辅助计算函数
	function getTotalTime() {
		return allNovelStats.reduce((sum, s) => sum + s.basicStats.totalReadingTime, 0);
	}

	function getTotalSessions() {
		return allNovelStats.reduce((sum, s) => sum + s.basicStats.sessionsCount, 0);
	}

	function getTotalNotes() {
		return allNovelStats.reduce((sum, s) => sum + (s.notesCorrelation?.totalNotes || 0), 0);
	}

	function getAverageSpeed() {
		const speeds = allNovelStats.map(s => s.speedAnalysis?.averageSpeed || 0).filter(s => s > 0);
		return speeds.length > 0 ? speeds.reduce((a, b) => a + b, 0) / speeds.length : 0;
	}

	function getMaxSpeed() {
		const speeds = allNovelStats.map(s => s.speedAnalysis?.averageSpeed || 0).filter(s => s > 0);
		return speeds.length > 0 ? Math.max(...speeds) : 0;
	}

	function getTotalReadingDays() {
		const allDays = new Set();
		allNovelStats.forEach(s => {
			if (s.timeAnalysis?.dailyStats) {
				Object.keys(s.timeAnalysis.dailyStats).forEach(day => allDays.add(day));
			}
		});
		return allDays.size;
	}

	// 获取排行榜数据
	function getTopBooksByTime() {
		return allNovelStats
			.map(stats => ({
				id: stats.novelId,
				title: stats.novelId,
				totalReadingTime: stats.basicStats.totalReadingTime,
				sessionsCount: stats.basicStats.sessionsCount,
				averageReadingSpeed: stats.speedAnalysis?.averageSpeed || 0
			}))
			.sort((a, b) => b.totalReadingTime - a.totalReadingTime)
			.slice(0, 10);
	}

	function getTopBooksBySpeed() {
		return allNovelStats
			.map(stats => ({
				id: stats.novelId,
				title: stats.novelId,
				averageReadingSpeed: stats.speedAnalysis?.averageSpeed || 0,
				totalReadingTime: stats.basicStats.totalReadingTime,
				progress: stats.progressStats.completionRate
			}))
			.filter(book => book.averageReadingSpeed > 0)
			.sort((a, b) => b.averageReadingSpeed - a.averageReadingSpeed)
			.slice(0, 10);
	}

	function getTopBooksBySessions() {
		return allNovelStats
			.map(stats => ({
				id: stats.novelId,
				title: stats.novelId,
				sessionsCount: stats.basicStats.sessionsCount,
				totalReadingTime: stats.basicStats.totalReadingTime
			}))
			.sort((a, b) => b.sessionsCount - a.sessionsCount)
			.slice(0, 10);
	}

	// 导出功能
	async function exportAsMarkdown() {
		if (!globalStats) return;

		const markdown = generateGlobalMarkdownReport(globalStats);
		const filename = `全局阅读统计-${formatDate(Date.now())}.md`;

		await plugin.app.vault.create(filename, markdown);
		new (window as any).Notice(`已导出为 Markdown: ${filename}`);
	}

	async function exportAsJSON() {
		if (!globalStats) return;

		const json = JSON.stringify(globalStats, null, 2);
		const filename = `全局阅读统计-${formatDate(Date.now())}.json`;

		await plugin.app.vault.create(filename, json);
		new (window as any).Notice(`已导出为 JSON: ${filename}`);
	}

	function generateGlobalMarkdownReport(stats: EnhancedGlobalStats): string {
		const currentYear = new Date().getFullYear();
		const yearGoal = stats.yearlyGoals?.[currentYear];

		// 聚合星期分布
		const weekdayDist = new Array(7).fill(0);
		allNovelStats.forEach(s => {
			s.timeAnalysis?.weekdayDistribution?.forEach((d, i) => {
				weekdayDist[i] += d || 0;
			});
		});

		return `# 全局阅读统计报告

> 生成时间: ${formatDate(Date.now())}

## 📊 总体概览

- **统计书籍数**: ${stats.library.totalBooks} 本
- **总阅读时间**: ${formatDuration(getTotalTime())}
- **总阅读会话**: ${getTotalSessions()} 次
- **总笔记数**: ${getTotalNotes()} 条
- **平均阅读速度**: ${formatSpeed(getAverageSpeed())}
- **最快阅读速度**: ${formatSpeed(getMaxSpeed())}

## 🏆 阅读时长排行榜 (Top 10)

| 排名 | 书籍ID | 阅读时长 | 会话数 | 平均速度 |
|------|--------|----------|--------|----------|
${getTopBooksByTime().map((book, i) =>
	`| ${i + 1} | ${book.title || book.id} | ${formatDuration(book.totalReadingTime)} | ${book.sessionsCount} | ${formatSpeed(book.averageReadingSpeed)} |`
).join('\n')}

## 🚀 阅读速度排行榜 (Top 10)

| 排名 | 书籍ID | 平均速度 | 阅读时长 | 进度 |
|------|--------|----------|----------|------|
${getTopBooksBySpeed().map((book, i) =>
	`| ${i + 1} | ${book.title || book.id} | ${formatSpeed(book.averageReadingSpeed)} | ${formatDuration(book.totalReadingTime)} | ${book.progress.toFixed(1)}% |`
).join('\n')}

## 📚 会话数排行榜 (Top 10)

| 排名 | 书籍ID | 会话数 | 阅读时长 |
|------|--------|--------|----------|
${getTopBooksBySessions().map((book, i) =>
	`| ${i + 1} | ${book.title || book.id} | ${book.sessionsCount} | ${formatDuration(book.totalReadingTime)} |`
).join('\n')}

## ⏰ 时间分析

### 星期分布
${weekdayDist.map((duration, day) =>
	`- **${['周日', '周一', '周二', '周三', '周四', '周五', '周六'][day]}**: ${formatDuration(duration)}`
).join('\n')}

## 📖 阅读习惯

- **连续阅读天数（当前）**: ${stats.streaks?.currentStreak || 0} 天
- **最长连续阅读**: ${stats.streaks?.longestStreak || 0} 天

${yearGoal ? `## 🎯 阅读目标

- **年度目标**: ${yearGoal.targetBooks} 本
- **已完成**: ${yearGoal.currentBooks} 本
- **完成率**: ${yearGoal.progress.toFixed(1)}%
` : ''}

---

*报告由 Novel Reader 插件自动生成*
`;
	}
</script>

<div class="global-stats-dashboard">
	{#if loading}
		<div class="loading">加载中...</div>
	{:else if !globalStats}
		<div class="no-data">
			<p>暂无全局统计数据</p>
			<p class="hint">开始阅读后将自动收集</p>
		</div>
	{:else}
		<!-- 标题和导出按钮 -->
		<div class="header">
			<h1><span class="header-icon">{@html icons.barChart}</span> 全局阅读统计</h1>
			<div class="export-buttons">
				<button class="export-btn" on:click={exportAsMarkdown}>
					<span class="icon">{@html icons.note}</span>
					Markdown
				</button>
				<button class="export-btn" on:click={exportAsJSON}>
					<span class="icon">{@html icons.list}</span>
					JSON
				</button>
			</div>
		</div>

		<!-- 核心统计卡片 -->
		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-icon">{@html icons.library}</div>
				<h3>统计书籍</h3>
				<p class="stat-value">{globalStats.library?.totalBooks || 0}</p>
				<p class="stat-label">本</p>
			</div>

			<div class="stat-card">
				<div class="stat-icon">{@html icons.clock}</div>
				<h3>总阅读时间</h3>
				<p class="stat-value">{formatDuration(getTotalTime())}</p>
			</div>

			<div class="stat-card">
				<div class="stat-icon">{@html icons.bookOpen}</div>
				<h3>总会话数</h3>
				<p class="stat-value">{getTotalSessions()}</p>
				<p class="stat-label">次</p>
			</div>

			<div class="stat-card">
				<div class="stat-icon">{@html icons.note}</div>
				<h3>总笔记数</h3>
				<p class="stat-value">{getTotalNotes()}</p>
				<p class="stat-label">条</p>
			</div>

			<div class="stat-card">
				<div class="stat-icon">{@html icons.barChart}</div>
				<h3>平均速度</h3>
				<p class="stat-value">{formatSpeed(getAverageSpeed())}</p>
			</div>

			<div class="stat-card">
				<div class="stat-icon" style="color: var(--text-success)">{@html icons.barChart}</div>
				<h3>最快速度</h3>
				<p class="stat-value">{formatSpeed(getMaxSpeed())}</p>
			</div>

			<div class="stat-card">
				<div class="stat-icon" style="color: var(--text-warning)">{@html icons.calendar}</div>
				<h3>连续阅读</h3>
				<p class="stat-value">{globalStats.streaks?.currentStreak || 0}</p>
				<p class="stat-label">天（最长 {globalStats.streaks?.longestStreak || 0} 天）</p>
			</div>

			<div class="stat-card">
				<div class="stat-icon">{@html icons.calendar}</div>
				<h3>总阅读天数</h3>
				<p class="stat-value">{getTotalReadingDays()}</p>
				<p class="stat-label">天</p>
			</div>
		</div>

		<!-- 年度阅读目标 -->
		{#if globalStats.yearlyGoals && globalStats.yearlyGoals[new Date().getFullYear()]}
			{@const yearGoal = globalStats.yearlyGoals[new Date().getFullYear()]}
			<div class="goal-section">
				<h2><span class="section-icon">{@html icons.calendar}</span> 年度阅读目标</h2>
				<div class="goal-content">
					<div class="goal-progress-bar">
						<div
							class="goal-progress-fill"
							style="width: {yearGoal.progress}%"
						></div>
					</div>
					<p class="goal-text">
						已完成 <span class="accent">{yearGoal.currentBooks}</span> 本，
						目标 <span class="accent">{yearGoal.targetBooks}</span> 本
						（{yearGoal.progress.toFixed(1)}%）
					</p>
				</div>
			</div>
		{/if}

		<!-- 图表区域 -->
		<div class="charts-row">
			<div class="chart-card">
				<h3><span class="chart-icon">{@html icons.barChart}</span> 阅读时长趋势（最近30天）</h3>
				<div class="chart-wrapper">
					<canvas bind:this={readingTimeCanvas}></canvas>
				</div>
			</div>

			<div class="chart-card">
				<h3><span class="chart-icon">{@html icons.barChart}</span> 阅读速度分布</h3>
				<div class="chart-wrapper">
					<canvas bind:this={speedDistributionCanvas}></canvas>
				</div>
			</div>
		</div>

		<div class="charts-row">
			<div class="chart-card">
				<h3><span class="chart-icon">{@html icons.clock}</span> 时段偏好分析</h3>
				<div class="chart-wrapper">
					<canvas bind:this={timeSlotCanvas}></canvas>
				</div>
			</div>

			<div class="chart-card">
				<h3><span class="chart-icon">{@html icons.calendar}</span> 星期分布</h3>
				<div class="chart-wrapper">
					<canvas bind:this={weekdayCanvas}></canvas>
				</div>
			</div>
		</div>

		<!-- 排行榜区域 -->
		<div class="rankings-section">
			<h2><span class="section-icon">{@html icons.barChart}</span> 排行榜</h2>

			<div class="rankings-grid">
				<!-- 阅读时长排行 -->
				<div class="ranking-card">
					<h3><span class="ranking-icon">{@html icons.clock}</span> 阅读时长 Top 10</h3>
					<div class="ranking-list">
						{#each getTopBooksByTime() as book, index}
							<div class="ranking-item">
								<span class="rank">#{index + 1}</span>
								<span class="book-title">{book.title || book.id}</span>
								<span class="value">{formatDuration(book.totalReadingTime)}</span>
							</div>
						{/each}
					</div>
				</div>

				<!-- 阅读速度排行 -->
				<div class="ranking-card">
					<h3><span class="ranking-icon">{@html icons.barChart}</span> 阅读速度 Top 10</h3>
					<div class="ranking-list">
						{#each getTopBooksBySpeed() as book, index}
							<div class="ranking-item">
								<span class="rank">#{index + 1}</span>
								<span class="book-title">{book.title || book.id}</span>
								<span class="value">{formatSpeed(book.averageReadingSpeed)}</span>
							</div>
						{/each}
					</div>
				</div>

				<!-- 会话数排行 -->
				<div class="ranking-card">
					<h3><span class="ranking-icon">{@html icons.bookOpen}</span> 会话次数 Top 10</h3>
					<div class="ranking-list">
						{#each getTopBooksBySessions() as book, index}
							<div class="ranking-item">
								<span class="rank">#{index + 1}</span>
								<span class="book-title">{book.title || book.id}</span>
								<span class="value">{book.sessionsCount} 次</span>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.global-stats-dashboard {
		padding: var(--size-4-4);
		max-width: 1400px;
		margin: 0 auto;
		overflow-y: auto;
		height: 100%;
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
		gap: var(--size-4-3);
	}

	.header h1 {
		margin: 0;
		font-size: var(--font-ui-larger);
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

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--size-4-3);
		margin-bottom: var(--size-4-6);
	}

	.stat-card {
		background-color: var(--background-secondary);
		padding: var(--size-4-4);
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
		color: var(--interactive-accent);
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.stat-icon :global(svg) {
		width: 24px;
		height: 24px;
	}

	.header-icon :global(svg) {
		width: 20px;
		height: 20px;
		vertical-align: middle;
		margin-right: var(--size-4-1);
	}

	.section-icon :global(svg) {
		width: 18px;
		height: 18px;
		vertical-align: middle;
		margin-right: var(--size-4-1);
	}

	.chart-icon :global(svg),
	.ranking-icon :global(svg) {
		width: 16px;
		height: 16px;
		vertical-align: middle;
		margin-right: var(--size-4-1);
	}

	.stat-card h3 {
		font-size: var(--font-ui-small);
		color: var(--text-muted);
		margin: 0 0 var(--size-4-2) 0;
		font-weight: 500;
	}

	.stat-value {
		font-size: var(--font-ui-large);
		color: var(--interactive-accent);
		font-weight: 600;
		margin: 0;
	}

	.stat-label {
		font-size: var(--font-ui-smaller);
		color: var(--text-muted);
		margin-top: var(--size-4-1);
	}

	.goal-section {
		background-color: var(--background-secondary);
		padding: var(--size-4-4);
		border-radius: var(--radius-m);
		margin-bottom: var(--size-4-6);
	}

	.goal-section h2 {
		margin: 0 0 var(--size-4-3) 0;
		font-size: var(--font-ui-medium);
		color: var(--text-normal);
	}

	.goal-progress-bar {
		width: 100%;
		height: 12px;
		background-color: var(--background-modifier-border);
		border-radius: var(--radius-s);
		overflow: hidden;
		margin-bottom: var(--size-4-2);
	}

	.goal-progress-fill {
		height: 100%;
		background: linear-gradient(90deg, var(--interactive-accent), var(--interactive-accent-hover));
		border-radius: var(--radius-s);
		transition: width 0.3s ease;
	}

	.goal-text {
		text-align: center;
		color: var(--text-muted);
		margin: 0;
	}

	.goal-text .accent {
		color: var(--interactive-accent);
		font-weight: 600;
	}

	.charts-row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
		gap: var(--size-4-4);
		margin-bottom: var(--size-4-6);
	}

	.chart-card {
		background-color: var(--background-secondary);
		padding: var(--size-4-4);
		border-radius: var(--radius-m);
	}

	.chart-card h3 {
		margin: 0 0 var(--size-4-3) 0;
		font-size: var(--font-ui-medium);
		color: var(--text-normal);
	}

	.chart-wrapper {
		height: 300px;
		position: relative;
	}

	.rankings-section {
		background-color: var(--background-secondary);
		padding: var(--size-4-4);
		border-radius: var(--radius-m);
		margin-bottom: var(--size-4-6);
	}

	.rankings-section h2 {
		margin: 0 0 var(--size-4-4) 0;
		font-size: var(--font-ui-medium);
		color: var(--text-normal);
	}

	.rankings-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: var(--size-4-4);
	}

	.ranking-card {
		background-color: var(--background-primary);
		padding: var(--size-4-3);
		border-radius: var(--radius-s);
	}

	.ranking-card h3 {
		margin: 0 0 var(--size-4-3) 0;
		font-size: var(--font-ui-small);
		color: var(--text-muted);
	}

	.ranking-list {
		display: grid;
		gap: var(--size-4-2);
	}

	.ranking-item {
		display: grid;
		grid-template-columns: auto 1fr auto;
		gap: var(--size-4-2);
		align-items: center;
		padding: var(--size-4-2);
		background-color: var(--background-secondary);
		border-radius: var(--radius-s);
		transition: all 0.2s;
	}

	.ranking-item:hover {
		background-color: var(--background-modifier-hover);
		transform: translateX(4px);
	}

	.rank {
		color: var(--interactive-accent);
		font-weight: 600;
		font-size: var(--font-ui-small);
		min-width: 32px;
	}

	.book-title {
		color: var(--text-normal);
		font-size: var(--font-ui-small);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.value {
		color: var(--text-muted);
		font-size: var(--font-ui-smaller);
		text-align: right;
	}
</style>
