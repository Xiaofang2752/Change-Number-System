# 首次访问功能引导页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在首次访问 Home / 变更管理 / 技术文件三个页面时，用 driver.js 分步高亮向导引导用户认识 7 个核心模块；页脚提供「功能引导」重看入口。

**Architecture:** 每页独立引导，用 `useTour(pageKey, steps)` hook 封装 driver.js 启动/重启/记录逻辑；步骤定义集中在 `tour/steps.ts`；目标元素用 `data-tour` 属性标记；重看通过 Layout 页脚按钮 dispatch DOM 事件 `tour:restart` 触发当前页 hook。

**Tech Stack:** driver.js（~5KB gzip）、React 18、TypeScript、Tailwind CSS、localStorage

## Global Constraints

- 不改后端，纯前端。
- 引导文案用中文。
- localStorage key 格式：`tour.<pageKey>.done`，值为 `'1'` 表示已完成。
- 页脚「功能引导」仅在 `/`、`/change-management`、`/technical-document` 三个路径显示，其余路径隐藏。
- 元素选择器统一用 `data-tour="<key>"` 属性，不依赖 CSS 类名。
- driver.js 的 CSS import 路径：`driver.js/dist/driver.css`（默认主题），自定义覆盖放在 `frontend/src/tour/driver.css`。
- 每页引导仅在页面 `loading === false` 后启动。

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `frontend/src/tour/steps.ts` | 三页步骤定义常量 HOME_STEPS / CHANGE_STEPS / TECH_STEPS |
| Create | `frontend/src/tour/driver.css` | driver.js 主题覆盖（配色、圆角、字体） |
| Create | `frontend/src/hooks/useTour.ts` | 可复用引导 hook：startTour / restartTour |
| Modify | `frontend/src/components/Layout.tsx` | 页脚加「功能引导」按钮 + dispatch tour:restart |
| Modify | `frontend/src/pages/Home.tsx` | data-tour 属性 + useTour |
| Modify | `frontend/src/pages/ChangeManagementPage.tsx` | data-tour 属性 + useTour |
| Modify | `frontend/src/pages/TechnicalDocumentPage.tsx` | data-tour 属性 + useTour |
| Modify | `frontend/src/App.tsx` | 顶层 import driver.css |

---

### Task 1: 安装 driver.js + 创建主题覆盖 + 顶层 import

**Files:**
- Modify: `frontend/package.json`（新增依赖）
- Create: `frontend/src/tour/driver.css`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Produces: `driver.css` 被 App.tsx import，后续任务依赖此文件存在。

- [ ] **Step 1: 安装 driver.js**

```bash
cd frontend && npm install driver.js
```

- [ ] **Step 2: 创建主题覆盖 CSS**

Create `frontend/src/tour/driver.css`：

```css
/* driver.js 主题覆盖 —— 对齐项目 Tailwind 配色 */
.driver-popover {
  font-family: inherit !important;
  border-radius: 1rem !important;
  border: 1px solid #e2e8f0 !important;
  box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25) !important;
}

.driver-popover-title {
  font-size: 0.95rem !important;
  font-weight: 800 !important;
  color: #0f172a !important;
}

.driver-popover-description {
  font-size: 0.82rem !important;
  color: #475569 !important;
  line-height: 1.6 !important;
}

.driver-popover-next-btn {
  background: #00AEAA !important;
  color: #fff !important;
  border-radius: 0.5rem !important;
  font-weight: 700 !important;
  font-size: 0.8rem !important;
  padding: 0.4rem 1rem !important;
  border: none !important;
}

.driver-popover-next-btn:hover {
  background: #009e9a !important;
}

.driver-popover-prev-btn {
  color: #475569 !important;
  font-weight: 600 !important;
  font-size: 0.8rem !important;
}

.driver-popover-close-btn {
  color: #94a3b8 !important;
  font-size: 0.75rem !important;
}

.driver-popover-arrow {
  display: none !important;
}

.driver-highlighted-element {
  border-radius: 1rem !important;
}
```

- [ ] **Step 3: 在 App.tsx 顶层 import 主题覆盖**

在 `frontend/src/App.tsx` 文件顶部的 import 区追加：

```typescript
import './tour/driver.css';
```

放在其他 import 语句之后、`function App()` 之前。

- [ ] **Step 4: 运行类型检查确认无报错**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 5: Commit**

