<script lang="ts">
  import { createEventDispatcher, onMount, onDestroy } from 'svelte';

  const dispatch = createEventDispatcher();

  // Props
  export let currentChapterId: number | null = null;
  export let currentChapterTitle: string = '';

  // 内部状态
  export let isActive = false;
  let isReadingActive = false;
  let lastActivityTime = Date.now();
  let sessionStartTime: number | null = null;

  // 5分钟无操作视为暂停
  const INACTIVITY_THRESHOLD = 5 * 60 * 1000;
  let activityTimeout: ReturnType<typeof setTimeout> | null = null;
  let checkInterval: ReturnType<typeof setInterval> | null = null;

  // 监听 currentChapterId 变化，自动处理会话
  $: if (currentChapterId) {
    // 如果章节改变，并且正在阅读，先结束上一章的会话
    if (isReadingActive) {
      // 这里只是为了在章节切换时分割统计，可选。
      // 原有逻辑是在 view 层 handleSwitchChapter 时不一定出发 endSession。
      // 但为了统计准确，可以触发一次 end，再 start。
      // 简单起见，这里复用 View 层的逻辑：View 层通常在切换章节时已经调用了 endReading？
      // 不，View 层切换章节时通常是持续阅读。
      // 我们只在 "开始" 和 "结束" 时触发事件。
      // 如果章节变了，应该怎么做？
      // 原逻辑：chapterChanged 事件发出，stats service 会记录。
      // sessionStart/end 是针对 "一次连续的阅读行为"。
      // 修正：本组件负责 "Session"（活跃时段），而不负责章节切换的具体统计（那是 StatsService 的事）。
      // 只需要确保 Session 包含最新的 chapter 信息即可。
      // 当章节变化时，不需要结束 Session，只要 SessionStart 信息是最新的即可？
      // 不，startReading 事件通常携带 chapterId。如果章节变了，可能需要重新发出 startReading？
      // 让我们查看原代码：startReadingSession 仅在 onMount 和 isActive 变为 true 时调用。
      // 并在章节切换时，并没有重新调用 startReading (除非 stats service 处理)。
    }
  }

  // 开始新会话
  function startNewSession() {
    if (!currentChapterId) return;

    sessionStartTime = Date.now();
    isReadingActive = true;
    lastActivityTime = Date.now();
    isActive = true;

    dispatch('startReading', {
      chapterId: currentChapterId,
      chapterTitle: currentChapterTitle,
      startTime: sessionStartTime,
    });
  }

  // 结束当前会话
  function endCurrentSession() {
    if (!isReadingActive || !sessionStartTime) return;

    const sessionEndTime = Date.now();
    const sessionDuration = sessionEndTime - sessionStartTime;

    dispatch('endReading', {
      endTime: sessionEndTime,
      duration: sessionDuration,
    });

    isReadingActive = false;
    sessionStartTime = null;
    isActive = false;
  }

  // 更新用户活动时间
  function updateActivity() {
    lastActivityTime = Date.now();

    // 如果之前不活跃，重新开始会话
    if (!isReadingActive) {
      startNewSession();
    }
  }

  // 节流的活动更新
  const throttledUpdateActivity = () => {
    if (activityTimeout) return;
    activityTimeout = setTimeout(() => {
      updateActivity();
      activityTimeout = null;
    }, 1000); // 节流1秒
  };

  // 处理可见性变化
  function handleVisibilityChange() {
    if (document.hidden) {
      if (isReadingActive) {
        endCurrentSession();
      }
    } else {
      updateActivity();
    }
  }

  // 定期检查是否超时
  function checkInactivity() {
    if (isReadingActive && Date.now() - lastActivityTime > INACTIVITY_THRESHOLD) {
      console.log('[ReadingSessionManager] Inactivity detected, ending session');
      endCurrentSession();
    }
  }

  onMount(() => {
    // 监听页面可见性
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // 监听用户活动
    const activityEvents = ['keydown', 'scroll', 'click', 'mousemove', 'touchstart'];
    activityEvents.forEach((event) => {
      window.addEventListener(event, throttledUpdateActivity);
    });

    // 启动初始会话（如果已有章节）
    if (currentChapterId) {
      startNewSession();
    }

    // 启动定时检查
    checkInterval = setInterval(checkInactivity, 60 * 1000); // 每分钟检查一次

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      activityEvents.forEach((event) => {
        window.removeEventListener(event, throttledUpdateActivity);
      });
      if (activityTimeout) clearTimeout(activityTimeout);
      if (checkInterval) clearInterval(checkInterval);

      // 组件销毁时确保结束会话
      endCurrentSession();
    };
  });
</script>

<!-- 无 UI 组件 -->
<slot {isActive} />
