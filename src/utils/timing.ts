/**
 * 时间相关工具函数
 *
 * 提供防抖、节流等常用时间控制功能。
 *
 * @module utils/timing
 */

/**
 * 防抖函数
 *
 * 在事件被触发 n 毫秒后再执行回调，如果在这 n 毫秒内又被触发，则重新计时。
 * 适用场景：搜索框输入、窗口 resize、表单验证等。
 *
 * @param func - 要防抖的函数
 * @param wait - 等待时间（毫秒）
 * @param immediate - 是否立即执行（首次触发时）
 * @returns 防抖后的函数
 *
 * @example
 * ```typescript
 * const debouncedSearch = debounce((query: string) => {
 *   performSearch(query);
 * }, 300);
 *
 * input.addEventListener('input', (e) => {
 *   debouncedSearch(e.target.value);
 * });
 * ```
 */
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number,
  immediate = false
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;

  return function executedFunction(...args: Parameters<T>) {
    const later = () => {
      timeout = null;
      if (!immediate) {
        func(...args);
      }
    };

    const callNow = immediate && !timeout;

    if (timeout) {
      clearTimeout(timeout);
    }

    timeout = setTimeout(later, wait);

    if (callNow) {
      func(...args);
    }
  };
}

/**
 * 节流函数
 *
 * 规定在一个单位时间内，只能触发一次函数。如果这个单位时间内触发多次函数，只有一次生效。
 * 适用场景：滚动事件、鼠标移动、按钮点击等高频事件。
 *
 * @param func - 要节流的函数
 * @param limit - 时间限制（毫秒）
 * @returns 节流后的函数
 *
 * @example
 * ```typescript
 * const throttledScroll = throttle(() => {
 *   updateScrollPosition();
 * }, 100);
 *
 * window.addEventListener('scroll', throttledScroll);
 * ```
 */
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  let lastResult: ReturnType<T>;

  return function executedFunction(...args: Parameters<T>) {
    if (!inThrottle) {
      lastResult = func(...args);
      inThrottle = true;

      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }

    return lastResult;
  };
}

/**
 * 延迟执行
 *
 * 返回一个 Promise，在指定时间后 resolve。
 *
 * @param ms - 延迟时间（毫秒）
 * @returns Promise
 *
 * @example
 * ```typescript
 * await sleep(1000); // 等待 1 秒
 * console.log('1 秒后执行');
 * ```
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 超时控制
 *
 * 为 Promise 添加超时控制，超时后自动 reject。
 *
 * @param promise - 要控制的 Promise
 * @param ms - 超时时间（毫秒）
 * @param errorMessage - 超时错误消息
 * @returns 带超时控制的 Promise
 *
 * @example
 * ```typescript
 * try {
 *   const data = await timeout(fetchData(), 5000, '请求超时');
 * } catch (error) {
 *   console.error(error.message); // '请求超时'
 * }
 * ```
 */
export function timeout<T>(
  promise: Promise<T>,
  ms: number,
  errorMessage = 'Operation timed out'
): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(errorMessage)), ms)
    ),
  ]);
}

/**
 * 重试函数
 *
 * 自动重试失败的异步操作。
 *
 * @param fn - 要重试的函数
 * @param options - 重试选项
 * @returns Promise
 *
 * @example
 * ```typescript
 * const data = await retry(
 *   () => fetchData(),
 *   { maxAttempts: 3, delay: 1000 }
 * );
 * ```
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    delay?: number;
    backoff?: boolean;
    onRetry?: (attempt: number, error: Error) => void;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    delay = 1000,
    backoff = false,
    onRetry,
  } = options;

  let lastError: Error;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxAttempts) {
        if (onRetry) {
          onRetry(attempt, lastError);
        }

        const waitTime = backoff ? delay * Math.pow(2, attempt - 1) : delay;
        await sleep(waitTime);
      }
    }
  }

  throw lastError!;
}

/**
 * 批处理函数
 *
 * 将大量任务分批执行，避免一次性执行过多任务导致性能问题。
 *
 * @param items - 要处理的项目数组
 * @param batchSize - 每批处理的数量
 * @param processor - 处理函数
 * @param onProgress - 进度回调
 * @returns Promise
 *
 * @example
 * ```typescript
 * await batchProcess(
 *   novels,
 *   10,
 *   async (novel) => await processNovel(novel),
 *   (processed, total) => console.log(`${processed}/${total}`)
 * );
 * ```
 */