```bash
cd frontend && git add package.json package-lock.json src/tour/driver.css src/App.tsx
git commit -m "feat(tour): install driver.js and add theme override CSS"
```

---

### Task 2: 创建步骤定义 `tour/steps.ts`

**Files:**
- Create: `frontend/src/tour/steps.ts`

**Interfaces:**
- Produces: `HOME_STEPS`、`CHANGE_STEPS`、`TECH_STEPS`，类型为 `DriveStep[]`（来自 `driver.js`）。后续 Task 3 的 `useTour` hook 和 Task 4-6 的页面文件消费这些常量。
- `DriveStep` import 路径：`import type { DriveStep } from 'driver.js'`

- [ ] **Step 1: 创建步骤定义文件**

Create `frontend/src/tour/steps.ts`：

```typescript
import type { DriveStep } from 'driver.js';

export const HOME_STEPS: DriveStep[] = [
  {
    element: '[data-tour="home-entry"]',
    popover: {
      title: '取号入口',
      description: '这里选择取号类型：变更管理类（DCP/CR/CN/TD/RWO）或技术文件类（DHF/DMR），点击卡片进入对应取号界面。',
      side: 'bottom' as const,
      align: 'center' as const,
    },
  },
  {
    element: '[data-tour="home-chart"]',
    popover: {
      title: '月度审核数量',
      description: '统计最近 6 个月各类型取号申请数量，可切换「变更管理/技术文件」Tab，点击柱条或顶部数字查看当月申请明细。',
      side: 'top' as const,
      align: 'center' as const,
    },
  },
  {
    element: '[data-tour="home-contributors"]',
    popover: {
      title: '贡献者展示',
      description: '公示对系统改进有贡献的同事榜单，点击标题可查看全部贡献者名单。',
      side: 'top' as const,
      align: 'center' as const,
    },
  },
];

export const CHANGE_STEPS: DriveStep[] = [
  {
    element: '[data-tour="change-form"]',
    popover: {
      title: '自动取号操作与显示',
      description: '左侧填写变更申请表，提交后系统自动生成编号；中间列表实时显示已取号的变更记录。',
      side: 'right' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-tour="change-progress"]',
    popover: {
      title: '变更进度查询/更新',
      description: '下方表格按 CR/DCP/CN 编号查询变更发布与法规审批状态，支持搜索、按项目折叠、批量导入导出。点击行可查看/更新详细进度。',
      side: 'top' as const,
      align: 'center' as const,
    },
  },
];

export const TECH_STEPS: DriveStep[] = [
  {
    element: '[data-tour="tech-form"]',
    popover: {
      title: '技术文件编号申请',
      description: '左侧填写，提交后自动生成编号，*是必填信息',
      side: 'right' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-tour="tech-chatbot"]',
    popover: {
      title: '知识库避坑查询',
      description: '点击右下角的悬浮的【信息小图标】，向 AI 知识库提问，获取避坑建议与规范指引👉',
      side: 'left' as const,
      align: 'start' as const,
    },
  },
];
```

