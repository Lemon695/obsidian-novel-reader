<script lang="ts">
	import { onMount } from 'svelte';
	import type { Novel } from '../types';
	import type NovelReaderPlugin from '../main';

	export let plugin: NovelReaderPlugin;

	interface StatsData {
		booksRead: number;
		booksInProgress: number;
		totalReadingTime: number;
		averageCompletionRate: number;
		monthlyStats: Array<{month: string; value: number}>;
		recentBooks: Novel[];
		readingStreak: number;
		readingGoal: {
			target: number;
			current: number;
		};
	}

	let statsData: StatsData = {
		booksRead: 0,
		booksInProgress: 0,
		totalReadingTime: 0,
		averageCompletionRate: 0,
		monthlyStats: [],
		recentBooks: [],
		readingStreak: 0,
		readingGoal: {
			target: 12,
			current: 0
		}
	};

	let chartInstance: any = null;
	let chartCanvas: HTMLCanvasElement;

	onMount(async () => {
		// 动态加载 Chart.js
		const script = document.createElement('script');
		script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
		script.onload = () => {
			loadStats();
		};
		document.head.appendChild(script);
	});

	async function loadStats() {
		try {
			// 获取所有图书
			const novels = await plugin.libraryService.getAllNovels();

			// 计算基础统计
			statsData.booksRead = novels.filter((novel: Novel) =>
				novel.progress !== undefined && novel.progress === 100
			).length;

			statsData.booksInProgress = novels.filter((novel: Novel) =>
				novel.progress !== undefined && novel.progress > 0 && novel.progress < 100
			).length;

			// 计算平均完成率
			const completionRates = novels
				.filter((novel: Novel) => novel.progress !== undefined && novel.progress > 0)
				.map((novel: Novel) => novel.progress || 0);

			statsData.averageCompletionRate = completionRates.length > 0
				? Math.round(completionRates.reduce((a, b) => a + b, 0) / completionRates.length)
				: 0;

			// 计算月度阅读统计
			const monthlyData = Array(12).fill(0);
			novels.forEach((novel: Novel) => {
				if (novel.lastRead) {
					const month = new Date(novel.lastRead).getMonth();
					if (novel.progress === 100) {
						monthlyData[month]++;
					}
				}
			});

			// 处理月度数据
			statsData.monthlyStats = monthlyData.map((value, index) => ({
				month: `${index + 1}月`,
				value
			}));

			// 获取最近阅读的书籍
			statsData.recentBooks = novels
				.filter((novel: Novel) => novel.lastRead !== undefined)
				.sort((a: Novel, b: Novel) => (b.lastRead || 0) - (a.lastRead || 0))
				.slice(0, 5);

			// 计算阅读连续天数
			const today = new Date();
			let streak = 0;
			let currentDate = new Date(today);

			while (true) {
				const dateStr = currentDate.toISOString().split('T')[0];
				const hasReadingActivity = await checkReadingActivity(dateStr);
				if (!hasReadingActivity) break;
				streak++;
				currentDate.setDate(currentDate.getDate() - 1);
			}
			statsData.readingStreak = streak;

			// 计算年度目标完成情况
			const currentYear = new Date().getFullYear();
			statsData.readingGoal.current = novels.filter((novel: Novel) =>
				novel.progress === 100 &&
				novel.lastRead &&
				new Date(novel.lastRead).getFullYear() === currentYear
			).length;

			// 更新图表
			updateChart();

		} catch (error) {
			console.error('Failed to load reading stats:', error);
		}
	}

	async function checkReadingActivity(dateStr: string): Promise<boolean> {
		if (!plugin.dbService) return false;

		try {
			const stats = await plugin.dbService.getNovelStats(dateStr);
			return stats ? stats.stats.totalReadingTime > 0 : false;
		} catch (error) {
			console.error('Error checking reading activity:', error);
			return false;
		}
	}

	function updateChart() {
		if (chartInstance) {
			chartInstance.destroy();
		}

		const ctx = chartCanvas.getContext('2d');
		if (ctx && (window as any).Chart) {
			chartInstance = new (window as any).Chart(ctx, {
				type: 'bar',
				data: {
					labels: statsData.monthlyStats.map(stat => stat.month),
					datasets: [{
						label: '完成书籍数',
						data: statsData.monthlyStats.map(stat => stat.value),
						backgroundColor: getComputedStyle(document.body)
							.getPropertyValue('--interactive-accent-rgb')
							.split(',')
							.map(n => parseInt(n.trim()))
							.concat([0.5])
							.join(', '),
						borderColor: getComputedStyle(document.body)
							.getPropertyValue('--interactive-accent'),
						borderWidth: 1
					}]
				},
				options: {
					responsive: true,
					maintainAspectRatio: false,
					plugins: {
						legend: {
							display: false
						}
					},
					scales: {
						y: {
							beginAtZero: true,
							ticks: {
								stepSize: 1,
								color: getComputedStyle(document.body)
									.getPropertyValue('--text-normal')
							},
							grid: {
								color: getComputedStyle(document.body)
									.getPropertyValue('--background-modifier-border')
							}
						},
						x: {
							ticks: {
								color: getComputedStyle(document.body)
									.getPropertyValue('--text-normal')
							},
							grid: {
								color: getComputedStyle(document.body)
									.getPropertyValue('--background-modifier-border')
							}
						}
					}
				}
			});
		}
	}
