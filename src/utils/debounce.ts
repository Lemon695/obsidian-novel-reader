/**
 * 防抖函数接口（带取消方法）
 */
export interface DebouncedFunction<T extends (...args: any[]) => any> {
	(...args: Parameters<T>): void;
	cancel: () => void;
}

/**
 * 防抖函数工具
 * 用于减少高频事件触发（如滚动、输入）的执行次数
 *
 * @param func 需要防抖的函数
 * @param wait 延迟时间（毫秒）
 * @param immediate 是否立即执行（首次触发时）
 * @returns 防抖后的函数（带cancel方法）
 */
export function debounce<T extends (...args: any[]) => any>(
	func: T,
	wait: number = 300,
	immediate: boolean = false
): DebouncedFunction<T> {
	let timeout: ReturnType<typeof setTimeout> | null = null;

	const debouncedFn = function(this: any, ...args: Parameters<T>) {
		const context = this;

		const later = () => {
			timeout = null;
			if (!immediate) {
				func.apply(context, args);
			}
		};

		const callNow = immediate && !timeout;

		if (timeout) {
			clearTimeout(timeout);
		}

		timeout = setTimeout(later, wait);

		if (callNow) {
			func.apply(context, args);
		}
	} as DebouncedFunction<T>;

	// 添加取消方法，防止内存泄漏
	debouncedFn.cancel = () => {
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}
	};

	return debouncedFn;
}

/**
 * 节流函数工具
 * 确保函数在指定时间内最多执行一次
 *
 * @param func 需要节流的函数
 * @param limit 时间限制（毫秒）
 * @returns 节流后的函数
 */
export function throttle<T extends (...args: any[]) => any>(
	func: T,
	limit: number = 300
): (...args: Parameters<T>) => void {
	let inThrottle: boolean;
	let lastResult: ReturnType<T>;

	return function(this: any, ...args: Parameters<T>): void {
		const context = this;

		if (!inThrottle) {
			inThrottle = true;
			lastResult = func.apply(context, args);

			setTimeout(() => {
				inThrottle = false;
			}, limit);
		}
	};
}