- [ ] **Step 2: 运行类型检查**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/tour/steps.ts
git commit -m "feat(tour): add step definitions for home, change, tech pages"
```

---

### Task 3: 创建 `useTour` hook

**Files:**
- Create: `frontend/src/hooks/useTour.ts`

**Interfaces:**
- Consumes: `DriveStep[]` from `driver.js`（Task 2 定义的步骤数组传入）
- Produces: `useTour(pageKey, steps)` → `{ startTour, restartTour }`
- pageKey 类型：`'home' | 'change' | 'tech'`
- localStorage key：`tour.<pageKey>.done`，值 `'1'`
- DOM 事件：监听 `tour:restart`（CustomEvent，detail: `{ pageKey: string }`）
- 后续 Task 4-6 的页面组件调用此 hook。

- [ ] **Step 1: 创建 hook 文件**

Create `frontend/src/hooks/useTour.ts`：

```typescript
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
    if (!step.element) return true; // 无选择器的步骤保留
    const sel = typeof step.element === 'string' ? step.element : String(step.element);
    const found = document.querySelector(sel);
    if (!found) {
      console.warn(`[useTour] 目标元素未找到，跳过步骤: ${sel}`);
    }
    return !!found;
  });
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

    const drv = driver({
      showProgress: true,
      allowClose: true,
      nextBtnText: '下一步',
      prevBtnText: '上一步',
      doneBtnText: '完成',
      closeBtnText: '跳过',
      steps: visibleSteps,
      onDestroyStarted: () => {
        if (!drv.hasNextStep() || drv.isLastStep()) {
          markDone(pageKey);
        }
        drv.destroy();
        activeRef.current = false;
      },
    });

    driverRef.current = drv;
    activeRef.current = true;
    drv.drive();
  }, [pageKey, steps]);

  const restartTour = useCallback(() => {
    // 先销毁可能正在运行的引导
    if (driverRef.current) {
      driverRef.current.destroy();
      activeRef.current = false;
    }
    clearDone(pageKey);
    // 下一帧启动，确保销毁完成
    requestAnimationFrame(() => {
      const visibleSteps = filterVisibleSteps(steps);
      if (visibleSteps.length === 0) return;

      const drv = driver({
        showProgress: true,
        allowClose: true,
        nextBtnText: '下一步',
        prevBtnText: '上一步',
        doneBtnText: '完成',
        closeBtnText: '跳过',
        steps: visibleSteps,
        onDestroyStarted: () => {
          if (!drv.hasNextStep() || drv.isLastStep()) {
            markDone(pageKey);
          }
          drv.destroy();
          activeRef.current = false;
        },
      });

      driverRef.current = drv;
      activeRef.current = true;
      drv.drive();
    });
  }, [pageKey, steps]);

  // 监听 tour:restart DOM 事件
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
```

- [ ] **Step 2: 运行类型检查**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 3: Commit**

```bash
cd frontend && git add src/hooks/useTour.ts
git commit -m "feat(tour): add useTour hook with start/restart and DOM event listener"
```

---

### Task 4: Home 页接入引导

**Files:**
- Modify: `frontend/src/pages/Home.tsx`

**Interfaces:**
- Consumes: `useTour` from `../hooks/useTour`、`HOME_STEPS` from `../tour/steps`
- 注意：Home 页的 `loading` 状态变量名为 `loading`（布尔），在数据加载完成后为 `false`。

- [ ] **Step 1: 给三个目标模块加 data-tour 属性**

在 `Home.tsx` 的 JSX 中：

1. **取号入口区** — 找到取号入口卡片的容器 div（包含两个 Link 卡片的 `<div className="grid gap-4 sm:grid-cols-2">`），给它加 `data-tour="home-entry"`。该 div 位于 `<div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">` 内部。

找到：
```jsx
<div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
```
在其上方紧邻的 `<div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">` 上加属性：
```jsx
<div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg" data-tour="home-entry">
```

2. **月度统计卡** — 找到 `<Card className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden">`（Chart Card），加 `data-tour="home-chart"`：

```jsx
<Card className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden" data-tour="home-chart">
```

3. **贡献者卡** — 找到 `<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between">`（贡献者卡片），加 `data-tour="home-contributors"`：

```jsx
<div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between" data-tour="home-contributors">
```

- [ ] **Step 2: 引入 useTour hook 并添加启动逻辑**

在 `Home.tsx` 顶部 import 区追加：

```typescript
import { useTour } from '../hooks/useTour';
import { HOME_STEPS } from '../tour/steps';
```

在 `Home` 函数体内，`const [activeStatTab, setActiveStatTab]` 之后，加：

```typescript
const { startTour } = useTour('home', HOME_STEPS);
```

在 `useEffect(() => { loadData(); }, []);` 之后，新增一个 useEffect：

```typescript
useEffect(() => {
  if (!loading) {
    startTour();
  }
}, [loading, startTour]);
```

- [ ] **Step 3: 运行类型检查**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 4: 手动验证 — 清 localStorage 并访问首页**

1. 打开浏览器 DevTools → Application → Local Storage，删除所有 `tour.*` 键。
2. 访问 `http://localhost:5173/`，确认引导自动弹出，走完 3 步。
3. 刷新页面，确认引导不再弹出。
4. 确认 localStorage 中 `tour.home.done` 为 `'1'`。

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/pages/Home.tsx
git commit -m "feat(tour): integrate onboarding guide into Home page"
```

---

### Task 5: 变更管理页接入引导

**Files:**
- Modify: `frontend/src/pages/ChangeManagementPage.tsx`

**Interfaces:**
- Consumes: `useTour` from `../hooks/useTour`、`CHANGE_STEPS` from `../tour/steps`
- 注意：该页的 loading 状态变量名为 `progressLoading`（布尔），在数据加载完成后为 `false`。

- [ ] **Step 1: 给两个目标模块加 data-tour 属性**

1. **取号表单列** — 找到左侧 3 列布局的 div：

```jsx
<div className="lg:col-span-3 min-w-0">
  <ApplicationForm onApplicationSubmitted={handleApplicationSubmitted} />
