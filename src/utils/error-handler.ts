/**
 * 错误处理工具
 *
 * 提供统一的错误处理、日志记录和用户提示功能。
 *
 * @module utils/error-handler
 */

import { Notice } from 'obsidian';
import { ERROR_MESSAGES } from '../constants/app-config';

/**
 * 错误类型枚举
 */
export enum ErrorType {
  // 文件相关
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  UNSUPPORTED_FORMAT = 'UNSUPPORTED_FORMAT',

  // 小说相关
  NOVEL_NOT_FOUND = 'NOVEL_NOT_FOUND',
  NOVEL_ALREADY_EXISTS = 'NOVEL_ALREADY_EXISTS',
  NOVEL_ADD_FAILED = 'NOVEL_ADD_FAILED',
  NOVEL_UPDATE_FAILED = 'NOVEL_UPDATE_FAILED',
  NOVEL_DELETE_FAILED = 'NOVEL_DELETE_FAILED',
  NOVEL_LOAD_FAILED = 'NOVEL_LOAD_FAILED',

  // 数据相关
  DATA_LOAD_ERROR = 'DATA_LOAD_ERROR',
  DATA_SAVE_ERROR = 'DATA_SAVE_ERROR',
  DATA_PARSE_ERROR = 'DATA_PARSE_ERROR',
  DATA_VALIDATION_ERROR = 'DATA_VALIDATION_ERROR',

  // 网络相关
  NETWORK_ERROR = 'NETWORK_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',

  // 权限相关
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // 通用错误
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  OPERATION_CANCELLED = 'OPERATION_CANCELLED',
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  /** 信息：不影响功能，仅供参考 */
  INFO = 'INFO',

  /** 警告：可能影响部分功能 */
  WARNING = 'WARNING',

  /** 错误：影响当前操作 */
  ERROR = 'ERROR',

  /** 严重：影响核心功能 */
  CRITICAL = 'CRITICAL',
}

/**
 * 错误处理选项
 */
export interface ErrorHandlerOptions {
  /** 错误类型 */
  type?: ErrorType;

  /** 错误严重程度 */
  severity?: ErrorSeverity;

  /** 上下文信息 */
  context?: Record<string, unknown>;

  /** 用户友好的错误消息 */
  userMessage?: string;

  /** 是否显示通知 */
  showNotice?: boolean;

  /** 通知显示时长（毫秒） */
  noticeDuration?: number;

  /** 是否记录到控制台 */
  logToConsole?: boolean;

  /** 是否上报错误（用于错误追踪服务） */
  reportError?: boolean;

  /** 错误恢复建议 */
  recoverySuggestion?: string;
}

/**
 * 应用错误类
 *
 * 扩展标准 Error，添加更多上下文信息。
 */
export class AppError extends Error {
  public readonly type: ErrorType;
  public readonly severity: ErrorSeverity;
  public readonly context?: Record<string, unknown>;
  public readonly timestamp: number;
  public readonly userMessage?: string;
  public readonly recoverySuggestion?: string;

  constructor(
    message: string,
    options: {
      type?: ErrorType;
      severity?: ErrorSeverity;
      context?: Record<string, unknown>;
      userMessage?: string;
      recoverySuggestion?: string;
      cause?: Error;
    } = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.type = options.type || ErrorType.UNKNOWN_ERROR;
    this.severity = options.severity || ErrorSeverity.ERROR;
    this.context = options.context;
    this.timestamp = Date.now();
    this.userMessage = options.userMessage;
    this.recoverySuggestion = options.recoverySuggestion;

    // 保留原始错误的堆栈信息
    if (options.cause) {
      this.stack = `${this.stack}\nCaused by: ${options.cause.stack}`;
    }
  }

  /**
   * 转换为 JSON 格式（用于日志记录）
   */
  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      severity: this.severity,
      context: this.context,
      timestamp: this.timestamp,
      userMessage: this.userMessage,
      recoverySuggestion: this.recoverySuggestion,
      stack: this.stack,
    };
  }
}

/**
 * 错误处理器类
 */
