<script lang="ts">
	import type {Novel} from '../types';
	import {onMount} from 'svelte';
	import Chart from 'chart.js/auto';
	import type {ReadingStats} from "../types/reading-stats";

	export let novel: Novel;
	export let stats: ReadingStats | undefined;

	let totalReadingHours = 0;
	let averageSessionMinutes = 0;
	let lastReadDate = '';
	let chartCanvas: HTMLCanvasElement;
	let chart: Chart;

	onMount(() => {
		if (stats) {
			processStats();
			initChart();
		}

		return () => {
			if (chart) {
				chart.destroy();
			}
		};
	});

	function processStats() {
		if (!stats) return;

		totalReadingHours = Math.round((stats.totalTime || 0) / (1000 * 60 * 60) * 10) / 10;

		const avgSessionTime = 0;
		averageSessionMinutes = Math.round(avgSessionTime / (1000 * 60) * 10) / 10;

		lastReadDate = formatDate(Date.now());
	}

	function initChart() {
		const ctx = chartCanvas.getContext('2d');
		if (!ctx) return;

		const dailyStats = stats?.dailyStats ?
			Object.entries(stats?.dailyStats).map(([date, stat]: [string, any]) => ({
				date,
				duration: Math.round((stat.totalDuration || 0) / (1000 * 60)) // 转换为分钟
			})) : [];

		// 使用 Obsidian 的主题颜色
		const accentColor = getComputedStyle(document.body).getPropertyValue('--interactive-accent');

		chart = new Chart(ctx, {
			type: 'line',
			data: {
				labels: dailyStats.map(stat => stat.date),
				datasets: [{
					label: '阅读时长（分钟）',
					data: dailyStats.map(stat => stat.duration),
					borderColor: accentColor,
					backgroundColor: `${accentColor}33`, // 添加透明度
					tension: 0.3,
					fill: true
				}]
			},
			options: {
				responsive: true,
				maintainAspectRatio: false,
				plugins: {
					tooltip: {
						backgroundColor: getComputedStyle(document.body).getPropertyValue('--background-secondary'),
						titleColor: getComputedStyle(document.body).getPropertyValue('--text-normal'),
						bodyColor: getComputedStyle(document.body).getPropertyValue('--text-normal'),
						borderColor: getComputedStyle(document.body).getPropertyValue('--background-modifier-border'),
						borderWidth: 1,
						callbacks: {
							label: (context) => {
								return `阅读时长: ${formatDuration(context.parsed.y)}`;
							}
						}
					},
					legend: {
						labels: {
							color: getComputedStyle(document.body).getPropertyValue('--text-normal')
						}
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
			}
		});
	}

	function formatDate(timestamp: number): string {
		if (!timestamp) return '未读';
		const date = new Date(timestamp);
		return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
	}

	function formatDuration(minutes: number): string {
		if (minutes < 60) {
			return `${minutes}分钟`;
		}
		const hours = Math.floor(minutes / 60);
		const remainingMinutes = minutes % 60;
		return `${hours}小时${remainingMinutes}分钟`;
	}
</script>

<div class="stats-container">
	<h2 class="title">{novel.title} - 阅读统计</h2>

	<div class="stats-grid">
		<div class="stat-card">
			<h3>总阅读时间</h3>
			<p>{totalReadingHours}小时</p>
		</div>
		<div class="stat-card">
			<h3>平均阅读时长</h3>
			<p>{averageSessionMinutes}分钟</p>
		</div>
		<div class="stat-card">
			<h3>阅读天天</h3>
			<p>{stats?.readingDays}次</p>
		</div>
		<div class="stat-card">
			<h3>最近阅读</h3>
			<p>{lastReadDate}</p>
		</div>
	</div>

	<div class="chart-container">
		<h3>最近7天阅读时长（分钟）</h3>
		<div class="chart">
			<canvas bind:this={chartCanvas}></canvas>
		</div>
	</div>

	<div class="chapters-container">
		<h3>章节阅读统计</h3>
		<div class="chapters-list">
			<!--			<p>{stats?.chapterStats}次</p>-->
			<!--{#each Object.entries(stats.stats.chapterStats) as [chapterId, chapterStat]}-->
			<div class="chapter-stat">
				<!--					<span class="chapter-title">第{chapterId}章</span>-->
				<!--					<span class="chapter-time">{formatDuration(Math.round(chapterStat.timeSpent / (1000 * 60)))}</span>-->
				<!--					<span class="read-count">读过{chapterStat}次</span>-->
			</div>
			<!--{/each}-->
		</div>

	</div>
</div>

<style>
	.stats-container {
		padding: var(--novel-spacing-md);
		height: 100%;
		overflow-y: auto;
	}

	.title {
		margin-bottom: var(--novel-spacing-lg);
		font-size: var(--novel-font-size-xl);
		font-weight: 600;
		color: var(--text-normal);
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: var(--novel-spacing-md);
		margin-bottom: var(--novel-spacing-lg);
	}

	.stat-card {
		padding: var(--novel-spacing-md);
		background-color: var(--background-secondary);
		border-radius: var(--novel-radius-md);
		text-align: center;
		transition: all 0.2s;
		border: 1px solid transparent;
	}

	.stat-card:hover {
		transform: translateY(-2px);
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
		border-color: var(--background-modifier-border);
	}

	.stat-card h3 {
		font-size: var(--novel-font-size-base);
		color: var(--text-muted);
		margin-bottom: var(--novel-spacing-xs);
		font-weight: 500;
	}

	.stat-card p {
		font-size: var(--novel-font-size-lg);
		color: var(--interactive-accent);
		font-weight: 600;
		margin: 0;
	}

	.chart-container {
		margin-bottom: var(--novel-spacing-lg);
	}

	.chart-container h3 {
		font-size: var(--novel-font-size-md);
		margin-bottom: var(--novel-spacing-sm);
		color: var(--text-normal);
	}

	.chart {
		background-color: var(--background-secondary);
		padding: var(--novel-spacing-md);
		border-radius: var(--novel-radius-md);
		height: 350px;
		position: relative;
	}

	.chapters-container {
		background-color: var(--background-secondary);
		padding: var(--novel-spacing-md);
		border-radius: var(--novel-radius-md);
	}

	.chapters-container h3 {
		font-size: var(--novel-font-size-md);
		margin-bottom: var(--novel-spacing-sm);
		color: var(--text-normal);
	}

	.chapters-list {
		display: grid;
		gap: var(--novel-spacing-xs);
	}

	.chapter-stat {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: var(--novel-spacing-md);
		padding: var(--novel-spacing-sm);
		background-color: var(--background-primary);
		border-radius: var(--novel-radius-sm);
		transition: all 0.2s;
	}

	.chapter-stat:hover {
		background-color: var(--background-modifier-hover);
	}

	.chapter-time, .read-count {
		color: var(--text-muted);
		font-size: var(--novel-font-size-sm);
	}
</style>