</div>
```

加属性：
```jsx
<div className="lg:col-span-3 min-w-0" data-tour="change-form">
```

2. **变更进度查询卡** — 找到 `<Card className="border-sky-200 shadow-md">`（进度查询卡），加属性：

```jsx
<Card className="border-sky-200 shadow-md" data-tour="change-progress">
```

- [ ] **Step 2: 引入 useTour hook 并添加启动逻辑**

在 `ChangeManagementPage.tsx` 顶部 import 区追加：

```typescript
import { useTour } from '../hooks/useTour';
import { CHANGE_STEPS } from '../tour/steps';
```

在 `ChangeManagementPage` 函数体内，`const [showImportModal, setShowImportModal]` 之后，加：

```typescript
const { startTour } = useTour('change', CHANGE_STEPS);
```

在 `useEffect(() => { loadProgress(); }, [loadProgress, refreshKey]);` 之后，新增一个 useEffect：

```typescript
useEffect(() => {
  if (!progressLoading) {
    startTour();
  }
}, [progressLoading, startTour]);
```

- [ ] **Step 3: 运行类型检查**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 4: 手动验证 — 清 localStorage 并访问变更管理页**

1. 删除 localStorage 中 `tour.change.done`。
2. 访问 `http://localhost:5173/change-management`，确认引导自动弹出，走完 2 步。
3. 刷新页面，确认引导不再弹出。
4. 确认 localStorage 中 `tour.change.done` 为 `'1'`。

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/pages/ChangeManagementPage.tsx
git commit -m "feat(tour): integrate onboarding guide into Change Management page"
```

---

### Task 6: 技术文件页接入引导

**Files:**
- Modify: `frontend/src/pages/TechnicalDocumentPage.tsx`

**Interfaces:**
- Consumes: `useTour` from `../hooks/useTour`、`TECH_STEPS` from `../tour/steps`
- 注意：该页的 loading 状态变量名为 `loading`（布尔）。`DifyChatbotEmbed` 是浮动按钮组件，需要在外面包一个 div 来打标记。

- [ ] **Step 1: 给两个目标模块加 data-tour 属性**

1. **技术文件表单列** — 找到左侧布局的 div：

```jsx
<div className="min-w-0">
  <TechnicalDocumentForm onApplicationSubmitted={handleApplicationSubmitted} />
</div>
```

加属性：
```jsx
<div className="min-w-0" data-tour="tech-form">
```

2. **DifyChatbotEmbed** — 找到：

```jsx
<DifyChatbotEmbed />
```

将其包裹：
```jsx
<div data-tour="tech-chatbot">
  <DifyChatbotEmbed />
</div>
```

- [ ] **Step 2: 引入 useTour hook 并添加启动逻辑**

在 `TechnicalDocumentPage.tsx` 顶部 import 区追加：

```typescript
import { useTour } from '../hooks/useTour';
import { TECH_STEPS } from '../tour/steps';
```

在 `TechnicalDocumentPage` 函数体内，`const [detailModalOpen, setDetailModalOpen]` 之后，加：

```typescript
const { startTour } = useTour('tech', TECH_STEPS);
```

在 `useEffect(() => { loadAllQtdRecords(); }, []);` 之后，新增一个 useEffect：

```typescript
useEffect(() => {
  if (!loading) {
    startTour();
  }
}, [loading, startTour]);
```

- [ ] **Step 3: 运行类型检查**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 4: 手动验证 — 清 localStorage 并访问技术文件页**

1. 删除 localStorage 中 `tour.tech.done`。
2. 访问 `http://localhost:5173/technical-document`，确认引导自动弹出，走完 2 步。
3. 刷新页面，确认引导不再弹出。
4. 确认 localStorage 中 `tour.tech.done` 为 `'1'`。

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/pages/TechnicalDocumentPage.tsx
git commit -m "feat(tour): integrate onboarding guide into Technical Document page"
```

---

### Task 7: Layout 页脚加重看入口

**Files:**
- Modify: `frontend/src/components/Layout.tsx`

**Interfaces:**
- Consumes: `location.pathname` 判断当前页是否支持引导重看
- Produces: `dispatchEvent(new CustomEvent('tour:restart', { detail: { pageKey } }))` — 与 Task 3 的 useTour hook 中监听的事件对应。

- [ ] **Step 1: 添加路径到 pageKey 的映射与重看按钮**

在 `Layout.tsx` 中，在 `const handleLogout` 函数之后，加：

```typescript
const tourPageMap: Record<string, string> = {
  '/': 'home',
  '/change-management': 'change',
  '/technical-document': 'tech',
};