export async function batchProcess<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>,
  onProgress?: (processed: number, total: number) => void
): Promise<R[]> {
  const results: R[] = [];
  const total = items.length;

  for (let i = 0; i < total; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(processor));
    results.push(...batchResults);

    if (onProgress) {
      onProgress(Math.min(i + batchSize, total), total);
    }
  }

  return results;
}

/**
 * 格式化时间戳为相对时间
 *
 * @param timestamp - 时间戳（毫秒）
 * @returns 相对时间字符串
 *
 * @example
 * ```typescript
 * formatRelativeTime(Date.now() - 3600000); // "1小时前"
 * formatRelativeTime(Date.now() - 86400000); // "1天前"
 * ```
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);

  if (seconds < 60) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days === 1) return '昨天';
  if (days < 7) return `${days}天前`;
  if (weeks < 4) return `${weeks}周前`;
  if (months < 12) return `${months}月前`;
  return `${years}年前`;
}

/**
 * 格式化持续时间
 *
 * @param ms - 持续时间（毫秒）
 * @returns 格式化的时间字符串
 *
 * @example
 * ```typescript
 * formatDuration(3661000); // "1小时1分钟"
 * formatDuration(125000); // "2分钟5秒"
 * ```
 */
export function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const parts: string[] = [];

  if (days > 0) parts.push(`${days}天`);
  if (hours % 24 > 0) parts.push(`${hours % 24}小时`);
  if (minutes % 60 > 0) parts.push(`${minutes % 60}分钟`);
  if (seconds % 60 > 0 && parts.length < 2) parts.push(`${seconds % 60}秒`);

  return parts.join('') || '0秒';
}

/**
 * 性能计时器
 *
 * 用于测量代码执行时间。
 *
 * @example
 * ```typescript
 * const timer = new PerformanceTimer('数据加载');
 * await loadData();
 * timer.end(); // 输出: "数据加载 耗时: 123ms"
 * ```
 */
export class PerformanceTimer {
  private startTime: number;
  private endTime?: number;

  constructor(private label: string) {
    this.startTime = performance.now();
  }

  /**
   * 结束计时并输出结果
   */
  end(): number {
    this.endTime = performance.now();
    const duration = this.endTime - this.startTime;
    console.log(`${this.label} 耗时: ${duration.toFixed(2)}ms`);
    return duration;
  }

  /**
   * 获取当前经过的时间（不结束计时）
   */
  elapsed(): number {
    return performance.now() - this.startTime;
  }

  /**
   * 重置计时器
   */
  reset(): void {
    this.startTime = performance.now();
    this.endTime = undefined;
  }
}

/**
 * 创建可取消的 Promise
 *
 * @param executor - Promise 执行器
 * @returns 可取消的 Promise 和取消函数
 *
 * @example
 * ```typescript
 * const [promise, cancel] = makeCancelable(
 *   new Promise((resolve) => setTimeout(resolve, 5000))
 * );
 *
 * // 2秒后取消
 * setTimeout(cancel, 2000);
 *
 * try {
 *   await promise;
 * } catch (error) {
 *   console.log(error.message); // "Promise cancelled"
 * }
 * ```
 */
export function makeCancelable<T>(
  promise: Promise<T>
): [Promise<T>, () => void] {
  let isCancelled = false;

  const wrappedPromise = new Promise<T>((resolve, reject) => {
    promise
      .then((value) => {
        if (!isCancelled) {
          resolve(value);
        }
      })
      .catch((error) => {
        if (!isCancelled) {
          reject(error);
        }
      });
  });

  const cancel = () => {
    isCancelled = true;
  };

  return [wrappedPromise, cancel];
}
