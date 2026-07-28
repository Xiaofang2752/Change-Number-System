import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { technicalDocumentAPI, projectAPI, applicationAPI, adminAPI } from '../services';
import type { TechnicalDocumentKeyword, Project, Application } from '../services';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { formatBeijingTime } from '@/utils/timezone';
import { Upload, FileSpreadsheet, Trash2, HelpCircle, Download, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

interface ImportError {
  line: number | string;
  reason: string;
}

interface ImportResult {
  imported: string[];
  skipped: string[];
  errors: ImportError[];
}

type AdminTechTab = 'qtd' | 'historical' | 'management';

// 技术文件类别选项（与 DB 中 category 字段值一致，BOM 展开为 3 个子类型）
const CATEGORY_OPTIONS: { value: string; label: string }[] = [
  { value: 'PRODUCT_TECH', label: '产品技术文件' },
  { value: 'GENERAL_TECH', label: '通用技术' },
  { value: 'DHF', label: 'DHF' },
  { value: 'SOP', label: 'SOP' },
  { value: 'PROGRAM', label: '程序' },
  { value: 'BOM_ASSE', label: 'BOM/仪器模块' },
  { value: 'BOM_PCBA', label: 'BOM/PCBA' },
  { value: 'BOM_SOFT', label: 'BOM/软件清单' },
  { value: 'OTHER_DRAWING', label: '其他图纸' },
  { value: 'RECORD_FORM', label: '记录表单' },
];

function getCategoryLabel(category?: string | null): string {
  if (!category) return '-';
  return CATEGORY_OPTIONS.find(o => o.value === category)?.label || category;
}

interface AppFilters {
  keyword: string;
  applicant_name: string;
  project_code: string;
  category: string;
}

interface ApplicationRecord extends Application {
  category?: string;
  sub_category?: string;
}

export function AdminTechnicalDocumentPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [activeTab, setActiveTab] = useState<AdminTechTab>(
    (searchParams.get('tab') as AdminTechTab) || 'qtd'
  );

  // 关键字/项目管理状态
  const [keywords, setKeywords] = useState<TechnicalDocumentKeyword[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectCode, setSelectedProjectCode] = useState('');
  const [importerName, setImporterName] = useState('');
  const [mgmtLoading, setMgmtLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newKeyword, setNewKeyword] = useState({ keyword: '', description: '' });
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [editKeyword, setEditKeyword] = useState<TechnicalDocumentKeyword | null>(null);
  const [editForm, setEditForm] = useState({ keyword: '', description: '' });
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileInfo, setFileInfo] = useState<string | null>(null);

  // 申请记录状态
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [appLoading, setAppLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 15, total: 0, totalPages: 1 });
  const [filters, setFilters] = useState<AppFilters>({
    keyword: searchParams.get('keyword') || '',
    applicant_name: searchParams.get('applicant_name') || '',
    project_code: searchParams.get('project_code') || '',
    category: searchParams.get('category') || '',
  });
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    if (localStorage.getItem('isAdmin') !== 'true') {
      navigate('/admin/login');
      return;
    }
    loadKeywords();
    loadProjects();
  }, [navigate]);

  useEffect(() => {
    if (activeTab === 'qtd' || activeTab === 'historical') {
      loadApplications();
    }
  }, [activeTab, pagination.page, filters]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    if (filters.keyword) params.set('keyword', filters.keyword);
    if (filters.applicant_name) params.set('applicant_name', filters.applicant_name);
    if (filters.project_code) params.set('project_code', filters.project_code);
    if (filters.category) params.set('category', filters.category);
    params.set('page', String(pagination.page));
    setSearchParams(params);
  }, [activeTab, filters, pagination.page, setSearchParams]);

  const loadKeywords = async () => {
    setMgmtLoading(true);
    try {
      const res = await technicalDocumentAPI.getKeywords();
      setKeywords((res as { data: TechnicalDocumentKeyword[] }).data || []);
    } catch (err) {
      console.error('加载关键字失败', err);
    } finally {
      setMgmtLoading(false);
    }
  };

  const loadProjects = async () => {
    try {
      const res = await projectAPI.getAll('approved');
      setProjects((res as { data: Project[] }).data || []);
    } catch (err) {
      console.error('加载项目代号失败', err);
    }
  };

  const loadApplications = useCallback(async () => {
    setAppLoading(true);
    try {
      type ApplicationAPIParams = Parameters<typeof applicationAPI.getAll>[0];
      const params: ApplicationAPIParams = {
        number_type: activeTab === 'qtd' ? 'QTD,DHF,SOP,SOFT,BOM,DRW' : 'HISTORICAL',
        page: pagination.page,
        limit: pagination.limit,
      };
      if (filters.keyword.trim()) params.keyword = filters.keyword.trim();
      if (filters.applicant_name.trim()) params.applicant_name = filters.applicant_name.trim();
      if (filters.project_code.trim()) params.project_code = filters.project_code.trim();
      if (filters.category.trim()) params.category = filters.category.trim();

      const res = await applicationAPI.getAll(params);
      const data = (res as { data: { data: ApplicationRecord[]; pagination: typeof pagination } }).data;
      setApplications(data?.data || []);
      setPagination(data?.pagination || pagination);
    } catch (err) {
      console.error('加载申请记录失败', err);
      setApplications([]);
    } finally {
      setAppLoading(false);
    }
  }, [activeTab, filters, pagination.page, pagination.limit]);

  const handleTabChange = (tab: AdminTechTab) => {
    setActiveTab(tab);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleFilterChange = (key: keyof AppFilters, value: string) => {
    setPagination(prev => ({ ...prev, page: 1 }));
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > pagination.totalPages) return;
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleDeleteApplication = async (id: number, fullNumber: string) => {
    if (!confirm(`确定要删除文档记录 "${fullNumber}" 吗？此操作不可撤销。`)) return;
    setDeletingId(id);
    try {
      await adminAPI.deleteApplication(id);
      loadApplications();
    } catch (err) {
      console.error('删除申请记录失败', err);
      alert('删除失败，请重试');
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async () => {
    if (!newKeyword.keyword.trim()) return;
    setProcessingId(0);
    try {
      await technicalDocumentAPI.createKeyword({
        keyword: newKeyword.keyword.trim(),
        description: newKeyword.description.trim(),
      });
      setNewKeyword({ keyword: '', description: '' });
      setShowCreateForm(false);
      loadKeywords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '创建失败');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteKeyword = async (id: number) => {
    if (!confirm('确定要删除此关键字吗？')) return;
    setProcessingId(id);
    try {
      await technicalDocumentAPI.deleteKeyword(id);
      loadKeywords();
    } catch (err) {
      console.error('删除失败', err);
    } finally {
      setProcessingId(null);
    }
  };

  const handleEditClick = (keyword: TechnicalDocumentKeyword) => {
    setEditKeyword(keyword);
    setEditForm({ keyword: keyword.keyword, description: keyword.description || '' });
    setError(null);
  };

  const handleEditSave = async () => {
    if (!editKeyword || !editForm.keyword.trim()) return;
    setProcessingId(editKeyword.id);
    setError(null);
    try {
      await technicalDocumentAPI.updateKeyword(editKeyword.id, {
        keyword: editForm.keyword.trim(),
        description: editForm.description.trim(),
      });
      setEditKeyword(null);
      loadKeywords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setProcessingId(null);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    setFileInfo(`已选择文件: ${file.name} (${(file.size / 1024).toFixed(1)} KB)`);
    setError(null);

    if (fileExtension === 'csv' || fileExtension === 'txt') {
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        setImportText(text);
      };
      reader.readAsText(file);
    } else if (fileExtension === 'xlsx' || fileExtension === 'xls') {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          const jsonData = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(worksheet, {
            header: 1,
          });

          const lines = jsonData
            .map((row) => {
              if (!Array.isArray(row)) return '';
              const code = String(row[0] ?? '').trim();
              const name = String(row[1] ?? '').trim();
              if (!code) return '';
              return name ? `${code},${name}` : code;
            })
            .filter(Boolean)
            .join('\n');

          setImportText(lines);
        } catch (err) {
          setError('解析 Excel 文件出错');
          console.error(err);
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      setError('不支持的文件格式，仅支持 .xlsx, .xls, .csv, .txt');
      setFileInfo(null);
    }
    e.target.value = '';
  };

  const handleClearImport = () => {
    setImportText('');
    setFileInfo(null);
    setError(null);
    setImportResult(null);
  };

  const handleDownloadTemplate = () => {
    const worksheetData = [
      ['文档编号', '文档名称'],
      ['QTD-ALPHA01-0001', '产品需求规格说明书'],
      ['HISTORICAL-001', '技术参考手册'],
      ['DHF-ODBC-M4-1004-02', 'VITROS 450 Software Verification Test Plan: V1.1.0.011']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(worksheetData);
    worksheet['!cols'] = [
      { wch: 25 },
      { wch: 45 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, '历史编号导入模板');

    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const data = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(data);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', '历史文档编号导入模板.xlsx');
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleImport = async () => {
    const entries = importText
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    if (!selectedProjectCode) {
      setError('请先选择项目代号');
      return;
    }

    if (!importerName.trim()) {
      setError('请输入导入人姓名');
      return;
    }

    if (entries.length === 0) {
      setError('请输入要导入的历史编号列表');
      return;
    }

    setImporting(true);
    setError(null);
    setImportResult(null);

    try {
      const res = await technicalDocumentAPI.import({
        entries,
        applicant_name: importerName.trim(),
        project_code: selectedProjectCode,
      });
      setImportResult((res as { data: ImportResult }).data);
      setImportText('');
      setFileInfo(null);
      loadKeywords();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const renderApplicationsTable = () => {
    if (appLoading) {
      return <div className="text-center py-10 text-muted-foreground">加载中...</div>;
    }
    if (applications.length === 0) {
      return <div className="text-center py-10 text-muted-foreground">暂无记录</div>;
    }
    return (
      <>
        <div className="overflow-x-auto rounded-md border mb-6">
          <table className="w-full text-sm">
            <thead className="bg-muted">
              <tr>
                <th className="h-12 px-4 text-left font-medium whitespace-nowrap">完整编号</th>
                <th className="h-12 px-4 text-left font-medium whitespace-nowrap">文件类别</th>
                <th className="h-12 px-4 text-left font-medium whitespace-nowrap">申请人</th>
                <th className="h-12 px-4 text-left font-medium whitespace-nowrap">项目代号</th>
                <th className="h-12 px-4 text-left font-medium whitespace-nowrap">文档名称</th>
                <th className="h-12 px-4 text-left font-medium whitespace-nowrap">申请时间</th>
                <th className="h-12 px-4 text-left font-medium whitespace-nowrap">IP 地址</th>
                <th className="h-12 px-4 text-left font-medium whitespace-nowrap text-center">操作</th>
              </tr>
            </thead>
            <tbody>
              {applications.map(app => (
                <tr key={app.id} className="border-b hover:bg-muted/50 transition-colors">
                  <td className="p-4 whitespace-nowrap">
                    <Badge variant="default">{app.full_number}</Badge>
                  </td>
                  <td className="p-4 whitespace-nowrap text-sm">{getCategoryLabel(app.category)}</td>
                  <td className="p-4 whitespace-nowrap">{app.applicant_name}</td>
                  <td className="p-4 whitespace-nowrap">{app.project_code}</td>
                  <td className="p-4 whitespace-nowrap">{app.document_name || '-'}</td>
                  <td className="p-4 text-muted-foreground whitespace-nowrap">
                    {formatBeijingTime(app.created_at)}
                  </td>
                  <td className="p-4 text-muted-foreground whitespace-nowrap">{app.ip_address || '-'}</td>
                  <td className="p-4 whitespace-nowrap text-center">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteApplication(app.id, app.full_number)}
                      loading={deletingId === app.id}
                      className="gap-1 h-8 px-2.5 text-[11px] bg-red-50 text-red-600 border border-red-100 hover:bg-red-600 hover:text-white"
                    >
                      <Trash2 className="h-3 w-3" />
                      删除
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-center items-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page <= 1}
            onClick={() => handlePageChange(pagination.page - 1)}
          >
            上一页
          </Button>
          <span className="text-muted-foreground">
            {pagination.page} / {pagination.totalPages || 1} (共 {pagination.total} 条)
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => handlePageChange(pagination.page + 1)}
          >
            下一页
          </Button>
        </div>
      </>
    );
  };

  const renderRecordsTab = () => (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <CardTitle>
            {activeTab === 'qtd' ? '技术文件申请记录' : '历史文档导入记录'}
          </CardTitle>
          <Badge variant="secondary">{pagination.total} 条</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 p-4 rounded-lg border border-blue-200/50 mb-6 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Input
              placeholder="搜索完整编号 / 文档名称"
              value={filters.keyword}
              onChange={(e) => handleFilterChange('keyword', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Input
              placeholder="申请人姓名"
              value={filters.applicant_name}
              onChange={(e) => handleFilterChange('applicant_name', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <Input
              placeholder="项目代号"
              value={filters.project_code}
              onChange={(e) => handleFilterChange('project_code', e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <select
              value={filters.category}
              onChange={(e) => handleFilterChange('category', e.target.value)}
              className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">全部类别</option>
              {CATEGORY_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSearch} variant="secondary" className="flex items-center gap-1.5">
              <Search className="h-4 w-4" />
              查询
            </Button>
          </div>
        </div>
        {renderApplicationsTable()}
      </CardContent>
    </Card>
  );

  if (mgmtLoading && activeTab === 'management') {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">加载中...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">技术文件管理</h2>
            <p className="mt-2 text-sm text-muted-foreground">管理技术文件申请记录（DHF/SOP/BOM/程序/产品技术文件/通用技术/其他图纸）、历史文档导入记录、关键字及批量导入。</p>
          </div>
        </div>

        {/* 标签页 */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-sm w-fit">
          {[
            { key: 'qtd', label: '技术文件申请记录' },
            { key: 'historical', label: '历史文档记录' },
            { key: 'management', label: '关键字/导入管理' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key as AdminTechTab)}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 select-none ${
                activeTab === tab.key
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {(activeTab === 'qtd' || activeTab === 'historical') && renderRecordsTab()}

        {activeTab === 'management' && (
          <>
            {showCreateForm && (
              <Card>
                <CardHeader>
                  <CardTitle>创建新关键字/项目代号</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Input
                      placeholder="请输入关键字 or 项目代号"
                      value={newKeyword.keyword}
                      onChange={(e) => setNewKeyword(prev => ({ ...prev, keyword: e.target.value }))}
                    />
                    <Textarea
                      placeholder="描述（可选）"
                      value={newKeyword.description}
                      onChange={(e) => setNewKeyword(prev => ({ ...prev, description: e.target.value }))}
                      rows={2}
                    />
                  </div>
                  <Button loading={processingId === 0} onClick={handleCreate}>保存关键字</Button>
                </CardContent>
              </Card>
            )}

            {editKeyword && (
              <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-semibold">编辑关键字</h3>
                      <p className="text-sm text-muted-foreground">修改关键字或描述。</p>
                    </div>
                    <Button variant="outline" onClick={() => setEditKeyword(null)}>关闭</Button>
                  </div>
                  <div className="space-y-4">
                    <Input
                      placeholder="关键字"
                      value={editForm.keyword}
                      onChange={(e) => setEditForm(prev => ({ ...prev, keyword: e.target.value }))}
                    />
                    <Textarea
                      placeholder="描述"
                      value={editForm.description}
                      onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                    />
                    <div className="flex justify-end gap-3">
                      <Button variant="outline" onClick={() => setEditKeyword(null)}>取消</Button>
                      <Button loading={processingId === editKeyword.id} onClick={handleEditSave}>保存</Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <Button onClick={() => setShowCreateForm(prev => !prev)}>
                {showCreateForm ? '取消新建' : '新建关键字/项目代号'}
              </Button>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <CardTitle>关键字列表</CardTitle>
                  <Badge variant="secondary">{keywords.length} 条</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-muted">
                      <tr>
                        <th className="px-4 py-3">关键字</th>
                        <th className="px-4 py-3">描述</th>
                        <th className="px-4 py-3">状态</th>
                        <th className="px-4 py-3">创建时间</th>
                        <th className="px-4 py-3">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {keywords.map((keyword) => (
                        <tr key={keyword.id} className="border-b hover:bg-muted/50">
                          <td className="px-4 py-3 font-medium">{keyword.keyword}</td>
                          <td className="px-4 py-3 text-muted-foreground">{keyword.description || '-'}</td>
                          <td className="px-4 py-3">
                            <Badge variant={keyword.status === 'approved' ? 'default' : keyword.status === 'pending' ? 'secondary' : 'destructive'}>
                              {keyword.status === 'approved' ? '已通过' : keyword.status === 'pending' ? '待审核' : '已拒绝'}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{new Date(keyword.created_at).toLocaleString('zh-CN')}</td>
                          <td className="px-4 py-3 space-x-2">
                            <Button variant="outline" size="sm" onClick={() => handleEditClick(keyword)}>
                              编辑
                            </Button>
                            <Button variant="destructive" size="sm" loading={processingId === keyword.id} onClick={() => handleDeleteKeyword(keyword.id)}>
                              删除
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-sky-200 shadow-md">
              <CardHeader className="bg-gradient-to-r from-sky-50/50 to-slate-50 border-b py-4">
                <CardTitle className="text-lg font-bold text-slate-800 flex items-center gap-2">
                  📥 导入历史文档编号
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-5 space-y-5">
                <p className="text-sm text-slate-600">
                  您可以先选择项目代号与输入导入人，再通过<strong>上传 Excel 文件</strong>或<strong>直接输入文本</strong>进行批量数据导入。
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold flex items-center gap-1.5">
                      <span>项目代号</span>
                      <span className="text-destructive">*</span>
                    </label>
                    <select
                      value={selectedProjectCode}
                      onChange={(e) => setSelectedProjectCode(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
                    >
                      <option value="">请选择项目代号</option>
                      {projects.map((project) => (
                        <option key={project.id} value={project.code}>{project.code} {project.name ? `- ${project.name}` : ''}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-semibold flex items-center gap-1.5">
                      <span>导入人姓名</span>
                      <span className="text-destructive">*</span>
                    </label>
                    <Input
                      value={importerName}
                      onChange={(e) => setImporterName(e.target.value)}
                      placeholder="请输入导入人姓名"
                      className="border-2 focus:border-sky-400"
                    />
                  </div>
                </div>

                {/* Excel / File Upload Area */}
                <div className="grid gap-4 md:grid-cols-2">
                  {/* Dropzone */}
                  <div className="border-2 border-dashed border-sky-200 hover:border-sky-400 hover:bg-sky-50/20 rounded-2xl p-6 transition-all duration-200 text-center relative group cursor-pointer flex flex-col justify-center min-h-[160px]">
                    <input
                      type="file"
                      accept=".xlsx,.xls,.csv,.txt"
                      onChange={handleFileUpload}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                    />
                    <div className="flex flex-col items-center gap-2">
                      <div className="w-10 h-10 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 group-hover:scale-110 transition-transform">
                        <Upload className="h-5 w-5" />
                      </div>
                      <div className="text-sm font-semibold text-slate-800">
                        点击或拖拽上传 Excel / CSV
                      </div>
                      <div className="text-[11px] text-slate-500">
                        支持 .xlsx, .xls, .csv, .txt
                      </div>
                    </div>
                  </div>

                  {/* Template Help */}
                  <div className="bg-sky-50/50 border border-sky-100 rounded-xl p-4 text-xs text-slate-700 space-y-2 flex flex-col justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="font-semibold flex items-center gap-1.5 text-sky-800">
                          <HelpCircle className="h-4 w-4" />
                          Excel 模板说明
                        </div>
                        <button
                          type="button"
                          onClick={handleDownloadTemplate}
                          className="text-sky-600 hover:text-sky-700 hover:underline flex items-center gap-1.5 font-semibold text-xs transition duration-200 select-none bg-sky-100/60 border border-sky-200/60 rounded-md px-2 py-1"
                        >
                          <Download className="h-3 w-3" />
                          下载 Excel 模板
                        </button>
                      </div>
                      <p className="mt-1">Excel 工作表的第一列应为<strong>文档编号</strong>，第二列为<strong>文档名称</strong>（可选）。例如：</p>
                    </div>
                    <div className="overflow-x-auto rounded-lg border bg-white shadow-sm">
                      <table className="w-full text-left border-collapse text-[10px]">
                        <thead>
                          <tr className="bg-slate-50 border-b">
                            <th className="px-2 py-1 font-semibold border-r">A 列 (文档编号)</th>
                            <th className="px-2 py-1 font-semibold">B 列 (文档名称)</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr className="border-b">
                            <td className="px-2 py-0.5 border-r font-mono">QTD-ALPHA-0001</td>
                            <td className="px-2 py-0.5">产品需求规格书</td>
                          </tr>
                          <tr>
                            <td className="px-2 py-0.5 border-r font-mono">HISTORICAL-001</td>
                            <td className="px-2 py-0.5 text-muted-foreground">- (为空则不填)</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* File Info Indicator */}
                {fileInfo && (
                  <div className="flex items-center justify-between bg-sky-50/80 border border-sky-100 rounded-lg px-4 py-2 text-xs text-sky-800 font-medium animate-in fade-in duration-200">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4 text-sky-600" />
                      <span>{fileInfo}</span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearImport}
                      className="h-7 px-2 hover:bg-sky-100 hover:text-sky-900 text-slate-600"
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      清除
                    </Button>
                  </div>
                )}

                {/* Edit preview Area */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-semibold flex items-center gap-1.5 text-slate-800">
                      <span>📄 预览与手动编辑区</span>
                      <span className="text-xs text-slate-400 font-normal">（格式：文档编号,文档名称）</span>
                    </label>
                    {importText && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleClearImport}
                        className="h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 px-2"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        清除预览
                      </Button>
                    )}
                  </div>
                  <Textarea
                    className="min-h-[160px] font-mono text-sm leading-relaxed"
                    value={importText}
                    onChange={(e) => setImportText(e.target.value)}
                    placeholder="可以直接粘贴或在此输入：&#10;QTD-ALPHA01-0001,产品需求规格说明书&#10;HISTORICAL-001,技术参考手册&#10;QTD-ALPHA01-0002"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between pt-2">
                  <Button
                    loading={importing}
                    onClick={handleImport}
                    className="bg-gradient-to-r from-sky-600 to-cyan-600 text-white hover:from-sky-700 hover:to-cyan-700 shadow-sm"
                  >
                    开始导入
                  </Button>
                  <div className="text-xs text-slate-500">
                    系统导入时会自动跳过系统中已存在的编号，并忽略空行。
                  </div>
                </div>

                {importResult && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm space-y-3 animate-in zoom-in-95 duration-200">
                    <div className="font-semibold text-slate-800 border-b pb-1.5">导入结果总结：</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-2">
                        <span className="block text-xs text-emerald-800 font-medium">成功导入</span>
                        <span className="block text-lg font-bold text-emerald-700 font-mono">{importResult.imported.length} 条</span>
                      </div>
                      <div className="bg-amber-50 border border-amber-100 rounded-xl p-2">
                        <span className="block text-xs text-amber-800 font-medium">跳过（已存在）</span>
                        <span className="block text-lg font-bold text-amber-700 font-mono">{importResult.skipped.length} 条</span>
                      </div>
                      <div className="bg-red-50 border border-red-100 rounded-xl p-2">
                        <span className="block text-xs text-red-800 font-medium">错误</span>
                        <span className="block text-lg font-bold text-red-700 font-mono">{importResult.errors.length} 条</span>
                      </div>
                    </div>

                    {importResult.errors.length > 0 && (
                      <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                        <div className="font-medium mb-1.5 flex items-center gap-1">
                          <span>⚠️</span>
                          <span>错误详情列表：</span>
                        </div>
                        <ul className="list-disc pl-5 space-y-1 font-mono">
                          {importResult.errors.map((err, idx) => (
                            <li key={idx}>行数据 "{err.line}": {err.reason}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