const currentPageKey = tourPageMap[location.pathname];

const handleRestartTour = () => {
  if (currentPageKey) {
    window.dispatchEvent(new CustomEvent('tour:restart', { detail: { pageKey: currentPageKey } }));
  }
};
```

- [ ] **Step 2: 在页脚添加「功能引导」按钮**

找到页脚区域：

```jsx
<footer className="bg-white border-t py-6">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between items-center">
      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} 自动取号系统
      </p>
      <span className="text-xs text-muted-foreground">版本 {import.meta.env.VITE_APP_VERSION || 'v1.0'}</span>
    </div>
  </div>
</footer>
```

替换为：

```jsx
<footer className="bg-white border-t py-6">
  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between items-center">
      <p className="text-xs text-muted-foreground">
        © {new Date().getFullYear()} 自动取号系统
      </p>
      <div className="flex items-center gap-4">
        {currentPageKey && (
          <button
            onClick={handleRestartTour}
            className="text-xs text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
            title="重新查看功能引导"
          >
            📖 功能引导
          </button>
        )}
        <span className="text-xs text-muted-foreground">版本 {import.meta.env.VITE_APP_VERSION || 'v1.0'}</span>
      </div>
    </div>
  </div>
</footer>
```

- [ ] **Step 3: 运行类型检查**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 无错误输出。

- [ ] **Step 4: 手动验证 — 重看功能**

1. 在首页，确认页脚显示「📖 功能引导」按钮。
2. 点击按钮，确认引导重新弹出。
3. 走完或跳过引导，刷新页面确认不再自动弹出。
4. 导航到变更管理页，确认页脚仍有「📖 功能引导」按钮，点击可重启该页引导。
5. 导航到管理员登录页 `/admin/login`，确认页脚**不显示**「📖 功能引导」按钮。

- [ ] **Step 5: Commit**

```bash
cd frontend && git add src/components/Layout.tsx
git commit -m "feat(tour): add restart tour button in Layout footer"
```

---

### Task 8: 端到端验收

**Files:** 无新增/修改，纯验证。

- [ ] **Step 1: 清除所有引导记录**

在浏览器 DevTools → Application → Local Storage 中删除所有 `tour.*` 键。

- [ ] **Step 2: 验证首页引导**

访问 `/`，确认 3 步引导自动弹出（取号入口 → 月度审核数量 → 贡献者展示），走完后 `tour.home.done` 为 `'1'`。

- [ ] **Step 3: 验证变更管理页引导**

访问 `/change-management`，确认 2 步引导自动弹出（自动取号 → 变更进度），走完后 `tour.change.done` 为 `'1'`。

- [ ] **Step 4: 验证技术文件页引导**

访问 `/technical-document`，确认 2 步引导自动弹出（技术文件申请 → 知识库避坑），走完后 `tour.tech.done` 为 `'1'`。

- [ ] **Step 5: 验证跳过行为**

清除 `tour.home.done`，访问 `/`，引导弹出后点「跳过」，确认 `tour.home.done` 仍被设为 `'1'`，刷新不再弹出。

- [ ] **Step 6: 验证重看**

在首页点页脚「📖 功能引导」，确认引导重启；走完后不再自动弹出。在变更管理页和技术文件页重复此验证。

- [ ] **Step 7: 验证非引导页无重看按钮**

访问 `/admin/login`、`/guide/ten-qna`，确认页脚不显示「📖 功能引导」按钮。

- [ ] **Step 8: 最终类型检查**

```bash
cd frontend && npx tsc --noEmit
```

Expected: 无错误输出。
