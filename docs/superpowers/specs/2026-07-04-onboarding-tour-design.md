# 首次访问功能引导页设计

- 日期：2026-07-04
- 范围：前端（`frontend/`），不涉及后端
- 库选型：[driver.js](https://driverjs.com/)（~5KB gzip，现代极简，聚光灯+气泡）
- 触发：每页首次访问自动启动；页脚「📖 功能引导」可重看

## 目标

首次打开网页时，引导用户认识系统的 7 个核心模块，分布在 3 个页面：

- **主页（Home）**：取号入口、月度审核数量、贡献者展示
- **变更管理页**：变更编号自动取号操作与显示、变更进度查询/更新
- **技术文件页**：技术文件编号申请操作与显示、知识库避坑查询

## 关键决策

1. 呈现形式：**分步高亮向导**（全屏遮罩 + 聚焦高亮一个元素 + 气泡卡片，含 上一步/下一步/跳过）。
2. 跨页处理：**每页独立引导**。主页 3 步、变更页 2 步、技术页 2 步；进入某页首次时各自启动，互不跨页联动。
3. 避坑查询：**指向现有 `DifyChatbotEmbed`**，引导第 7 步高亮它，不新建后端。
4. 重看机制：页脚加「📖 功能引导」入口，点击重新触发当前页引导。
5. 库：driver.js。

## 架构

### 新增文件

1. `frontend/src/hooks/useTour.ts` — 可复用引导 hook。
2. `frontend/src/tour/steps.ts` — 三页步骤定义常量。
3. `frontend/src/tour/driver.css` — 覆盖 driver.js 默认主题，对齐项目配色（primary `#00AEAA`、强调 `#EF8641`、圆角、字体）。在 `App.tsx` 顶层 import 一次。

### 可复用 hook：`useTour(pageKey)`

- 文件：`frontend/src/hooks/useTour.ts`
- 入参：`pageKey: 'home' | 'change' | 'tech'`，以及该页的 `DriveStep[]`（由调用方从 `steps.ts` import）。
- localStorage key：`tour.<pageKey>.done`（值为 `'1'` 时表示已完成）。
- 返回：`{ startTour, restartTour }`。
  - `startTour()`：仅当 `!localStorage['tour.<pageKey>.done']` 且无活动引导时启动。
  - `restartTour()`：清 localStorage 后启动（供重看入口）。
- 内部用 `useRef` 持有 driver 实例与 `tourActive` 标记，防重复触发。
- driver 配置：
  - `allowClose: true`（点遮罩可关闭）
  - `nextBtnText: '下一步'`、`prevBtnText: '上一步'`、`doneBtnText: '完成'`、`closeBtnText: '跳过'`
  - `onDestroyStarted`：写 `localStorage['tour.<pageKey>.done'] = '1'`。
  - `onPopoverRender` 前/启动前逐个 `document.querySelector` 校验步骤目标存在，缺失则跳过该步并 `console.warn`，不阻断后续。

### 步骤定义：`frontend/src/tour/steps.ts`

导出三个常量：`HOME_STEPS`、`CHANGE_STEPS`、`TECH_STEPS`，类型为 driver.js `DriveStep[]`，字段 `{ element, popover: { title, description, side, align } }`。元素选择器统一用 `data-tour="..."` 属性，避免依赖易变类名。

### 目标元素标记（data-tour）

在各页面对应模块根元素加 `data-tour` 属性：

- Home：`home-entry`（取号入口卡片区）、`home-chart`（月度统计卡）、`home-contributors`（贡献者卡）
- 变更页：`change-form`（取号表单列，含 `ApplicationForm`）、`change-progress`（进度查询卡）
- 技术页：`tech-form`（`TechnicalDocumentForm` 外层列）、`tech-chatbot`（`DifyChatbotEmbed` 外层包裹 div）

## 步骤内容

### Home 页（3 步）

| # | 选择器 | 标题 | 说明 | 定位 |
|---|--------|------|------|------|
| 1 | `[data-tour="home-entry"]` | 取号入口 | 选择取号类型：变更管理类（DCP/CR/CN/TD）或技术文件类（DHF/DMR），点击卡片进入对应取号界面。 | bottom |
| 2 | `[data-tour="home-chart"]` | 月度审核数量 | 统计最近 6 个月各类型取号申请数量，可切换「变更管理/技术文件」Tab，点击柱条或顶部数字查看当月申请明细。 | top |
| 3 | `[data-tour="home-contributors"]` | 贡献者展示 | 公示对系统改进有贡献的同事榜单，点击标题可查看全部贡献者名单。 | top |

### 变更管理页（2 步）

| # | 选择器 | 标题 | 说明 | 定位 |
|---|--------|------|------|------|
| 1 | `[data-tour="change-form"]` | 自动取号操作与显示 | 左侧填写变更申请表，提交后系统自动生成编号；中间列表实时显示已取号的变更记录。 | right |
| 2 | `[data-tour="change-progress"]` | 变更进度查询/更新 | 下方表格按 CR/DCP/CN 编号查询变更发布，支持搜索、按项目折叠、批量导入导出。工程师可自行维护变更进度。 | top |

### 技术文件页（2 步）

| # | 选择器 | 标题 | 说明 | 定位 |
|---|--------|------|------|------|
| 1 | `[data-tour="tech-form"]` | 技术文件编号申请 | 左侧填写，提交后自动生成编号，*是必填信息。 | right |
| 2 | `[data-tour="tech-chatbot"]` | 知识库避坑查询 | 点击右下角的悬浮的【信息小图标】，向 AI 知识库提问，获取避坑建议与规范指引👉。 | left |

## 改动文件清单

1. **`frontend/src/components/Layout.tsx`**
   - 页脚加「📖 功能引导」按钮。点击逻辑：根据 `location.pathname` 映射到 pageKey，`dispatchEvent(new CustomEvent('tour:restart', { detail: { pageKey } }))`。
   - 路径映射：`/` → `home`，`/change-management` → `change`，`/technical-document` → `tech`；其余路径隐藏按钮。
   - 用 DOM 事件而非 context，避免改 Layout props 链。

2. **`frontend/src/pages/Home.tsx`**
   - 三个模块根元素加 `data-tour`。
   - `import { useTour } from '../hooks/useTour'` + `import { HOME_STEPS } from '../tour/steps'`。
   - `const { startTour, restartTour } = useTour('home', HOME_STEPS)`。
   - `useEffect`：`loading === false` 时 `startTour()`。
   - `useEffect`：监听 `tour:restart`，`detail.pageKey === 'home'` 时 `restartTour()`。

3. **`frontend/src/pages/ChangeManagementPage.tsx`**
   - 同理，`data-tour="change-form"` / `"change-progress"`。
   - `useTour('change', CHANGE_STEPS)`，`progressLoading === false` 后启动。
   - 取号表单列：在外层 `<div className="lg:col-span-3 ...">` 加 `data-tour="change-form"`。

4. **`frontend/src/pages/TechnicalDocumentPage.tsx`**
   - 同理，`data-tour="tech-form"` / `"tech-chatbot"`。
   - `useTour('tech', TECH_STEPS)`，该页 `loading` 完成后启动。
   - `tech-form`：给 `TechnicalDocumentForm` 外层列加属性。
   - `tech-chatbot`：在 `<DifyChatbotEmbed />` 外包一个 `<div data-tour="tech-chatbot">`（该组件为浮动按钮式，需容器才能稳定定位）。

5. **`frontend/src/App.tsx`**
   - 顶层 `import './tour/driver.css'`（一次性加载主题覆盖）。

## 数据流

```
首次访问 Home
  → useEffect: loading=false 且 !tour.home.done
  → useTour.startTour() → driver.js 高亮 [data-tour="home-entry"]...
  → 走完/跳过 → onDestroyStarted → localStorage tour.home.done='1'

点页脚「功能引导」
  → Layout dispatchEvent('tour:restart', {pageKey})
  → 当前页监听到且 pageKey 匹配 → restartTour()（清 localStorage + startTour）
```

## 错误处理与边界

- **元素缺失**：driver 启动前逐个 `document.querySelector` 校验，缺目标跳过该步并 `console.warn`，不阻断后续。
- **异步数据**：每页仅在 `loading === false` 后启动，避免高亮未渲染元素。
- **重复触发**：`useRef` 标记 `tourActive`，防止 effect 重复跑。
- **移动端**：driver.js 自带响应式，气泡自动调整位置；暂不做额外小屏适配。
- **重复 import**：driver.css 仅在 `App.tsx` import 一次。

## 测试

- 清 localStorage → 访问三页，确认每页首次自动引导 7 步全覆盖（Home 3 + 变更 2 + 技术 2）。
- 跳过与走完都正确写 `tour.<pageKey>.done`。
- 重看：点页脚按钮，确认当前页引导重启。
- 非三个引导页（Home / 变更 / 技术）路径下，页脚按钮隐藏。
- `tsc --noEmit` 通过。

## 不做（YAGNI）

- 不跨页联动引导。
- 不新建避坑查询后端接口（复用现有 DifyChatbotEmbed）。
- 不做引导进度保存/断点续看（每页独立，跳过即视为完成）。
- 不做多语言（沿用项目当前中文）。
