import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { ArrowRight } from 'lucide-react';
import { applicationAPI, contributorAPI, type Application, type Contributor } from '../services';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { formatBeijingTime } from '@/utils/timezone';
import { useTour } from '../hooks/useTour';
import { HOME_STEPS } from '../tour/steps';

const typeColors: { [key: string]: string } = {
  DCP: 'bg-amber-500',
  CR: 'bg-rose-500',
  CN: 'bg-emerald-500',
  TD: 'bg-sky-500',
};

const types = ['DCP', 'CR', 'CN', 'TD'];

const techCategories = [
  { code: 'PRODUCT_TECH', name: '产品技术文件', color: 'bg-violet-500' },
  { code: 'GENERAL_TECH', name: '通用技术', color: 'bg-indigo-500' },
  { code: 'DHF', name: 'DHF', color: 'bg-sky-500' },
  { code: 'SOP', name: 'SOP', color: 'bg-cyan-500' },
  { code: 'PROGRAM', name: '程序', color: 'bg-emerald-500' },
  { code: 'BOM', name: 'BOM（仪器/模块/软件清单）', color: 'bg-amber-500' },
  { code: 'BOM_PCBA', name: 'PCBA', color: 'bg-orange-500' },
  { code: 'OTHER_DRAWING', name: '其他图纸', color: 'bg-slate-500' },
  { code: 'HISTORICAL', name: '历史文档', color: 'bg-slate-400' },
];


