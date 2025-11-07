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
						callbacks: {
							label: (context) => {
								return formatDuration(context.parsed.y);
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
		padding: 1rem;
	}

	.title {
		margin-bottom: 2rem;
	}

	.stats-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 2rem;
	}

	.stat-card {
		padding: 1rem;
		background-color: var(--background-secondary);
		border-radius: 8px;
		text-align: center;
	}

	.chart-container {
		margin-bottom: 2rem;
	}

	.chart {
		background-color: var(--background-secondary);
		padding: 1rem;
		border-radius: 8px;
		height: 350px;
		position: relative;
	}

	.chapters-container {
		background-color: var(--background-secondary);
		padding: 1rem;
		border-radius: 8px;
	}

	.chapters-list {
		display: grid;
		gap: 0.5rem;
	}

	.chapter-stat {
		display: grid;
		grid-template-columns: 1fr auto auto;
		gap: 1rem;
		padding: 0.5rem;
		background-color: var(--background-primary);
		border-radius: 4px;
	}

	.chapter-time, .read-count {
		color: var(--text-muted);
	}
</style>
