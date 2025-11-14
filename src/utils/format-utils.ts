/**
 * 格式化工具函数
 * 提取重复的格式化逻辑，提高代码复用性
 */

/**
 * 格式化日期为 YYYY-MM-DD 格式
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化的日期字符串
 */
export function formatDate(timestamp: number | null | undefined): string {
	if (!timestamp) return '未知';

	const date = new Date(timestamp);
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, '0');
	const day = String(date.getDate()).padStart(2, '0');

	return `${year}-${month}-${day}`;
}

/**
 * 格式化日期时间为 YYYY-MM-DD HH:mm:ss 格式
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化的日期时间字符串
 */
export function formatDateTime(timestamp: number | null | undefined): string {
	if (!timestamp) return '未知';

	const date = new Date(timestamp);
	const datePart = formatDate(timestamp);
	const hours = String(date.getHours()).padStart(2, '0');
	const minutes = String(date.getMinutes()).padStart(2, '0');
	const seconds = String(date.getSeconds()).padStart(2, '0');

	return `${datePart} ${hours}:${minutes}:${seconds}`;
}

/**
 * 格式化时长为可读格式
 * @param milliseconds 毫秒数
 * @returns 格式化的时长字符串（如 "1小时23分钟"）
 */
export function formatDuration(milliseconds: number): string {
	if (!milliseconds || milliseconds < 0) return '0分钟';

	const seconds = Math.floor(milliseconds / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) {
		return `${days}天${hours % 24}小时`;
	} else if (hours > 0) {
		return `${hours}小时${minutes % 60}分钟`;
	} else if (minutes > 0) {
		return `${minutes}分钟`;
	} else {
		return `${seconds}秒`;
	}
}

/**
 * 格式化文件大小为可读格式
 * @param bytes 字节数
 * @returns 格式化的文件大小字符串（如 "1.5 MB"）
 */
export function formatFileSize(bytes: number): string {
	if (bytes === 0) return '0 B';
	if (!bytes || bytes < 0) return '未知';

	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	const k = 1024;
	const i = Math.floor(Math.log(bytes) / Math.log(k));

	return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`;
}

/**
 * 格式化百分比
 * @param value 数值
 * @param total 总数
 * @param decimals 小数位数
 * @returns 格式化的百分比字符串（如 "75.5%"）
 */
export function formatPercentage(value: number, total: number, decimals: number = 1): string {
	if (total === 0) return '0%';
	if (!total || !value) return '0%';

	const percentage = (value / total) * 100;
	return `${percentage.toFixed(decimals)}%`;
}

/**
 * 截断文本并添加省略号
 * @param text 原始文本
 * @param maxLength 最大长度
 * @param ellipsis 省略号字符
 * @returns 截断后的文本
 */
export function truncateText(text: string, maxLength: number, ellipsis: string = '...'): string {
	if (!text) return '';
	if (text.length <= maxLength) return text;

	return text.slice(0, maxLength - ellipsis.length) + ellipsis;
}