export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorLog: AppError[] = [];
  private readonly MAX_LOG_SIZE = 100;

  private constructor() {}

  /**
   * 获取单例实例
   */
  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * 处理错误
   *
   * @param error - 错误对象
   * @param options - 处理选项
   */
  handle(error: Error | AppError | unknown, options: ErrorHandlerOptions = {}): void {
    const {
      type = ErrorType.UNKNOWN_ERROR,
      severity = ErrorSeverity.ERROR,
      context,
      userMessage,
      showNotice = true,
      noticeDuration = 5000,
      logToConsole = true,
      reportError = false,
      recoverySuggestion,
    } = options;

    // 转换为 AppError
    const appError = this.normalizeError(error, {
      type,
      severity,
      context,
      userMessage,
      recoverySuggestion,
    });

    // 记录到日志
    this.logError(appError);

    // 输出到控制台
    if (logToConsole) {
      this.logToConsole(appError);
    }

    // 显示用户通知
    if (showNotice) {
      this.showNotice(appError, noticeDuration);
    }

    // 上报错误（如果配置了错误追踪服务）
    if (reportError) {
      this.reportError(appError);
    }
  }

  /**
   * 标准化错误对象
   */
  private normalizeError(
    error: Error | AppError | unknown,
    options: {
      type: ErrorType;
      severity: ErrorSeverity;
      context?: Record<string, unknown>;
      userMessage?: string;
      recoverySuggestion?: string;
    }
  ): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof Error) {
      return new AppError(error.message, {
        ...options,
        cause: error,
      });
    }

    return new AppError(String(error), options);
  }

  /**
   * 记录错误到内存日志
   */
  private logError(error: AppError): void {
    this.errorLog.push(error);

    // 限制日志大小
    if (this.errorLog.length > this.MAX_LOG_SIZE) {
      this.errorLog.shift();
    }
  }

  /**
   * 输出到控制台
   */
  private logToConsole(error: AppError): void {
    const prefix = `[${error.severity}] [${error.type}]`;
    const message = `${prefix} ${error.message}`;

    switch (error.severity) {
      case ErrorSeverity.INFO:
        console.info(message, error.context);
        break;
      case ErrorSeverity.WARNING:
        console.warn(message, error.context);
        break;
      case ErrorSeverity.ERROR:
      case ErrorSeverity.CRITICAL:
        console.error(message, error.context);
        if (error.stack) {
          console.error(error.stack);
        }
        break;
    }
  }

  /**
   * 显示用户通知
   */
  private showNotice(error: AppError, duration: number): void {
    let message = error.userMessage || this.getDefaultUserMessage(error.type);

    if (error.recoverySuggestion) {
      message += `\n\n💡 ${error.recoverySuggestion}`;
    }

    new Notice(message, duration);
  }

  /**
   * 获取默认的用户消息
   */
  private getDefaultUserMessage(type: ErrorType): string {
    const messageMap: Record<ErrorType, string> = {
      [ErrorType.FILE_NOT_FOUND]: ERROR_MESSAGES.FILE_NOT_FOUND,
      [ErrorType.FILE_READ_ERROR]: ERROR_MESSAGES.FILE_READ_ERROR,
      [ErrorType.FILE_WRITE_ERROR]: ERROR_MESSAGES.FILE_WRITE_ERROR,
      [ErrorType.UNSUPPORTED_FORMAT]: ERROR_MESSAGES.UNSUPPORTED_FORMAT,
      [ErrorType.NOVEL_NOT_FOUND]: ERROR_MESSAGES.NOVEL_NOT_FOUND,
      [ErrorType.NOVEL_ALREADY_EXISTS]: ERROR_MESSAGES.NOVEL_ALREADY_EXISTS,
      [ErrorType.NOVEL_ADD_FAILED]: ERROR_MESSAGES.NOVEL_ADD_FAILED,
      [ErrorType.NOVEL_UPDATE_FAILED]: ERROR_MESSAGES.NOVEL_UPDATE_FAILED,
      [ErrorType.NOVEL_DELETE_FAILED]: ERROR_MESSAGES.NOVEL_DELETE_FAILED,
      [ErrorType.NOVEL_LOAD_FAILED]: '加载图书失败',
      [ErrorType.DATA_LOAD_ERROR]: ERROR_MESSAGES.DATA_LOAD_ERROR,
      [ErrorType.DATA_SAVE_ERROR]: ERROR_MESSAGES.DATA_SAVE_ERROR,
      [ErrorType.DATA_PARSE_ERROR]: ERROR_MESSAGES.DATA_PARSE_ERROR,
      [ErrorType.DATA_VALIDATION_ERROR]: '数据验证失败',
      [ErrorType.NETWORK_ERROR]: ERROR_MESSAGES.NETWORK_ERROR,
      [ErrorType.TIMEOUT_ERROR]: ERROR_MESSAGES.TIMEOUT_ERROR,
      [ErrorType.PERMISSION_DENIED]: '权限不足',
      [ErrorType.UNKNOWN_ERROR]: ERROR_MESSAGES.UNKNOWN_ERROR,
      [ErrorType.OPERATION_CANCELLED]: ERROR_MESSAGES.OPERATION_CANCELLED,
    };

    return messageMap[type] || ERROR_MESSAGES.UNKNOWN_ERROR;
  }

  /**
   * 上报错误（预留接口，可接入 Sentry 等服务）
   */
  private reportError(error: AppError): void {
    // TODO: 接入错误追踪服务
    console.log('Error reported:', error.toJSON());
  }

  /**
   * 获取错误日志
   */
  getErrorLog(): AppError[] {
    return [...this.errorLog];
  }

  /**
   * 清空错误日志
   */
  clearErrorLog(): void {
    this.errorLog = [];
  }

  /**
   * 导出错误日志为 JSON
   */
  exportErrorLog(): string {
    return JSON.stringify(
      this.errorLog.map((error) => error.toJSON()),
      null,
      2
    );
  }
}

