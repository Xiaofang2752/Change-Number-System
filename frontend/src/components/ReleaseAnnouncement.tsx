import { useEffect, useState } from 'react';
import { X, Megaphone, FileDown } from 'lucide-react';

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

  return (
    <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 shadow-sm p-4 sm:p-5 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-400" />
      <div className="flex items-start gap-3.5">
        <span className="shrink-0 flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 text-amber-600 text-xl shadow-sm">
          <Megaphone className="h-5 w-5" />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <h3 className="text-sm font-bold text-amber-900">系统更新通知</h3>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-orange-500 text-white">
              模板已更新
            </span>
          </div>
          <ul className="space-y-1.5 text-[13px] leading-relaxed text-slate-700">
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span>
                DCP、变更影响评估表等模板已更新，请及时更新 SVN 表单。
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
              <span className="flex items-start gap-1.5">
                <FileDown className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  为方便工程师，小编已新增「下载表单」功能：取号后自动获取最新 DCP 模板（含《变更影响评估表》《风险登记册》），无需再手动拷贝。
                </span>
              </span>
            </li>
          </ul>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-white/70 hover:bg-amber-100 text-slate-500 hover:text-amber-700 border border-amber-200/60 transition"
          title="我知道了"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex justify-end">
        <button
          onClick={dismiss}
          className="px-4 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold shadow-sm transition"
        >
          我知道了
        </button>
      </div>
    </div>
  );
}
