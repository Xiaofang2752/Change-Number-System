import { useEffect, useState } from 'react';
import { X, Megaphone, FileDown, RefreshCw } from 'lucide-react';

// 系统发布版本标识：每次发布新功能后修改此值，即可让所有工程师再次看到更新提示
const RELEASE_KEY = 'release-2026-08-06';

export function ReleaseAnnouncement() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('release_announcement_seen');
      if (seen !== RELEASE_KEY) {
        setVisible(true);
      }
    } catch {
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      localStorage.setItem('release_announcement_seen', RELEASE_KEY);
    } catch {
      /* ignore */
    }
    setVisible(false);
  };

  if (!visible) return null;

  const message = (
    <span className="inline-flex items-center gap-2 px-8 text-[13px] text-amber-900">
      <RefreshCw className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span>
        DCP、变更影响评估表等模板已更新，请及时更新 SVN 表单。
      </span>
      <span className="text-amber-400">·</span>
      <FileDown className="h-3.5 w-3.5 text-amber-500 shrink-0" />
      <span>
        为方便工程师，小编已新增「下载表单」功能：取号后自动获取最新 DCP 模板（含《变更影响评估表》《风险登记册》），无需再手动拷贝。
      </span>
    </span>
  );

  return (
    <div className="relative flex items-stretch h-11 rounded-xl border border-amber-200 bg-gradient-to-r from-amber-50 to-amber-100 shadow-sm overflow-hidden">
      {/* 左侧固定标签 */}
      <div className="shrink-0 z-10 flex items-center gap-1.5 pl-3 pr-3 h-full bg-amber-200/80 text-amber-900 font-bold text-xs border-r border-amber-300/60">
        <Megaphone className="h-4 w-4" />
        系统更新通知
      </div>

      {/* 滚动区域 */}
      <div className="relative flex-1 overflow-hidden">
        <div className="announce-marquee flex items-center h-full w-max whitespace-nowrap">
          {/* 重复两份保证无缝循环 */}
          {message}
          {message}
          {message}
          {message}
        </div>
        {/* 两侧渐隐遮罩 */}
        <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-amber-50 to-transparent" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-amber-100 to-transparent" />
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={dismiss}
        className="shrink-0 z-10 flex items-center justify-center w-9 h-full bg-amber-200/80 hover:bg-amber-300 text-amber-700 border-l border-amber-300/60 transition"
        title="我知道了"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
