import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { TechnicalDocumentForm } from '../components/TechnicalDocumentForm';
import { DifyChatbotEmbed } from '../components/DifyChatbotEmbed';
import { applicationAPI } from '../services';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { formatBeijingTime } from '@/utils/timezone';
import { Download } from 'lucide-react';

interface ApplicationRecord {
  id: number;
  applicant_name: string;
  document_name?: string;
  project_code: string;
  number_type: string;
  full_number: string;
  created_at: string;
}

export function TechnicalDocumentPage() {
  const [records, setRecords] = useState<ApplicationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectKeyword, setProjectKeyword] = useState('');
  const [filterKeyword, setFilterKeyword] = useState('');
  const [pagination, setPagination] = useState({ page: 1, limit: 8, total: 0, totalPages: 1 });
  const [allQtdRecords, setAllQtdRecords] = useState<ApplicationRecord[]>([]);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [folderSearchQuery, setFolderSearchQuery] = useState('');
  const [folderPage, setFolderPage] = useState(1);
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  useEffect(() => {
    setFolderPage(1);
  }, [folderSearchQuery]);

  const loadAllQtdRecords = async () => {
    try {
      const res = await applicationAPI.getAll({ number_type: 'QTD,HISTORICAL', limit: 1000 });
      const responseData = (res as { data: { data: ApplicationRecord[] } }).data;
      setAllQtdRecords(responseData?.data || []);
    } catch (err) {
      console.error('加载历史记录失败', err);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [filterKeyword, pagination.page]);

  useEffect(() => {
    loadAllQtdRecords();
  }, []);

  const handleApplicationSubmitted = () => {
    loadRecords();
    loadAllQtdRecords();
  };

  const loadRecords = async () => {
    setLoading(true);
    try {
      type ApplicationAPIParams = Parameters<typeof applicationAPI.getAll>[0];
      const params: ApplicationAPIParams = { number_type: 'QTD,HISTORICAL', page: pagination.page, limit: pagination.limit };
      if (filterKeyword.trim()) {
        params.project_code = filterKeyword.trim();
      }
      const res = await applicationAPI.getAll(params);
      const responseData = (res as { data: { data: ApplicationRecord[]; pagination: typeof pagination } }).data;
      setRecords(responseData?.data || []);
      setPagination(responseData?.pagination || pagination);
    } catch (err) {
      console.error('加载技术文件记录失败', err);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    setFilterKeyword(projectKeyword.trim());
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleExport = async () => {
    try {
      await applicationAPI.exportCSV();
    } catch (err) {
      console.error('导出失败', err);
    }
  };

  const handleExportProjectRecords = (projectCode: string) => {
    const recordsToExport = projectsWithQtd[projectCode] || [];
    if (recordsToExport.length === 0) return;

    const headers = ['序号', '文档编号', '文档名称'];
    const rows = recordsToExport.map((rec, index) => [
      index + 1,
      rec.full_number,
      rec.document_name || '-'
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const BOM = '\uFEFF';
    const csvBlob = new Blob([BOM + csvContent], { type: 'text/csv; charset=utf-8' });
    const url = window.URL.createObjectURL(csvBlob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `项目_${projectCode}_技术文档清单_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const handleDeleteRecord = async (id: number, fullNumber: string) => {
    if (!confirm(`确定要删除此文档记录 "${fullNumber}" 吗？此操作不可撤销。`)) {
      return;
    }
    try {
      await applicationAPI.delete(id);
      alert('删除成功');
      loadRecords();
      loadAllQtdRecords();
    } catch (err) {
      console.error('删除记录失败', err);
      alert('删除失败，请重试');
    }
  };

  const projectsWithQtd = allQtdRecords.reduce((acc: { [key: string]: ApplicationRecord[] }, record) => {
    const code = record.project_code?.trim();
    if (code) {
      if (!acc[code]) {
        acc[code] = [];
      }
      acc[code].push(record);
    }
    return acc;
  }, {});

  const filteredFolders = Object.keys(projectsWithQtd)
    .filter(projectCode => projectCode.toLowerCase().includes(folderSearchQuery.toLowerCase().trim()))
    .sort();

  const totalFolders = filteredFolders.length;
  const totalFolderPages = Math.ceil(totalFolders / 4) || 1;
  const foldersToDisplay = filteredFolders.slice((folderPage - 1) * 4, folderPage * 4);

  return (
    <Layout>
      <DifyChatbotEmbed />
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">技术文件取号</h1>
          <p className="mt-2 text-slate-600">适用于 DHF / DMR 文件的编号申请</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] min-h-[calc(100vh-7rem)]">
          <div className="min-w-0">
            <TechnicalDocumentForm onApplicationSubmitted={handleApplicationSubmitted} />
          </div>
          <div className="min-w-0">
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>QTD 申请记录</CardTitle>
              
                  </div>
                  {isAdmin && (
                    <Button variant="default" onClick={handleExport}>
                      导出记录
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-4">
                  <div className="flex-1 bg-sky-50/60 border border-sky-100 rounded-xl p-3.5 text-center shadow-sm select-none">
                    <span className="block text-[10px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">总申请 QTD 数量</span>
                    <span className="block text-2xl font-black font-mono text-sky-600">{pagination.total}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">项目代号</label>
                  <div className="flex gap-2">
                    <Input
                      value={projectKeyword}
                      onChange={(e) => setProjectKeyword(e.target.value)}
                      placeholder="输入项目关键字，例如 ALPHA01"
                    />
                    <Button onClick={handleFilterSearch}>
                      查询
                    </Button>
                  </div>
                </div>

                {loading ? (
                  <div className="text-center py-10 text-muted-foreground">加载中...</div>
                ) : (
                  <div className="overflow-x-auto rounded-lg border shadow-sm">
                    <table className="w-full text-left border-collapse">
                      <thead className="bg-muted text-xs md:text-sm">
                        <tr>
                          <th className="px-3.5 py-3 font-semibold whitespace-nowrap">申请人</th>
                          <th className="px-3.5 py-3 font-semibold whitespace-nowrap">文档编号</th>
                          <th className="px-3.5 py-3 font-semibold whitespace-nowrap">文档名称</th>
                          <th className="px-3.5 py-3 font-semibold whitespace-nowrap">申请时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-3.5 py-8 text-center text-muted-foreground text-xs md:text-sm">
                              暂无记录
                            </td>
                          </tr>
                        ) : (
                          records.map(record => (
                            <tr key={record.id} className="border-b hover:bg-muted/50">
                              <td className="px-3.5 py-3 whitespace-nowrap text-xs md:text-sm text-slate-700">{record.applicant_name}</td>
                              <td className="px-3.5 py-3 font-medium whitespace-nowrap text-xs md:text-sm text-slate-800 font-mono">{record.full_number}</td>
                              <td className="px-3.5 py-3 text-xs md:text-sm text-slate-600">
                                <div className="truncate max-w-[120px] sm:max-w-[200px] md:max-w-[320px] lg:max-w-[500px]" title={record.document_name || ''}>
                                  {record.document_name || '-'}
                                </div>
                              </td>
                              <td className="px-3.5 py-3 text-muted-foreground whitespace-nowrap text-xs md:text-sm">{formatBeijingTime(record.created_at)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
                {!loading && records.length > 0 && (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-3 border-t border-slate-200">
                    <div className="text-sm text-slate-600">共 {pagination.total} 条记录</div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={pagination.page <= 1} onClick={() => handlePageChange(pagination.page - 1)}>
                        上一页
                      </Button>
                      <span className="text-sm text-slate-700">第 {pagination.page} / {pagination.totalPages || 1} 页</span>
                      <Button variant="outline" size="sm" disabled={pagination.page >= pagination.totalPages} onClick={() => handlePageChange(pagination.page + 1)}>
                        下一页
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="mt-6 border-2 border-sky-100 shadow-md">
              <CardHeader className="bg-gradient-to-r from-sky-50/50 to-slate-50 border-b border-sky-100/50 py-4">
                <CardTitle className="text-lg font-bold text-slate-800">历史项目文档</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">点击项目文件夹，查看该项目下的全部技术文档。</p>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* Folder search input */}
                {Object.keys(projectsWithQtd).length > 0 && (
                  <div className="relative">
                    <Input
                      value={folderSearchQuery}
                      onChange={(e) => setFolderSearchQuery(e.target.value)}
                      placeholder="搜索项目文件夹代号..."
                      className="pr-8 h-9 text-xs"
                    />
                    {folderSearchQuery && (
                      <button
                        onClick={() => setFolderSearchQuery('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                )}

                {foldersToDisplay.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6 select-none">
                    {folderSearchQuery ? '未搜索到匹配的项目代号' : '暂无历史项目文档'}
                  </p>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-2.5">
                      {foldersToDisplay.map(projectCode => (
                        <button
                          key={projectCode}
                          onClick={() => setSelectedProject(projectCode)}
                          className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200/80 bg-slate-50/50 hover:bg-sky-50/60 hover:border-sky-300 hover:text-sky-700 transition duration-200 text-left group"
                        >
                          <span className="text-xl group-hover:scale-110 transition-transform select-none">📁</span>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-slate-800 group-hover:text-sky-700 text-xs sm:text-sm truncate" title={projectCode}>
                              {projectCode}
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5 font-medium">
                              {projectsWithQtd[projectCode].length} 个文件
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>

                    {totalFolderPages > 1 && (
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                        <span className="text-[11px] text-slate-500">共 {totalFolders} 个项目</span>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            disabled={folderPage <= 1}
                            onClick={() => setFolderPage(prev => Math.max(prev - 1, 1))}
                          >
                            上一页
                          </Button>
                          <span className="text-xs text-slate-700">{folderPage} / {totalFolderPages}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-[10px]"
                            disabled={folderPage >= totalFolderPages}
                            onClick={() => setFolderPage(prev => Math.min(prev + 1, totalFolderPages))}
                          >
                            下一页
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="px-6 py-5 bg-gradient-to-r from-sky-50 via-cyan-50 to-slate-50 border-b border-sky-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📁</span>
                <div>
                  <h3 className="text-xl font-bold text-slate-900">项目 {selectedProject} 文档列表</h3>
                  <p className="text-xs text-slate-500 mt-0.5">该项目下共计 {projectsWithQtd[selectedProject]?.length || 0} 个技术文档</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedProject(null)}
                className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
                title="关闭"
              >
                ✕
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              <div className="overflow-x-auto rounded-lg border border-slate-200 shadow-sm">
                <table className="w-full text-left border-collapse">
                  <thead className="bg-slate-50 text-xs text-slate-600 border-b">
                    <tr>
                      <th className="px-4 py-3 font-semibold w-16 text-center">序号</th>
                      <th className="px-4 py-3 font-semibold w-1/3">文档编号</th>
                      <th className="px-4 py-3 font-semibold">文档名称</th>
                      {isAdmin && <th className="px-4 py-3 font-semibold w-24 text-center">操作</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {projectsWithQtd[selectedProject]?.map((record, index) => (
                      <tr key={record.id} className="border-b hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-xs md:text-sm text-center text-slate-500 font-mono">{index + 1}</td>
                        <td className="px-4 py-3 text-xs md:text-sm font-semibold font-mono text-slate-800 select-all">{record.full_number}</td>
                        <td className="px-4 py-3 text-xs md:text-sm text-slate-600">{record.document_name || '-'}</td>
                        {isAdmin && (
                          <td className="px-4 py-2 text-center whitespace-nowrap">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 px-2.5 text-[11px] bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white"
                              onClick={() => handleDeleteRecord(record.id, record.full_number)}
                            >
                              删除
                            </Button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-between items-center">
              <Button
                onClick={() => handleExportProjectRecords(selectedProject)}
                className="flex items-center gap-1.5 bg-sky-600 hover:bg-sky-700 text-white shadow-sm"
              >
                <Download className="h-4 w-4" />
                导出此项目文件清单
              </Button>
              <Button onClick={() => setSelectedProject(null)} variant="outline">
                关闭
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
