import { useState, useCallback } from 'react';
import { Layout } from '../components/Layout';
import { ApplicationForm } from '../components/ApplicationForm';
import { ApplicationList } from '../components/ApplicationList';
import { Map, HelpCircle, ArrowRight, Flame } from 'lucide-react';

export function Home() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleApplicationSubmitted = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 min-w-0">
          <ApplicationForm onApplicationSubmitted={handleApplicationSubmitted} />
        </div>
        <div className="lg:col-span-7 min-w-0">
          <ApplicationList key={refreshKey} />
        </div>
        <div className="lg:col-span-2 min-w-0">
          <div className="px-2.5 sm:px-4 py-4 border-2 border-primary/10 rounded-2xl bg-gradient-to-br from-primary/10 via-white/95 to-blue-50/40 sticky top-24 shadow-md hover:shadow-xl transition-all duration-300 relative overflow-hidden group">
            {/* 炫酷的顶部发光装饰条 */}
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary via-blue-500 to-primary" />
            
            {/* 必看标签 */}
            <div className="flex items-center justify-between mb-3.5 select-none">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-red-500 text-white uppercase tracking-wider animate-pulse shadow-sm shadow-red-100">
                <Flame className="h-3 w-3 sm:h-3.5 sm:w-3.5 fill-current shrink-0" />
                <span>工程师必看</span>
              </span>
              <span className="text-[10px] font-bold text-primary font-mono">
                SOP Guide
              </span>
            </div>

            <h3 className="text-[11px] sm:text-xs md:text-sm font-black text-slate-800 tracking-tight whitespace-nowrap overflow-visible mb-1" title="变更实操 Q&A（10问10答）">
              变更实操Q&A (10问10答)
            </h3>
            <p className="text-[10px] sm:text-[11px] text-slate-500 whitespace-nowrap overflow-hidden text-ellipsis mb-4" title="快速掌握变更发布规范，安全上线。">
              避坑指南，快速上手
            </p>

            <ul className="space-y-2.5 mb-4 text-[11px] sm:text-xs text-slate-600 font-semibold select-none">
              <li className="flex items-center gap-2 hover:text-primary transition-colors whitespace-nowrap overflow-hidden text-ellipsis" title="🗺️ 实操步骤一览图">
                <Map className="h-3.5 w-3.5 text-primary shrink-0" />
                <span className="truncate">实操步骤一览图</span>
              </li>
              <li className="flex items-center gap-2 hover:text-blue-600 transition-colors whitespace-nowrap overflow-hidden text-ellipsis" title="💬 常见排障与答疑">
                <HelpCircle className="h-3.5 w-3.5 text-blue-500 shrink-0" />
                <span className="truncate">常见问题答疑</span>
              </li>
            </ul>

            <a 
              href="/guide/ten-qna" 
              className="mt-3.5 w-full h-8.5 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/95 hover:to-blue-700 text-white font-bold text-[11px] rounded-lg shadow-sm hover:shadow-md transition-all duration-200 flex items-center justify-center gap-1.5 group-hover:translate-x-0.5"
            >
              <span>查看完整指南</span>
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
        </div>
      </div>
    </Layout>
  );
}
