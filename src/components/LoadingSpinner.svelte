<script lang="ts">
  export let message: string = '加载中...';
  export let size: 'small' | 'medium' | 'large' = 'medium';
</script>

<div class="loading-container">
  <div class="spinner" class:small={size === 'small'} class:large={size === 'large'}>
    <div class="spinner-ring"></div>
    <div class="spinner-ring"></div>
    <div class="spinner-ring"></div>
    <div class="spinner-ring"></div>
  </div>
  <p class="loading-message">{message}</p>
</div>

<style>
  .loading-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--novel-spacing-md);
    padding: var(--novel-spacing-xl);
    width: 100%;
    height: 100%;
  }

  .spinner {
    position: relative;
    width: 64px;
    height: 64px;
  }

  .spinner.small {
    width: 32px;
    height: 32px;
  }

  .spinner.large {
    width: 96px;
    height: 96px;
  }

  .spinner-ring {
    box-sizing: border-box;
    position: absolute;
    width: 100%;
    height: 100%;
    border: 3px solid transparent;
    border-top-color: var(--interactive-accent);
    border-radius: 50%;
    animation: spinner-rotate 1.2s cubic-bezier(0.5, 0, 0.5, 1) infinite;
  }

  .spinner.small .spinner-ring {
    border-width: 2px;
  }

  .spinner.large .spinner-ring {
    border-width: 4px;
  }

  .spinner-ring:nth-child(1) {
    animation-delay: -0.45s;
  }

  .spinner-ring:nth-child(2) {
    animation-delay: -0.3s;
  }

  .spinner-ring:nth-child(3) {
    animation-delay: -0.15s;
  }

  @keyframes spinner-rotate {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  .loading-message {
    color: var(--text-muted);
    font-size: var(--novel-font-size-base);
    font-weight: 500;
    margin: 0;
    animation: pulse 1.5s ease-in-out infinite;
    background: linear-gradient(135deg, var(--interactive-accent) 0%, var(--interactive-accent-hover) 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.6;
    }
  }
</style>