/**
 * 全局错误处理函数（便捷方法）
 *
 * @param error - 错误对象
 * @param options - 处理选项
 *
 * @example
 * ```typescript
 * try {
 *   await loadNovel(id);
 * } catch (error) {
 *   handleError(error, {
 *     type: ErrorType.NOVEL_LOAD_FAILED,
 *     context: { novelId: id },
 *     userMessage: '加载图书失败，请重试',
 *     recoverySuggestion: '请检查文件是否存在',
 *   });
 * }
 * ```
 */
export function handleError(
  error: Error | AppError | unknown,
  options: ErrorHandlerOptions = {}
): void {
  ErrorHandler.getInstance().handle(error, options);
}

/**
 * 创建错误处理装饰器（用于类方法）
 *
 * @param options - 错误处理选项
 * @returns 装饰器函数
 *
 * @example
 * ```typescript
 * class LibraryService {
 *   @withErrorHandler({
 *     type: ErrorType.NOVEL_LOAD_FAILED,
 *     userMessage: '加载图书失败',
 *   })
 *   async loadNovel(id: string): Promise<Novel> {
 *     // 实现...
 *   }
 * }
 * ```
 */
export function withErrorHandler(options: ErrorHandlerOptions = {}) {
  return function (
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: unknown[]) {
      try {
        return await originalMethod.apply(this, args);
      } catch (error) {
        handleError(error, {
          ...options,
          context: {
            ...options.context,
            method: propertyKey,
            args,
          },
        });
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * 安全执行函数（捕获并处理错误）
 *
 * @param fn - 要执行的函数
 * @param options - 错误处理选项
 * @returns 执行结果或 undefined（发生错误时）
 *
 * @example
 * ```typescript
 * const novel = await safeExecute(
 *   () => loadNovel(id),
 *   {
 *     type: ErrorType.NOVEL_LOAD_FAILED,
 *     userMessage: '加载图书失败',
 *   }
 * );
 *
 * if (novel) {
 *   // 处理成功情况
 * }
 * ```
 */
export async function safeExecute<T>(
  fn: () => Promise<T> | T,
  options: ErrorHandlerOptions = {}
): Promise<T | undefined> {
  try {
    return await fn();
  } catch (error) {
    handleError(error, options);
    return undefined;
  }
}

/**
 * 断言函数（条件不满足时抛出错误）
 *
 * @param condition - 条件
 * @param message - 错误消息
 * @param options - 错误选项
 *
 * @example
 * ```typescript
 * assert(novel !== null, 'Novel not found', {
 *   type: ErrorType.NOVEL_NOT_FOUND,
 *   context: { novelId: id },
 * });
 * ```
 */
export function assert(
  condition: boolean,
  message: string,
  options: Omit<ErrorHandlerOptions, 'userMessage'> = {}
): asserts condition {
  if (!condition) {
    throw new AppError(message, {
      type: options.type || ErrorType.UNKNOWN_ERROR,
      severity: options.severity || ErrorSeverity.ERROR,
      context: options.context,
      userMessage: message,
    });
  }
}

/**
 * 验证函数（返回验证结果而不是抛出错误）
 *
 * @param condition - 条件
 * @param message - 错误消息
 * @returns 验证结果
 *
 * @example
 * ```typescript
 * if (!validate(novel !== null, 'Novel not found')) {
 *   return;
 * }
 * ```
 */
export function validate(condition: boolean, message: string): boolean {
  if (!condition) {
    console.warn(`Validation failed: ${message}`);
  }
  return condition;
}