export function Home() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [contributors, setContributors] = useState<Contributor[]>([]);
  
  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [modalRecords, setModalRecords] = useState<Application[]>([]);
  const [contribModalOpen, setContribModalOpen] = useState(false);
  const [activeStatTab, setActiveStatTab] = useState<'change' | 'tech'>('change');
  const { startTour } = useTour('home', HOME_STEPS);


  const loadData = async () => {
    try {
      const res = await applicationAPI.getAll({ limit: 1000 });
      const responseData = (res as { data: { data: Application[] } }).data;
      const allApps = responseData?.data || [];
      // 过滤掉历史导入的数据，不统计到月度统计中
      const filteredApps = allApps.filter(app => app.applicant_type?.toLowerCase() !== 'imported');
      setApplications(filteredApps);

      // 加载贡献者数据
      const contribRes = await contributorAPI.getAll();
      setContributors((contribRes as { data: Contributor[] }).data || []);
    } catch (err) {
      console.error('加载数据失败', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      startTour();
    }
  }, [loading, startTour]);

  const getLastMonths = (num = 6) => {
    const months = [];
    const d = new Date();
    for (let i = 0; i < num; i++) {
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      months.unshift(`${year}-${month}`);
      d.setMonth(d.getMonth() - 1);
    }
    return months;
  };

  const months = getLastMonths(6);

  const monthlyData = months.map(month => {
    const dataForMonth = applications.filter(app => app.created_at?.startsWith(month));
    const counts: { [key: string]: number } = {};
    const recordsByType: { [key: string]: Application[] } = {};

    types.forEach(type => {
      const typeRecords = dataForMonth.filter(app => app.number_type === type);
      counts[type] = typeRecords.length;
      recordsByType[type] = typeRecords;
    });

    const total = dataForMonth.length;

    return {
      month,
      counts,
      recordsByType,
      total,
    };
  });

  const maxTotal = Math.max(...monthlyData.map(d => d.total), 5);

  // 技术文件月度统计（按文件类别细分）
  const getTechCategoryCode = (app: Application) => {
    if (app.number_type === 'HISTORICAL') return 'HISTORICAL';
    if (app.category === 'BOM_ASSE' || app.category === 'BOM_SOFT') return 'BOM';
    return app.category || 'OTHER';
  };

  const techMonthlyData = months.map(month => {
    const dataForMonth = applications.filter(app => {
      if (app.applicant_type?.toLowerCase() === 'imported') return false;
      const techNumberTypes = ['QTD', 'DHF', 'SOP', 'SOFT', 'BOM', 'DRW', 'HISTORICAL'];
      return app.created_at?.startsWith(month) && techNumberTypes.includes(app.number_type);
    });
    const counts: { [key: string]: number } = {};
    const recordsByCategory: { [key: string]: Application[] } = {};

    techCategories.forEach(cat => {
      const catRecords = dataForMonth.filter(app => getTechCategoryCode(app) === cat.code);
      counts[cat.code] = catRecords.length;
      recordsByCategory[cat.code] = catRecords;
    });
    recordsByCategory['ALL'] = dataForMonth;

    return {
      month,
      counts,
      recordsByCategory,
      total: dataForMonth.length,
    };
  });

  const techMaxTotal = Math.max(...techMonthlyData.map(d => d.total), 5);


  const handleMonthTotalClick = (month: string, records: Application[]) => {
    setModalTitle(`${month} 月度全部申请明细`);
    setModalRecords(records);
    setModalOpen(true);
  };

  const handleDetailClick = (month: string, type: string, records: Application[]) => {
    setModalTitle(`${month} 月度 ${type} 申请明细`);
    setModalRecords(records);
    setModalOpen(true);
  };

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-lg">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div data-tour="home-system-title">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">请选择取号入口</p>
              <h1 className="mt-4 text-4xl font-bold text-slate-900">自动取号系统</h1>
              <p className="mt-3 max-w-2xl text-slate-600 leading-7">
                帮助工程师快速获取编号
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2" data-tour="home-entry">
              <Link
                to="/change-management"
                className="group rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left shadow-sm transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-[1.02] hover:shadow-xl hover:border-[#00AEAA] hover:bg-[#00AEAA] hover:shadow-[#00AEAA]/30"
              >
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 transition-colors duration-300 group-hover:text-white/80">变更管理类</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900 transition-colors duration-300 group-hover:text-white">DCP / CR / CN / TD</h2>
                  </div>
                  <span className="text-3xl transition-transform duration-300 group-hover:scale-125 group-hover:rotate-12 select-none">🛠️</span>
                </div>
                <p className="text-sm text-slate-600 transition-colors duration-300 group-hover:text-white/90">进入变更管理类取号界面，查看变更实操 Q&A </p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors duration-300 group-hover:text-[#EF8641]">
                  前往变更取号
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-2" />
                </div>
              </Link>
              <Link
                to="/technical-document"
                className="group rounded-3xl border border-slate-200 bg-slate-50 p-6 text-left shadow-sm transition-all duration-300 ease-out hover:-translate-y-2 hover:scale-[1.02] hover:shadow-xl hover:border-[#00AEAA] hover:bg-[#00AEAA] hover:shadow-[#00AEAA]/30"
              >
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 transition-colors duration-300 group-hover:text-white/80">技术文件类</p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-900 transition-colors duration-300 group-hover:text-white">DHF / DMR</h2>
                  </div>
                  <span className="text-3xl transition-transform duration-300 group-hover:scale-125 group-hover:rotate-[6deg] select-none">📄</span>
                </div>
                <p className="text-sm text-slate-600 transition-colors duration-300 group-hover:text-white/90">用于技术文件编号，支持项目类文件</p>
                <div className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-primary transition-colors duration-300 group-hover:text-[#EF8641]">
                  前往技术文件取号
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-2" />
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Chart Card */}
        <Card className="rounded-3xl border border-slate-200 bg-white shadow-sm overflow-hidden" data-tour="home-chart">
          <CardHeader className="bg-gradient-to-r from-slate-50 via-slate-100/50 to-slate-50 border-b py-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-xl font-bold text-slate-800">月度申请统计</CardTitle>
                <p className="text-xs text-muted-foreground mt-1">统计最近6个月各类型取号申请数量，点击柱条或顶部数字查看申请明细。</p>
              </div>
              <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-sm w-fit">
                <button
                  onClick={() => setActiveStatTab('change')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 select-none ${
                    activeStatTab === 'change'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  变更管理 (DCP/CR/CN/TD)
                </button>
                <button
                  onClick={() => setActiveStatTab('tech')}
                  className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all duration-200 select-none ${
                    activeStatTab === 'tech'
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  技术文件统计
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-12 text-sm text-slate-500">统计加载中...</div>
            ) : activeStatTab === 'change' ? (
              <div>
                {/* Legend */}
                <div className="flex flex-wrap gap-4 justify-center items-center mb-6 select-none">
                  {types.map(type => (
                    <div key={type} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <span className={`w-3.5 h-3.5 rounded-full ${typeColors[type]} shadow-sm`} />
                      <span>{type}</span>
                    </div>
                  ))}
                </div>

                {/* Chart body */}
                <div className="flex pb-2 mb-2 items-end max-w-3xl mx-auto px-4">
                  {/* Y-Axis */}
                  <div className="flex flex-col justify-between text-[10px] text-slate-400 font-bold font-mono h-56 pr-4 select-none pb-6">
                    <span>{maxTotal}</span>
                    <span>{Math.round(maxTotal * 0.75)}</span>
                    <span>{Math.round(maxTotal * 0.5)}</span>
                    <span>{Math.round(maxTotal * 0.25)}</span>
                    <span>0</span>
                  </div>

                  {/* Bars Container */}
                  <div className="flex-1 flex justify-around items-end h-56 pb-6 relative border-b border-slate-200 border-l border-slate-100">
                    {/* Horizontal gridlines */}
                    <div className="absolute inset-x-0 top-0 border-t border-slate-100/50 pointer-events-none" />
                    <div className="absolute inset-x-0 top-1/4 border-t border-slate-100/50 pointer-events-none" />
                    <div className="absolute inset-x-0 top-1/2 border-t border-slate-100/50 pointer-events-none" />
                    <div className="absolute inset-x-0 top-3/4 border-t border-slate-100/50 pointer-events-none" />

                    {monthlyData.map(monthInfo => {
                      const barHeightPercent = maxTotal > 0 ? (monthInfo.total / maxTotal) * 100 : 0;
                      const dataForMonth = applications.filter(app => app.created_at?.startsWith(monthInfo.month));
                      return (
                        <div key={monthInfo.month} className="flex flex-col items-center justify-end w-12 sm:w-16 h-full relative z-10 group">
                          {/* Total Value Clickable */}
                          {monthInfo.total > 0 && (
                            <button
                              onClick={() => handleMonthTotalClick(monthInfo.month, dataForMonth)}
                              className="text-[10px] font-black text-slate-600 bg-slate-100 hover:bg-sky-100 hover:text-sky-700 px-1.5 py-0.5 rounded transition mb-2 shadow-sm select-none"
                              title={`点击查看 ${monthInfo.month} 月全部记录`}
                            >
                              {monthInfo.total}
                            </button>
                          )}

                          {/* Stacked Bar */}
                          <div 
                            className="w-7 sm:w-9 bg-slate-50 border border-slate-200/60 rounded-t-md overflow-hidden flex flex-col-reverse justify-start shadow-sm group-hover:shadow-md transition-all duration-200" 
                            style={{ height: `${Math.max(barHeightPercent, 2)}%`, minHeight: monthInfo.total > 0 ? '8px' : '0px' }}
                          >
                            {types.map(type => {
                              const count = monthInfo.counts[type];
                              if (count === 0) return null;
                              const pct = (count / monthInfo.total) * 100;
                              return (
                                <button
                                  key={type}
                                  onClick={() => handleDetailClick(monthInfo.month, type, monthInfo.recordsByType[type])}
                                  style={{ height: `${pct}%` }}
                                  className={`w-full ${typeColors[type]} hover:brightness-95 transition-all cursor-pointer relative group/segment`}
                                  title={`${monthInfo.month} ${type}: ${count}条 (点击查看详情)`}
                                >
                                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white opacity-0 group-hover/segment:opacity-100 transition-opacity">
                                    {count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Month Label */}
                          <span className="absolute -bottom-6 text-[10px] sm:text-xs font-bold text-slate-400 select-none">
                            {monthInfo.month.slice(5)}月
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              <div>
                {/* Tech Doc Legend */}
                <div className="flex flex-wrap gap-3 justify-center items-center mb-6 select-none">
                  {techCategories.map(cat => (
                    <div key={cat.code} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
                      <span className={`w-3 h-3 rounded-full ${cat.color} shadow-sm`} />
                      <span>{cat.name}</span>
                    </div>
                  ))}
                </div>

                {/* Tech Doc Chart body */}
                <div className="flex pb-2 mb-2 items-end max-w-3xl mx-auto px-4">
                  {/* Y-Axis */}
                  <div className="flex flex-col justify-between text-[10px] text-slate-400 font-bold font-mono h-56 pr-4 select-none pb-6">
                    <span>{techMaxTotal}</span>
                    <span>{Math.round(techMaxTotal * 0.75)}</span>
                    <span>{Math.round(techMaxTotal * 0.5)}</span>
                    <span>{Math.round(techMaxTotal * 0.25)}</span>
                    <span>0</span>
                  </div>

                  {/* Bars Container */}
                  <div className="flex-1 flex justify-around items-end h-56 pb-6 relative border-b border-slate-200 border-l border-slate-100">
                    {/* Horizontal gridlines */}
                    <div className="absolute inset-x-0 top-0 border-t border-slate-100/50 pointer-events-none" />
                    <div className="absolute inset-x-0 top-1/4 border-t border-slate-100/50 pointer-events-none" />
                    <div className="absolute inset-x-0 top-1/2 border-t border-slate-100/50 pointer-events-none" />
                    <div className="absolute inset-x-0 top-3/4 border-t border-slate-100/50 pointer-events-none" />

                    {techMonthlyData.map(monthInfo => {
                      const barHeightPercent = techMaxTotal > 0 ? (monthInfo.total / techMaxTotal) * 100 : 0;
                      return (
                        <div key={monthInfo.month} className="flex flex-col items-center justify-end w-12 sm:w-16 h-full relative z-10 group">
                          {/* Total Value Clickable */}
                          {monthInfo.total > 0 && (
                            <button
                              onClick={() => handleMonthTotalClick(monthInfo.month, monthInfo.recordsByCategory['ALL'] || [])}
                              className="text-[10px] font-black text-slate-600 bg-slate-100 hover:bg-sky-100 hover:text-sky-700 px-1.5 py-0.5 rounded transition mb-2 shadow-sm select-none"
                              title={`点击查看 ${monthInfo.month} 月技术文件全部记录`}
                            >
                              {monthInfo.total}
                            </button>
                          )}

                          {/* Stacked Bar */}
                          <div 
                            className="w-7 sm:w-9 bg-slate-50 border border-slate-200/60 rounded-t-md overflow-hidden flex flex-col-reverse justify-start shadow-sm group-hover:shadow-md transition-all duration-200" 
                            style={{ height: `${Math.max(barHeightPercent, 2)}%`, minHeight: monthInfo.total > 0 ? '8px' : '0px' }}
                          >
                            {techCategories.map(cat => {
                              const count = monthInfo.counts[cat.code];
                              if (count === 0) return null;
                              const pct = (count / monthInfo.total) * 100;
                              return (
                                <button
                                  key={cat.code}
                                  onClick={() => handleDetailClick(monthInfo.month, cat.name, monthInfo.recordsByCategory[cat.code])}
                                  style={{ height: `${pct}%` }}
                                  className={`w-full ${cat.color} hover:brightness-95 transition-all cursor-pointer relative group/segment`}
                                  title={`${monthInfo.month} ${cat.name}: ${count}条 (点击查看详情)`}
                                >
                                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-white opacity-0 group-hover/segment:opacity-100 transition-opacity">
                                    {count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>

                          {/* Month Label */}
                          <span className="absolute -bottom-6 text-[10px] sm:text-xs font-bold text-slate-400 select-none">
                            {monthInfo.month.slice(5)}月
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>


        <div className="grid gap-6 lg:grid-cols-2 hidden">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">CR/CN钉钉流程讲解</h2>
            <video
              src="http://192.168.122.193:28887/buckets/yiyi/video/CR&CN-20260705.mp4"
              loop
              playsInline
              className="w-full rounded-xl"
              onMouseEnter={(e) => e.currentTarget.play()}
              onMouseLeave={(e) => { e.currentTarget.pause(); e.currentTarget.currentTime = 0; }}
              style={{ maxHeight: '240px', objectFit: 'cover' }}
            />
            <p className="mt-3 text-xs text-slate-500">鼠标悬停自动播放，移开暂停。视频创作灵感来自“整体论/简化论”</p>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm flex flex-col justify-between" data-tour="home-contributors">
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 
                  className="text-xl font-semibold text-slate-900 cursor-pointer hover:text-[#EF8641] transition-colors"
                  onClick={() => setContribModalOpen(true)}
                  title="点击查看全部贡献者名单"
                >
                  贡献者榜单 <span className="text-xs font-normal text-slate-400 ml-1 hover:underline">查看全部 &raquo;</span>
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-sm animate-pulse">
                  🏆 正反馈致谢
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">公示对系统改进有正反馈或建设性意见的贡献者名单。</p>
              
              {contributors.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">暂无贡献者记录</p>
              ) : (
                <div className="space-y-2.5 max-h-[190px] overflow-y-auto pr-1">
                  {contributors.slice(0, 3).map((contrib, idx) => {
                    let rankIcon = '🎖️';
                    let rankBg = 'bg-slate-50 text-slate-600';
                    if (idx === 0) {
                      rankIcon = '🥇';
                      rankBg = 'bg-amber-100 text-amber-900 border border-amber-200 font-black';
                    } else if (idx === 1) {
                      rankIcon = '🥈';
                      rankBg = 'bg-slate-100 text-slate-900 border border-slate-200 font-bold';
                    } else if (idx === 2) {
                      rankIcon = '🥉';
                      rankBg = 'bg-amber-50 text-amber-800 border border-amber-100/80';
                    }

                    return (
                      <div key={contrib.id} className="flex items-start justify-between gap-3 p-2 rounded-xl border border-slate-100/80 bg-slate-50/50 hover:bg-slate-50 transition duration-150">
                        <div className="flex gap-2 items-start">
                          <span className="text-base leading-none select-none mt-0.5">{rankIcon}</span>
                          <div>
                            <p className="text-xs font-bold text-slate-800">{contrib.name}</p>
                            {contrib.description && (
                              <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">{contrib.description}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded-full ${rankBg} shadow-sm font-mono`}>
                            {contrib.points} 分
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Details Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-50 via-slate-100/50 to-slate-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📊</span>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">{modalTitle}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">共计 {modalRecords.length} 条申请记录</p>
                </div>
              </div>
              <button
                onClick={() => setModalOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
                title="关闭"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {modalRecords.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">暂无记录</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-xs text-slate-600 border-b">
                      <tr>
                        <th className="px-4 py-3 font-semibold">完整编号</th>
                        <th className="px-4 py-3 font-semibold">申请人</th>
                        <th className="px-4 py-3 font-semibold">项目代号</th>
                        <th className="px-4 py-3 font-semibold">编号类型</th>
                        <th className="px-4 py-3 font-semibold">文档名称</th>
                        <th className="px-4 py-3 font-semibold">申请时间</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs md:text-sm">
                      {modalRecords.map(record => (
                        <tr key={record.id} className="border-b hover:bg-slate-50/50">
                          <td className="px-4 py-3 font-semibold font-mono text-slate-800 select-all">{record.full_number}</td>
                          <td className="px-4 py-3 text-slate-700">{record.applicant_name}</td>
                          <td className="px-4 py-3 text-slate-600">{record.project_code || '-'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold text-white ${typeColors[record.number_type] || 'bg-slate-500'}`}>
                              {record.number_type}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate" title={record.document_name || ''}>
                            {record.document_name || '-'}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{formatBeijingTime(record.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button onClick={() => setModalOpen(false)} variant="outline">
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Contributors Modal */}
      {contribModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-3xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-slate-50 via-slate-100/50 to-slate-50 border-b flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🏆</span>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">贡献者名单</h3>
                  <p className="text-xs text-slate-500 mt-0.5">共计 {contributors.length} 位杰出贡献者</p>
                </div>
              </div>
              <button
                onClick={() => setContribModalOpen(false)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
                title="关闭"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {contributors.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">暂无贡献者记录</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-50 text-xs text-slate-600 border-b">
                      <tr>
                        <th className="px-4 py-3 font-semibold text-center w-16 whitespace-nowrap">排名</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">姓名</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">积分</th>
                        <th className="px-4 py-3 font-semibold">具体贡献描述</th>
                        <th className="px-4 py-3 font-semibold whitespace-nowrap">记录时间</th>
                      </tr>
                    </thead>
                    <tbody className="text-xs md:text-sm">
                      {contributors.map((contrib, index) => {
                        let rankBadge = `${index + 1}`;
                        if (index === 0) rankBadge = '🥇';
                        else if (index === 1) rankBadge = '🥈';
                        else if (index === 2) rankBadge = '🥉';

                        return (
                          <tr key={contrib.id} className="border-b hover:bg-slate-50/50">
                            <td className="px-4 py-3 font-semibold font-mono text-slate-800 select-none text-center w-16 whitespace-nowrap">{rankBadge}</td>
                            <td className="px-4 py-3 font-semibold text-slate-700 whitespace-nowrap">{contrib.name}</td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/50 whitespace-nowrap">
                                {contrib.points}分
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600 break-words max-w-sm">
                              {contrib.description || '-'}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                              {contrib.created_at ? formatBeijingTime(contrib.created_at) : '-'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end">
              <Button onClick={() => setContribModalOpen(false)} variant="outline">
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
