import type { DriveStep } from 'driver.js';

export const HOME_STEPS: DriveStep[] = [
  {
    element: '[data-tour="home-entry"]',
    popover: {
      title: '取号入口',
      description: '选择取号类型，点击卡片进入对应取号界面。',
      side: 'top' as const,
      align: 'center' as const,
    },
  },
  {
    element: '[data-tour="home-chart"]',
    popover: {
      title: '月度审核数量',
      description: '统计近 6 个月各类型取号申请数量，可切换「变更管理/技术文件」Tab，点击柱条或顶部数字查看当月申请明细。',
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
      description: '左侧填写，提交后系统自动生成编号；中间列表实时显示已取号的变更记录。',
      side: 'right' as const,
      align: 'start' as const,
    },
  },
  {
    element: '[data-tour="change-progress"]',
    popover: {
      title: '变更进度查询/更新',
      description: '下方表格按 CR/DCP/CN 编号查询变更发布，支持搜索、按项目折叠、批量导入导出。工程师可自行维护变更进度。',
      side: 'top' as const,
      align: 'center' as const,
    },
  },
  {
    element: '[data-tour="change-qna"]',
    popover: {
      title: '常见问题 10 问 10 答',
      description: '右侧「变更实操 Q&A」提供变更实操步骤一览图和常见问题答疑',
      side: 'left' as const,
      align: 'start' as const,
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
    element: '[data-tour="tech-folders"]',
    popover: {
      title: '项目文件列表',
      description: '点击文件夹可查看该项目下已生成的全部技术文档清单，支持搜索和分页。',
      side: 'top' as const,
      align: 'center' as const,
    },
  },
  {
    element: '[data-tour="footer-restart-tour"]',
    popover: {
      title: '知识库避坑查询',
      description: '点击右下角的悬浮的【信息小图标】，向 AI 知识库提问，获取避坑建议与规范指引👉',
      side: 'top' as const,
      align: 'center' as const,
    },
  },
];
