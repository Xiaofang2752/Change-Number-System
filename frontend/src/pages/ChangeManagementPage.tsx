import { useState, useEffect, useCallback, useRef } from 'react';
import { Map, HelpCircle, ArrowRight, ChevronDown, ChevronRight, Upload, Download, FileSpreadsheet, X } from 'lucide-react';
import { ApplicationForm } from '../components/ApplicationForm';
import { ApplicationList } from '../components/ApplicationList';
import { Layout } from '../components/Layout';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { changeProgressAPI } from '../services';
import type { ChangeProgress } from '../services';
import { Button } from '../components/ui/button';
import * as XLSX from 'xlsx';
import { useTour } from '../hooks/useTour';
import { CHANGE_STEPS } from '../tour/steps';

interface ImportError {
  line: number | string;
  reason: string;
}

interface ImportResult {
  imported: { line: number; cr_no: string; dcp_no: string; cn_no: string }[];
  skipped: { line: number; reason: string }[];
  errors: ImportError[];
}

const TEMPLATE_HEADERS = [
  '所属项目代号',
  'CR No.',
  'DCP No.',
  'CN No.',
  '变更描述',
  '是否影响法规(是/否)',
  '法规内容',
  'CR进度',
  'CN进度',
];

export function ChangeManagementPage() {
  const [refreshKey, setRefreshKey] = useState(0);
  const [progressList, setProgressList] = useState<ChangeProgress[]>([]);
  const [progressLoading, setProgressLoading] = useState(true);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [viewMode, setViewMode] = useState<'all' | 'project'>('all');
  const [expandedProjects, setExpandedProjects] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;
  const [selectedProgress, setSelectedProgress] = useState<ChangeProgress | null>(null);

  // 导入/导出相关状态
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const { startTour } = useTour('change', CHANGE_STEPS);
  const [importEntries, setImportEntries] = useState<Partial<ChangeProgress>[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [fileInfo, setFileInfo] = useState<string | null>(null);

  const handleApplicationSubmitted = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  const loadProgress = useCallback(async () => {
    setProgressLoading(true);
    try {
      const res = await changeProgressAPI.getAll();
      setProgressList((res as { data: ChangeProgress[] }).data || []);
    } catch (err) {
      console.error('加载变更进度失败', err);
    } finally {
      setProgressLoading(false);
    }
  }, []);

  // ===== 导入/导出/模板 =====

  const handleDownloadTemplate = () => {
    const worksheetData = [
      TEMPLATE_HEADERS,
      ['ALPHA01', 'CR-2026-001', 'DCP-2026-001', 'CN-2026-001', '示例：电源模块变更', '否', '', '已完成', '进行中'],
      ['BETA88', 'CR-2026-002', 'DCP-2026-002', '', '示例：软件版本升级', '是', '影响 GB9706.1 电气安全', '进行中', '未发起'],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    worksheet['!cols'] = [
      { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 },
      { wch: 30 }, { wch: 16 }, { wch: 30 }, { wch: 14 }, { wch: 14 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '变更进度导入模板');
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '变更进度导入模板.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileInfo(file.name);
    setImportResult(null);

    const isCsvOrTxt = /\.(csv|txt)$/i.test(file.name);
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const content = evt.target?.result;
        if (!content) {
          alert('文件内容为空');
          return;
        }
        let rows: string[][] = [];
        if (isCsvOrTxt) {
          const text = String(content);
          rows = text.split(/\r?\n/).filter(l => l.trim()).map(l => l.split(/,|，/).map(c => c.trim()));
        } else {
          const wb = XLSX.read(content, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
        }
        const dataRows = rows.slice(1).map(r => r.map(c => String(c || '').trim()));
        const entries: Partial<ChangeProgress>[] = dataRows
          .filter(r => r.some(c => c))
          .map(r => ({
            project_code: r[0] || '',
            cr_no: r[1] || '',
            dcp_no: r[2] || '',
            cn_no: r[3] || '',
            change_description: r[4] || '',
            affects_regulation: (r[5] === '是' || r[5] === '1') ? 1 : 0,
            regulation_content: r[6] || '',
            cr_progress: r[7] || '',
            cn_progress: r[8] || '',
          }));
        setImportEntries(entries);
      } catch (err) {
        console.error('文件解析失败', err);
        alert('文件解析失败，请检查格式');
      }
    };
    if (isCsvOrTxt) {
      reader.readAsText(file);
    } else {
      reader.readAsArrayBuffer(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleClearImport = () => {
    setImportEntries([]);
    setImportResult(null);
    setFileInfo(null);
  };

  const handleImport = async () => {
    if (importEntries.length === 0) {
      alert('请先上传文件或手动添加数据');
      return;
    }
    setImporting(true);
    try {
      const res = await changeProgressAPI.import({ entries: importEntries });
      const result = (res as { data: ImportResult }).data;
      setImportResult(result);
      loadProgress();
    } catch (err: unknown) {
      const errorInfo = err as { response?: { data?: { message?: string } }; message?: string };
      alert(errorInfo.response?.data?.message || errorInfo.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      await changeProgressAPI.exportCSV(searchKeyword.trim() || undefined);
    } catch (err) {
      console.error('导出失败', err);
      alert('导出失败，请重试');
    }
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    handleClearImport();
  };

  useEffect(() => {
    loadProgress();
  }, [loadProgress, refreshKey]);

  useEffect(() => {
    if (!progressLoading) {
      startTour();
    }
  }, [progressLoading, startTour]);

  // 前台即时搜索过滤
  const filteredProgress = progressList.filter(item => {
    const keyword = searchKeyword.toLowerCase().trim();
    if (!keyword) return true;
    return (
      (item.cr_no || '').toLowerCase().includes(keyword) ||
      (item.dcp_no || '').toLowerCase().includes(keyword) ||
      (item.cn_no || '').toLowerCase().includes(keyword) ||
      (item.change_description || '').toLowerCase().includes(keyword) ||
      (item.regulation_content || '').toLowerCase().includes(keyword) ||
      (item.project_code || '').toLowerCase().includes(keyword) ||
      (item.project_name || '').toLowerCase().includes(keyword)
    );
  });

  // 当搜索关键词或视图改变时重置为第 1 页
  useEffect(() => {
    setCurrentPage(1);
  }, [searchKeyword, viewMode]);

  const totalPages = Math.ceil(filteredProgress.length / pageSize) || 1;
  const paginatedProgress = filteredProgress.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  // 按项目分组
  const groupedProjects = filteredProgress.reduce((acc, record) => {
    const code = record.project_code || 'COMMON';
    const name = record.project_name || (code === 'COMMON' ? '通用 / 未分类项目' : code);
    
    if (!acc[code]) {
      acc[code] = {
        code,
        name,
        records: [],
        stats: { completed: 0, pending: 0, progress: 0 }
      };
    }
    
    acc[code].records.push(record);
    
    // 统计状态
    const cr = (record.cr_progress || '').trim();
    const cn = (record.cn_progress || '').trim();
    
    const isCompleted = cr === '已完成' && cn === '已完成';
    const isProgress = cr === '进行中' || cn === '进行中';
    
    if (isCompleted) {
      acc[code].stats.completed += 1;
    } else if (isProgress) {
      acc[code].stats.progress += 1;
    } else {
      acc[code].stats.pending += 1;
    }
    
    return acc;
  }, {} as Record<string, { code: string; name: string; records: ChangeProgress[]; stats: { completed: number; pending: number; progress: number } }>);

  const toggleProject = (code: string) => {
    setExpandedProjects(prev => ({
      ...prev,
      [code]: !prev[code]
    }));
  };

  const expandAll = () => {
    const codes = Object.keys(groupedProjects);
    const updated: Record<string, boolean> = {};
    codes.forEach(c => {
      updated[c] = true;
    });
    setExpandedProjects(updated);
  };

  const collapseAll = () => {
    setExpandedProjects({});
  };

  const getProgressStyle = (progress: string) => {
    const text = (progress || '').trim();
    if (text === '已完成') {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    }
    if (text === '未发起') {
      return 'bg-rose-50 text-rose-700 border-rose-200';
    }
    if (text === '进行中') {
      return 'bg-blue-50 text-blue-700 border-blue-200';
    }
    return 'bg-slate-50 text-slate-600 border-slate-200'; // Default styling
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-3 min-w-0" data-tour="change-form">
          <ApplicationForm onApplicationSubmitted={handleApplicationSubmitted} />
        </div>
        <div className="lg:col-span-7 min-w-0">
          <ApplicationList key={refreshKey} />
        </div>
        <div className="lg:col-span-2 min-w-0" data-tour="change-qna">
          <div className="sticky top-24 space-y-3">
            <div className="px-2.5 sm:px-4 py-4 border-2 border-primary/10 rounded-2xl bg-gradient-to-br from-primary/10 via-white/95 to-blue-50/40 shadow-md hover:shadow-xl transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-[3px] bg-gradient-to-r from-primary via-blue-500 to-primary" />
            <div className="flex items-center justify-between mb-3.5 select-none">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] sm:text-[10px] font-black bg-red-500 text-white uppercase tracking-wider animate-pulse shadow-sm shadow-red-100">
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
      
        {/* DCP, CR, CN 变更完成进度 - 还在测试中，先放在下方 */}
        <div className="col-span-12 mt-4">
          <Card className="border-sky-200 shadow-md" data-tour="change-progress">
            <CardHeader className="bg-gradient-to-r from-sky-50/50 to-slate-50 border-b py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  📊 DCP / CR / CN 变更进度查询
                </CardTitle>
                <p className="text-xs text-slate-500 mt-1">方便项目组工程师快速查询当前各项变更的发布与法规审批状态</p>
              </div>
              
              {/* Search bar + action buttons inside header */}
              <div className="flex items-center gap-2 w-full sm:max-w-md">
                <Button variant="outline" size="sm" onClick={() => setShowImportModal(true)} className="h-8.5 text-xs flex items-center gap-1.5 shrink-0">
                  <Upload className="h-3.5 w-3.5" />
                  导入
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportCSV} className="h-8.5 text-xs flex items-center gap-1.5 shrink-0">
                  <Download className="h-3.5 w-3.5" />
                  导出
                </Button>
                <div className="relative flex-1">
                  <Input
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                    placeholder="快速查找编号或描述..."
                    className="h-8.5 text-xs pr-8"
                  />
                  {searchKeyword && (
                    <button
                      onClick={() => setSearchKeyword('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {progressLoading ? (
                <div className="text-center py-8 text-muted-foreground text-xs">加载进度中...</div>
              ) : filteredProgress.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">暂无符合条件的变更进度数据</div>
              ) : (
                <div className="space-y-4">
                  {/* 视图切换与批量展开 */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-1 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex bg-slate-200/60 p-0.5 rounded-lg border border-slate-200/20">
                      <button
                        onClick={() => setViewMode('all')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                          viewMode === 'all'
                            ? 'bg-white text-primary shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        📋 所有变更 ({filteredProgress.length})
                      </button>
                      <button
                        onClick={() => setViewMode('project')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                          viewMode === 'project'
                            ? 'bg-white text-primary shadow-sm'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        📂 按项目展示 ({Object.keys(groupedProjects).length})
                      </button>
                    </div>
                    
                    {viewMode === 'project' && (
                      <div className="flex gap-2.5 px-2">
                        <button
                          onClick={expandAll}
                          className="text-[11px] font-bold text-sky-600 hover:text-sky-700 transition"
                        >
                          全部展开
                        </button>
                        <span className="text-slate-300">|</span>
                        <button
                          onClick={collapseAll}
                          className="text-[11px] font-bold text-sky-600 hover:text-sky-700 transition"
                        >
                          全部折叠
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 视图一：所有变更进度表格 */}
                  {viewMode === 'all' && (
                    <div className="space-y-3">
                      <div className="overflow-x-auto rounded-lg border shadow-sm">
                        <table className="w-full text-left border-collapse text-xs md:text-sm">
                          <thead className="bg-slate-50 text-slate-700 border-b">
                            <tr>
                              <th className="px-4 py-3 font-semibold whitespace-nowrap">所属项目</th>
                              <th className="px-4 py-3 font-semibold whitespace-nowrap">CR No.</th>
                              <th className="px-4 py-3 font-semibold whitespace-nowrap">DCP No.</th>
                              <th className="px-4 py-3 font-semibold whitespace-nowrap">CN No.</th>
                              <th className="px-4 py-3 font-semibold whitespace-nowrap">CR进度</th>
                              <th className="px-4 py-3 font-semibold whitespace-nowrap">CN进度</th>
                              <th className="px-4 py-3 font-semibold w-1/4">变更描述</th>
                              <th className="px-4 py-3 font-semibold whitespace-nowrap text-center">是否影响法规</th>
                              <th className="px-4 py-3 font-semibold w-1/4">法规内容</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedProgress.map((record) => (
                              <tr
                                key={record.id}
                                onClick={() => setSelectedProgress(record)}
                                className="border-b hover:bg-slate-100/50 cursor-pointer transition-colors"
                              >
                                <td className="px-4 py-2.5 text-slate-700 font-semibold whitespace-nowrap">
                                  {record.project_code ? (
                                    <span className="bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded text-xs font-medium">
                                      {record.project_name ? `${record.project_code} (${record.project_name})` : record.project_code}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 text-xs">-</span>
                                  )}
                                </td>
                                <td className="px-4 py-2.5 font-bold font-mono text-slate-800 whitespace-nowrap">{record.cr_no || '-'}</td>
                                <td className="px-4 py-2.5 font-bold font-mono text-slate-800 whitespace-nowrap">{record.dcp_no || '-'}</td>
                                <td className="px-4 py-2.5 font-bold font-mono text-slate-800 whitespace-nowrap">{record.cn_no || '-'}</td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getProgressStyle(record.cr_progress || '未发起')}`}>
                                    {record.cr_progress || '未发起'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 whitespace-nowrap">
                                  <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getProgressStyle(record.cn_progress || '未发起')}`}>
                                    {record.cn_progress || '未发起'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate" title={record.change_description}>
                                  {record.change_description || '-'}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    record.affects_regulation
                                      ? 'bg-red-55 text-red-600 border border-red-100'
                                      : 'bg-slate-100 text-slate-600'
                                  }`}>
                                    {record.affects_regulation ? '影响' : '无影响'}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate" title={record.regulation_content}>
                                  {record.regulation_content || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {totalPages > 1 && (
                        <div className="flex items-center justify-between pt-3 border-t border-slate-100 select-none">
                          <span className="text-[11px] text-slate-500 font-medium">共 {filteredProgress.length} 个变更记录</span>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[10px] font-bold"
                              disabled={currentPage <= 1}
                              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            >
                              上一页
                            </Button>
                            <span className="text-xs text-slate-700 font-semibold">{currentPage} / {totalPages}</span>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 px-2 text-[10px] font-bold"
                              disabled={currentPage >= totalPages}
                              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            >
                              下一页
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 视图二：按项目折叠展示 */}
                  {viewMode === 'project' && (
                    <div className="space-y-3">
                      {Object.values(groupedProjects).map((group) => {
                        const isExpanded = !!expandedProjects[group.code];
                        return (
                          <div key={group.code} className="border border-slate-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition duration-250">
                            {/* 页眉 */}
                            <div
                              onClick={() => toggleProject(group.code)}
                              className="px-4 py-3 bg-gradient-to-r from-slate-50/50 to-white cursor-pointer flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 hover:from-slate-50 transition-colors select-none border-b"
                            >
                              <div className="flex items-center gap-2">
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-slate-500 shrink-0" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-500 shrink-0" />
                                )}
                                <div className="flex flex-wrap items-baseline gap-1.5">
                                  <span className="font-bold text-slate-850 text-xs md:text-sm">{group.name}</span>
                                  <span className="text-[10px] font-mono text-slate-400 font-semibold">({group.code})</span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 text-[9px] md:text-[10px] self-end sm:self-auto">
                                <span className="bg-slate-100 text-slate-650 font-bold px-2 py-0.5 rounded-full">
                                  变更数: {group.records.length}
                                </span>
                                {group.stats.completed > 0 && (
                                  <span className="bg-emerald-50 text-emerald-700 font-bold px-2 py-0.5 rounded-full border border-emerald-100">
                                    已完成: {group.stats.completed}
                                  </span>
                                )}
                                {group.stats.progress > 0 && (
                                  <span className="bg-blue-50 text-blue-700 font-bold px-2 py-0.5 rounded-full border border-blue-100">
                                    进行中: {group.stats.progress}
                                  </span>
                                )}
                                {group.stats.pending > 0 && (
                                  <span className="bg-rose-50 text-rose-700 font-bold px-2 py-0.5 rounded-full border border-rose-100">
                                    未发起: {group.stats.pending}
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 展开的变更进度表格 */}
                            {isExpanded && (
                              <div className="overflow-x-auto bg-white">
                                <table className="w-full text-left border-collapse text-xs md:text-sm">
                                  <thead className="bg-slate-50/30 text-slate-500 border-b">
                                    <tr>
                                      <th className="px-4 py-2.5 font-semibold whitespace-nowrap">CR No.</th>
                                      <th className="px-4 py-2.5 font-semibold whitespace-nowrap">DCP No.</th>
                                      <th className="px-4 py-2.5 font-semibold whitespace-nowrap">CN No.</th>
                                      <th className="px-4 py-2.5 font-semibold whitespace-nowrap">CR进度</th>
                                      <th className="px-4 py-2.5 font-semibold whitespace-nowrap">CN进度</th>
                                      <th className="px-4 py-2.5 font-semibold w-1/4">变更描述</th>
                                      <th className="px-4 py-2.5 font-semibold whitespace-nowrap text-center">是否影响法规</th>
                                      <th className="px-4 py-2.5 font-semibold w-1/4">法规内容</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.records.map((record) => (
                                      <tr
                                        key={record.id}
                                        onClick={() => setSelectedProgress(record)}
                                        className="border-b last:border-b-0 hover:bg-slate-100/40 cursor-pointer transition-colors"
                                      >
                                        <td className="px-4 py-2.5 font-bold font-mono text-slate-800 whitespace-nowrap">{record.cr_no || '-'}</td>
                                        <td className="px-4 py-2.5 font-bold font-mono text-slate-800 whitespace-nowrap">{record.dcp_no || '-'}</td>
                                        <td className="px-4 py-2.5 font-bold font-mono text-slate-800 whitespace-nowrap">{record.cn_no || '-'}</td>
                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getProgressStyle(record.cr_progress || '未发起')}`}>
                                            {record.cr_progress || '未发起'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5 whitespace-nowrap">
                                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getProgressStyle(record.cn_progress || '未发起')}`}>
                                            {record.cn_progress || '未发起'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate" title={record.change_description}>
                                          {record.change_description || '-'}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                            record.affects_regulation
                                              ? 'bg-red-50 text-red-600 border border-red-100'
                                              : 'bg-slate-100 text-slate-600'
                                          }`}>
                                            {record.affects_regulation ? '影响' : '无影响'}
                                          </span>
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-600 max-w-[200px] truncate" title={record.regulation_content}>
                                          {record.regulation_content || '-'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {selectedProgress && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-sky-50 via-cyan-50 to-slate-50 border-b border-sky-100 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">📋</span>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">变更详细进度</h3>
                  <p className="text-xs text-slate-500 mt-0.5">查看完整的编号及法规发布状态信息</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProgress(null)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {/* Row 1: CR No, DCP No, CN No */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CR No.</div>
                  <div className="text-sm font-black font-mono text-slate-800 mt-0.5">{selectedProgress.cr_no || '-'}</div>
                </div>
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DCP No.</div>
                  <div className="text-sm font-black font-mono text-slate-800 mt-0.5">{selectedProgress.dcp_no || '-'}</div>
                </div>
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CN No.</div>
                  <div className="text-sm font-black font-mono text-slate-800 mt-0.5">{selectedProgress.cn_no || '-'}</div>
                </div>
              </div>

              {/* Row 2: Project info */}
              <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">所属项目</div>
                  <div className="text-sm font-bold text-slate-800 mt-0.5">
                    {selectedProgress.project_name ? `${selectedProgress.project_code} - ${selectedProgress.project_name}` : (selectedProgress.project_code || '通用项目')}
                  </div>
                </div>
                {selectedProgress.project_code && (
                  <span className="bg-sky-100 text-sky-700 font-bold font-mono px-2 py-0.5 rounded text-xs">
                    {selectedProgress.project_code}
                  </span>
                )}
              </div>

              {/* Row 3: Progress & Regulation statuses */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CR 进度</div>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getProgressStyle(selectedProgress.cr_progress || '未发起')}`}>
                      {selectedProgress.cr_progress || '未发起'}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">CN 进度</div>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getProgressStyle(selectedProgress.cn_progress || '未发起')}`}>
                      {selectedProgress.cn_progress || '未发起'}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">是否影响法规</div>
                  <div className="mt-1">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      selectedProgress.affects_regulation
                        ? 'bg-red-50 text-red-600 border border-red-100'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {selectedProgress.affects_regulation ? '影响法规' : '无影响'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Row 4: Change description */}
              <div className="space-y-1">
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">变更描述</div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-slate-700 text-xs md:text-sm whitespace-pre-wrap leading-relaxed max-h-[150px] overflow-y-auto">
                  {selectedProgress.change_description || '暂无描述信息'}
                </div>
              </div>

              {/* Row 5: Regulation Content (if applicable) */}
              {selectedProgress.affects_regulation === 1 && (
                <div className="space-y-1">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">法规影响内容</div>
                  <div className="bg-red-50/30 p-4 rounded-xl border border-red-100 text-slate-750 text-xs md:text-sm whitespace-pre-wrap leading-relaxed max-h-[150px] overflow-y-auto">
                    {selectedProgress.regulation_content || '未提供具体法规内容'}
                  </div>
                </div>
              )}

              {/* Row 6: Timestamps */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between text-[10px] text-slate-400 pt-3 border-t border-slate-100 gap-1.5 font-medium select-none">
                <span>创建时间: {selectedProgress.created_at ? new Date(selectedProgress.created_at).toLocaleString('zh-CN') : '-'}</span>
                <span>最后更新: {selectedProgress.updated_at ? new Date(selectedProgress.updated_at).toLocaleString('zh-CN') : '-'}</span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t flex justify-end">
              <Button onClick={() => setSelectedProgress(null)} variant="outline" className="h-8.5 font-bold text-xs px-4">
                关闭窗口
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 批量导入模态框 */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
            <div className="px-6 py-5 bg-gradient-to-r from-sky-50 via-cyan-50 to-slate-50 border-b border-sky-100 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-slate-900">批量导入变更进度</h3>
                <p className="text-xs text-slate-500 mt-0.5">支持 Excel (.xlsx/.xls) 与 CSV 文件，按 CR/DCP/CN 编号组合去重</p>
              </div>
              <button
                onClick={handleCloseImportModal}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="outline" onClick={handleDownloadTemplate} className="flex items-center gap-1.5">
                  <FileSpreadsheet className="h-4 w-4" />
                  下载导入模板
                </Button>
                <label className="inline-flex items-center gap-1.5 cursor-pointer rounded-md border border-input bg-background h-9 px-4 text-sm font-medium hover:bg-accent hover:text-accent-foreground">
                  <Upload className="h-4 w-4" />
                  选择文件
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv,.txt"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                {fileInfo && (
                  <span className="text-xs text-slate-600">已加载: <span className="font-medium">{fileInfo}</span> · 共 {importEntries.length} 条</span>
                )}
                {importEntries.length > 0 && (
                  <Button variant="ghost" size="sm" onClick={handleClearImport} className="ml-auto">
                    清空
                  </Button>
                )}
              </div>

              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1">
                <p className="font-semibold text-slate-700">文件格式说明：</p>
                <p>第 1 行为表头（共 9 列）：<span className="font-mono">{TEMPLATE_HEADERS.join(' | ')}</span></p>
                <p>从第 2 行起为数据；"是否影响法规"列填 <span className="font-mono">是</span> 或 <span className="font-mono">否</span>；任一行全空将自动跳过。</p>
                <p>去重维度：CR/DCP/CN 编号三者组合，已存在的记录会跳过。</p>
              </div>

              {importEntries.length > 0 && (
                <div className="overflow-x-auto rounded-lg border max-h-72">
                  <table className="w-full text-xs">
                    <thead className="bg-muted sticky top-0">
                      <tr>
                        {TEMPLATE_HEADERS.map((h, i) => (
                          <th key={i} className="px-3 py-2 text-left font-medium whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {importEntries.slice(0, 200).map((entry, idx) => (
                        <tr key={idx} className="border-b hover:bg-muted/50">
                          <td className="px-3 py-2 whitespace-nowrap">{entry.project_code || ''}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-mono">{entry.cr_no || ''}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-mono">{entry.dcp_no || ''}</td>
                          <td className="px-3 py-2 whitespace-nowrap font-mono">{entry.cn_no || ''}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate" title={entry.change_description}>{entry.change_description || ''}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{entry.affects_regulation ? '是' : '否'}</td>
                          <td className="px-3 py-2 max-w-[200px] truncate" title={entry.regulation_content}>{entry.regulation_content || ''}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{entry.cr_progress || ''}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{entry.cn_progress || ''}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {importEntries.length > 200 && (
                    <div className="text-center text-xs text-slate-500 py-2">仅预览前 200 条，实际将导入 {importEntries.length} 条</div>
                  )}
                </div>
              )}

              {importResult && (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                      <div className="text-xs text-emerald-700 font-semibold uppercase tracking-wider">成功导入</div>
                      <div className="text-2xl font-bold text-emerald-700 mt-1">{importResult.imported.length}</div>
                    </div>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                      <div className="text-xs text-amber-700 font-semibold uppercase tracking-wider">跳过</div>
                      <div className="text-2xl font-bold text-amber-700 mt-1">{importResult.skipped.length}</div>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="text-xs text-red-700 font-semibold uppercase tracking-wider">错误</div>
                      <div className="text-2xl font-bold text-red-700 mt-1">{importResult.errors.length}</div>
                    </div>
                  </div>
                  {importResult.errors.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                      <p className="text-xs font-semibold text-red-800 mb-2">错误详情：</p>
                      <ul className="text-xs text-red-700 space-y-1">
                        {importResult.errors.map((err, idx) => (
                          <li key={idx}>第 {err.line} 行: {err.reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {importResult.skipped.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 max-h-40 overflow-y-auto">
                      <p className="text-xs font-semibold text-amber-800 mb-2">跳过详情：</p>
                      <ul className="text-xs text-amber-700 space-y-1">
                        {importResult.skipped.map((s, idx) => (
                          <li key={idx}>第 {s.line} 行: {s.reason}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 px-6 py-4 border-t bg-slate-50">
              <Button variant="outline" onClick={handleCloseImportModal}>
                关闭
              </Button>
              <Button
                onClick={handleImport}
                loading={importing}
                disabled={importEntries.length === 0}
                className="flex items-center gap-1.5"
              >
                <Upload className="h-4 w-4" />
                开始导入 ({importEntries.length})
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
