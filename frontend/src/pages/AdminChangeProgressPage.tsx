import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { changeProgressAPI, projectAPI } from '../services';
import type { ChangeProgress, Project } from '../services';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Trash2, Edit, Plus, X, Search } from 'lucide-react';

export function AdminChangeProgressPage() {
  const navigate = useNavigate();
  const [list, setList] = useState<ChangeProgress[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ChangeProgress | null>(null);
  const [error, setError] = useState<string | null>(null);

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
    return 'bg-slate-50 text-slate-600 border-slate-200'; // Default styling
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">变更完成进度管理</h2>
            <p className="text-sm text-muted-foreground mt-1">创建和维护前台展示的 DCP、CR、CN 进度卡片</p>
          </div>
          <Button onClick={handleOpenCreate} className="flex items-center gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            新增进度记录
          </Button>
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
              {/* Header */}
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

              {/* Form Content */}
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

                {/* Footer */}
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
      </div>
    </Layout>
  );
}