</script>

<div class="stats-dashboard">
	<div class="header">
		<h1>阅读统计</h1>
	</div>

	<div class="stats-grid">
		<div class="stat-card">
			<h3>已读完</h3>
			<p class="stat-value">{statsData.booksRead}</p>
			<p class="stat-label">本书</p>
		</div>

		<div class="stat-card">
			<h3>在读</h3>
			<p class="stat-value">{statsData.booksInProgress}</p>
			<p class="stat-label">本书</p>
		</div>

		<div class="stat-card">
			<h3>连续阅读</h3>
			<p class="stat-value">{statsData.readingStreak}</p>
			<p class="stat-label">天</p>
		</div>

		<div class="stat-card">
			<h3>平均完成率</h3>
			<p class="stat-value">{statsData.averageCompletionRate}%</p>
		</div>
	</div>

	<div class="year-goal-section">
		<h2>年度阅读目标</h2>
		<div class="goal-progress">
			<div class="progress-bar">
				<div
					class="progress"
					style="width: {(statsData.readingGoal.current / statsData.readingGoal.target) * 100}%"
				></div>
			</div>
			<p class="goal-text">
				已读完 {statsData.readingGoal.current} 本，目标 {statsData.readingGoal.target} 本
			</p>
		</div>
	</div>

	<div class="chart-section">
		<h2>月度阅读统计</h2>
		<div class="chart-container">
			<canvas bind:this={chartCanvas}></canvas>
		</div>
	</div>

	<div class="recent-books">
		<h2>最近阅读</h2>
		<div class="books-list">
			{#each statsData.recentBooks as book}
				<div class="book-item">
					<div class="book-info">
						<h4>{book.title}</h4>
						<p class="book-progress">
							进度: {book.progress !== undefined ? book.progress : 0}%
						</p>
					</div>
					<p class="last-read">
						{book.lastRead ? new Date(book.lastRead).toLocaleDateString() : '未知'}
					</p>
				</div>
			{/each}
		</div>
	</div>
</div>

<style>
	.stats-dashboard {
		padding: 24px;
		max-width: 1200px;
		margin: 0 auto;
	}

	.header {
		margin-bottom: 32px;
	}

	.header h1 {
		margin: 0;
		color: var(--text-normal);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
		gap: 24px;
		margin-bottom: 32px;
	}

	.stat-card {
		background: var(--background-secondary);
		padding: 24px;
		border-radius: 12px;
		text-align: center;
		transition: transform 0.2s;
	}

	.stat-card:hover {
		transform: translateY(-2px);
	}

	.stat-value {
		font-size: 36px;
		font-weight: bold;
		color: var(--interactive-accent);
		margin: 8px 0;
	}

	.stat-label {
		color: var(--text-muted);
		font-size: 14px;
	}

	.year-goal-section {
		background: var(--background-secondary);
		padding: 24px;
		border-radius: 12px;
		margin-bottom: 32px;
	}

	.goal-progress {
		margin-top: 16px;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background: var(--background-modifier-border);
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 8px;
	}

	.progress {
		height: 100%;
		background: var(--interactive-accent);
		border-radius: 4px;
		transition: width 0.3s ease;
	}

	.goal-text {
		text-align: center;
		color: var(--text-muted);
		margin: 8px 0;
	}

	.chart-section {
		background: var(--background-secondary);
		padding: 24px;
		border-radius: 12px;
		margin-bottom: 32px;
	}

	.chart-container {
		height: 300px;
		margin-top: 16px;
	}

	.recent-books {
		background: var(--background-secondary);
		padding: 24px;
		border-radius: 12px;
	}

	.books-list {
		display: grid;
		gap: 16px;
		margin-top: 16px;
	}

	.book-item {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 16px;
		background: var(--background-primary);
		border-radius: 8px;
	}

	.book-info h4 {
		margin: 0 0 4px 0;
	}

	.book-progress {
		color: var(--text-muted);
		font-size: 14px;
		margin: 0;
	}

	.last-read {
		color: var(--text-muted);
		font-size: 14px;
	}
</style>
