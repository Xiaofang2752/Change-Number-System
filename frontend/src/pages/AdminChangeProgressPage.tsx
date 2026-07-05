import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { changeProgressAPI, projectAPI } from '../services';
import type { ChangeProgress, Project } from '../services';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Trash2, Edit, Plus, X, Search, Upload, Download, FileSpreadsheet } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportError {
  line: number | string;
  reason: string;
}

interface ImportResult {
  imported: { line: number; cr_no: string; dcp_no: string; cn_no: string }[];
  skipped: { line: number; reason: string }[];
  errors: ImportError[];
}

// 模板列定义（顺序即 Excel 列顺序）
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

export function AdminChangeProgressPage() {
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [list, setList] = useState<ChangeProgress[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ChangeProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 导入相关状态
  const [importEntries, setImportEntries] = useState<Partial<ChangeProgress>[]>([]);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [fileInfo, setFileInfo] = useState<string | null>(null);

  // 表单状态
  const [form, setForm] = useState({
    project_code: '',
    cr_no: '',
    dcp_no: '',
    cn_no: '',
    change_description: '',
    affects_regulation: 0,
    regulation_content: '',
    cr_progress: '',
    cn_progress: ''
  });

  useEffect(() => {
    if (localStorage.getItem('isAdmin') !== 'true') {
      navigate('/admin/login');
      return;
    }
    loadData();
    loadProjects();
  }, [navigate]);

  const loadProjects = async () => {
    try {
      const res = await projectAPI.getAll('approved');
      setProjects((res as { data: Project[] }).data || []);
    } catch (err) {
      console.error('加载项目列表失败', err);
    }
  };

  const loadData = async (keyword?: string) => {
    setLoading(true);
    try {
      const res = await changeProgressAPI.getAll(keyword);
      setList((res as { data: ChangeProgress[] }).data || []);
    } catch (err) {
      console.error('加载变更进度失败', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    loadData(searchQuery.trim());
  };

  const handleOpenCreate = () => {
    setForm({
      project_code: '',
      cr_no: '',
      dcp_no: '',
      cn_no: '',
      change_description: '',
      affects_regulation: 0,
      regulation_content: '',
      cr_progress: '',
      cn_progress: ''
    });
    setEditingRecord(null);
    setError(null);
    setShowCreateModal(true);
  };

  const handleOpenEdit = (record: ChangeProgress) => {
    setEditingRecord(record);
    setForm({
      project_code: record.project_code || '',
      cr_no: record.cr_no || '',
      dcp_no: record.dcp_no || '',
      cn_no: record.cn_no || '',
      change_description: record.change_description || '',
      affects_regulation: record.affects_regulation || 0,
      regulation_content: record.regulation_content || '',
      cr_progress: record.cr_progress || '',
      cn_progress: record.cn_progress || ''
    });
    setError(null);
    setShowCreateModal(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此进度记录吗？此操作不可撤销。')) return;
    try {
      await changeProgressAPI.delete(id);
      loadData(searchQuery.trim());
    } catch (err) {
      console.error('删除失败', err);
      alert('删除失败，请重试');
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setProcessing(true);
    setError(null);

    try {
      if (editingRecord) {
        await changeProgressAPI.update(editingRecord.id, form);
      } else {
        await changeProgressAPI.create(form);
      }
      setShowCreateModal(false);
      loadData(searchQuery.trim());
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '保存失败');
    } finally {
      setProcessing(false);
    }
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
    return 'bg-slate-50 text-slate-600 border-slate-200';
  };

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
          // CSV/TXT: 按行读取，支持英文/中文逗号分隔
          const text = String(content);
          rows = text.split(/\r?\n/).filter(l => l.trim()).map(l => {
            // 简易 CSV 解析：支持逗号分隔
            return l.split(/,|，/).map(c => c.trim());
          });
        } else {
          // Excel: 用 xlsx 解析
          const wb = XLSX.read(content, { type: 'array' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' });
        }
        // 跳过表头行
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
    // 清空 input 以便重复上传同一文件
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
      // 导入完成后刷新列表
      loadData(searchQuery.trim());
    } catch (err: unknown) {
      const errorInfo = err as { response?: { data?: { message?: string } }; message?: string };
      alert(errorInfo.response?.data?.message || errorInfo.message || '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleExportCSV = async () => {
    try {
      await changeProgressAPI.exportCSV(searchQuery.trim() || undefined);
    } catch (err) {
      console.error('导出失败', err);
      alert('导出失败，请重试');
    }
  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    handleClearImport();
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">变更完成进度管理</h2>
            <p className="text-sm text-muted-foreground mt-1">创建和维护前台展示的 DCP、CR、CN 进度卡片</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleOpenCreate} className="flex items-center gap-1.5 shadow-sm">
              <Plus className="h-4 w-4" />
              新增进度记录
            </Button>
            <Button variant="outline" onClick={() => setShowImportModal(true)} className="flex items-center gap-1.5">
              <Upload className="h-4 w-4" />
              批量导入
            </Button>
            <Button variant="outline" onClick={handleExportCSV} className="flex items-center gap-1.5">
              <Download className="h-4 w-4" />
              导出 CSV
            </Button>
          </div>
        </div>

        {/* 搜索栏 */}
        <div className="flex gap-3 max-w-md">
          <div className="relative flex-1">
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索 CR / DCP / CN 编号或描述..."
              className="pr-8"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            {searchQuery && (
              <button
                onClick={() => { setSearchQuery(''); loadData(); }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Button onClick={handleSearch} variant="secondary" className="flex items-center gap-1.5">
            <Search className="h-4 w-4" />
            搜索
          </Button>
        </div>

        {/* 列表显示 */}
        <Card className="shadow-md">
          <CardHeader className="py-4 border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">进度记录清单</CardTitle>
              <Badge variant="secondary" className="font-mono">{list.length} 条数据</Badge>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">加载中...</div>
            ) : list.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">暂无进度数据记录</div>
            ) : (
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-left text-sm border-collapse">
                  <thead className="bg-slate-50 text-slate-700 border-b">
                    <tr>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">所属项目</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">CR No.</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">DCP No.</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">CN No.</th>
                      <th className="px-4 py-3 font-semibold w-1/4">变更描述</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap text-center">影响法规</th>
                      <th className="px-4 py-3 font-semibold w-1/4">法规内容</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">CR进度</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap">CN进度</th>
                      <th className="px-4 py-3 font-semibold whitespace-nowrap text-center">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((record) => (
                      <tr key={record.id} className="border-b hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-slate-700 font-semibold whitespace-nowrap">
                          {record.project_code ? (
                            <span className="bg-sky-50 text-sky-700 border border-sky-100 px-2 py-0.5 rounded text-xs">
                              {record.project_name ? `${record.project_code} (${record.project_name})` : record.project_code}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-xs">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium font-mono text-slate-900 whitespace-nowrap">{record.cr_no || '-'}</td>
                        <td className="px-4 py-3 font-medium font-mono text-slate-900 whitespace-nowrap">{record.dcp_no || '-'}</td>
                        <td className="px-4 py-3 font-medium font-mono text-slate-900 whitespace-nowrap">{record.cn_no || '-'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          <div className="line-clamp-2 max-w-[200px]" title={record.change_description}>
                            {record.change_description || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant={record.affects_regulation ? 'destructive' : 'secondary'}>
                            {record.affects_regulation ? '是' : '否'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          <div className="line-clamp-2 max-w-[200px]" title={record.regulation_content}>
                            {record.regulation_content || '-'}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getProgressStyle(record.cr_progress || '未发起')}`}>
                            {record.cr_progress || '未发起'}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-semibold border ${getProgressStyle(record.cn_progress || '未发起')}`}>
                            {record.cn_progress || '未发起'}
                          </span>
                        </td>
                        <td className="px-4 py-3 space-x-2 text-center whitespace-nowrap">
                          <Button variant="outline" size="sm" onClick={() => handleOpenEdit(record)} className="h-8 px-2">
                            <Edit className="h-3.5 w-3.5 mr-1" />
                            编辑
                          </Button>
                          <Button variant="destructive" size="sm" onClick={() => handleDelete(record.id)} className="h-8 px-2">
                            <Trash2 className="h-3.5 w-3.5 mr-1" />
                            删除
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* 新增/编辑模态框 */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="px-6 py-5 bg-gradient-to-r from-sky-50 via-cyan-50 to-slate-50 border-b border-sky-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {editingRecord ? '编辑进度记录' : '新增进度记录'}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">请填写 DCP/CR/CN 项目完成状态及法规影响评估信息</p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
                    {error}
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">所属项目</label>
                  <select
                    value={form.project_code}
                    onChange={(e) => setForm(prev => ({ ...prev, project_code: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                  >
                    <option value="">-- 无特定项目 / 通用 --</option>
                    {projects.map(proj => (
                      <option key={proj.id} value={proj.code}>
                        {proj.name ? `${proj.code} (${proj.name})` : proj.code}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">CR No. (CR编号)</label>
                    <Input
                      value={form.cr_no}
                      onChange={(e) => setForm(prev => ({ ...prev, cr_no: e.target.value }))}
                      placeholder="如：CR-2026-001"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">DCP No. (DCP编号)</label>
                    <Input
                      value={form.dcp_no}
                      onChange={(e) => setForm(prev => ({ ...prev, dcp_no: e.target.value }))}
                      placeholder="如：DCP-2026-001"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">CN No. (CN编号)</label>
                    <Input
                      value={form.cn_no}
                      onChange={(e) => setForm(prev => ({ ...prev, cn_no: e.target.value }))}
                      placeholder="如：CN-2026-001"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">变更描述</label>
                  <Textarea
                    value={form.change_description}
                    onChange={(e) => setForm(prev => ({ ...prev, change_description: e.target.value }))}
                    placeholder="请输入简短的变更内容描述..."
                    rows={2}
                  />
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">是否影响法规</label>
                    <select
                      value={form.affects_regulation}
                      onChange={(e) => setForm(prev => ({ ...prev, affects_regulation: Number(e.target.value) }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value={0}>否</option>
                      <option value={1}>是</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">CR 进度</label>
                    <Input
                      value={form.cr_progress}
                      onChange={(e) => setForm(prev => ({ ...prev, cr_progress: e.target.value }))}
                      placeholder="如：已发布 / 审核中"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">CN 进度</label>
                    <Input
                      value={form.cn_progress}
                      onChange={(e) => setForm(prev => ({ ...prev, cn_progress: e.target.value }))}
                      placeholder="如：正在起草 / 已归档"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">法规内容</label>
                  <Textarea
                    value={form.regulation_content}
                    onChange={(e) => setForm(prev => ({ ...prev, regulation_content: e.target.value }))}
                    placeholder="如果影响法规，请输入相关影响国家或注册法规内容..."
                    rows={2}
                    disabled={!form.affects_regulation}
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button type="button" variant="outline" onClick={() => setShowCreateModal(false)}>
                    取消
                  </Button>
                  <Button type="submit" loading={processing}>
                    确认保存
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* 批量导入模态框 */}
        {showImportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="relative w-full max-w-4xl bg-white border border-slate-200 rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="px-6 py-5 bg-gradient-to-r from-emerald-50 via-teal-50 to-slate-50 border-b border-emerald-100 flex items-center justify-between">
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
                {/* 操作区 */}
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

                {/* 模板说明 */}
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600 space-y-1">
                  <p className="font-semibold text-slate-700">文件格式说明：</p>
                  <p>第 1 行为表头（共 9 列）：<span className="font-mono">{TEMPLATE_HEADERS.join(' | ')}</span></p>
                  <p>从第 2 行起为数据；"是否影响法规"列填 <span className="font-mono">是</span> 或 <span className="font-mono">否</span>；任一行全空将自动跳过。</p>
                  <p>去重维度：CR/DCP/CN 编号三者组合，已存在的记录会跳过。</p>
                </div>

                {/* 预览表格 */}
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

                {/* 导入结果 */}
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

              {/* Footer */}
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
      </div>
    </Layout>
  );
}
