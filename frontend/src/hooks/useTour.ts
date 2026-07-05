import { useEffect, useRef, useCallback } from 'react';
import { driver } from 'driver.js';
import type { DriveStep } from 'driver.js';

type PageKey = 'home' | 'change' | 'tech';

const STORAGE_PREFIX = 'tour.';

function getStorageKey(pageKey: PageKey): string {
  return `${STORAGE_PREFIX}${pageKey}.done`;
}

function isDone(pageKey: PageKey): boolean {
  return localStorage.getItem(getStorageKey(pageKey)) === '1';
}

function markDone(pageKey: PageKey): void {
  localStorage.setItem(getStorageKey(pageKey), '1');
}

function clearDone(pageKey: PageKey): void {
  localStorage.removeItem(getStorageKey(pageKey));
}

/**
 * 过滤掉当前 DOM 中不存在的步骤目标，避免 driver.js 报错。
 */
function filterVisibleSteps(steps: DriveStep[]): DriveStep[] {
  return steps.filter((step) => {
    if (!step.element) return true;
    const sel = typeof step.element === 'string' ? step.element : String(step.element);
    const found = document.querySelector(sel);
    if (!found) {
      console.warn(`[useTour] 目标元素未找到，跳过步骤: ${sel}`);
    }
    return !!found;
  });
}

/**
 * 创建 driver 实例的通用工厂。
 * 注意：onDestroyStarted 回调必须调用 destroy() 才能真正销毁。
 */
function createDriverInstance(pageKey: PageKey, steps: DriveStep[], onDone: () => void) {
  const drv = driver({
    showProgress: true,
    allowClose: true,
    smoothScroll: false,
    nextBtnText: '下一步',
    prevBtnText: '上一步',
    doneBtnText: '完成',
    closeBtnText: '跳过',
    steps,
    onDestroyStarted: () => {
      markDone(pageKey);
      drv.destroy();
      onDone();
      // 首页引导完成后，滚动到页面顶部（自动取号系统入口）
      if (pageKey === 'home') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
  });
  return drv;
}

export function useTour(pageKey: PageKey, steps: DriveStep[]) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);
  const activeRef = useRef(false);

  const startTour = useCallback(() => {
    if (activeRef.current) return;
    if (isDone(pageKey)) return;

    const visibleSteps = filterVisibleSteps(steps);
    if (visibleSteps.length === 0) {
      console.warn(`[useTour] 页面 ${pageKey} 无可用引导步骤，跳过`);
      return;
    }

    // 禁用浏览器滚动恢复，强制滚到顶部
    if ('scrollRestoration' in history) {
      history.scrollRestoration = 'manual';
    }
    window.scrollTo(0, 0);

    const drv = createDriverInstance(pageKey, visibleSteps, () => { activeRef.current = false; });
    driverRef.current = drv;
    activeRef.current = true;
    drv.drive();

    // driver.js 启动后可能被浏览器恢复滚动，立即再次强制滚到顶部
    requestAnimationFrame(() => {
      window.scrollTo(0, 0);
    });
  }, [pageKey, steps]);

  const restartTour = useCallback(() => {
    if (driverRef.current) {
      driverRef.current.destroy();
      activeRef.current = false;
    }
    clearDone(pageKey);

    requestAnimationFrame(() => {
      const visibleSteps = filterVisibleSteps(steps);
      if (visibleSteps.length === 0) return;

      if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
      }
      window.scrollTo(0, 0);

      const drv = createDriverInstance(pageKey, visibleSteps, () => { activeRef.current = false; });
      driverRef.current = drv;
      activeRef.current = true;
      drv.drive();

      requestAnimationFrame(() => {
        window.scrollTo(0, 0);
      });
    });
  }, [pageKey, steps]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.pageKey === pageKey) {
        restartTour();
      }
    };
    window.addEventListener('tour:restart', handler);
    return () => window.removeEventListener('tour:restart', handler);
  }, [pageKey, restartTour]);

  return { startTour, restartTour };
}
