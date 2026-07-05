import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { contributorAPI, type Contributor } from '../services';
import { Layout } from '../components/Layout';
import { GuideQnaManager } from '../components/GuideQnaManager';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';

type PageTab = 'contributors' | 'qna';

export function AdminContributorsPage() {
  const navigate = useNavigate();
  const [pageTab, setPageTab] = useState<PageTab>('contributors');
  const [contributors, setContributors] = useState<Contributor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newContributor, setNewContributor] = useState({ name: '', points: 0, description: '' });
  const [processing, setProcessing] = useState<number | null>(null);
  const [editContributor, setEditContributor] = useState<Contributor | null>(null);
  const [editForm, setEditForm] = useState({ name: '', points: 0, description: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    if (localStorage.getItem('isAdmin') !== 'true') {
      navigate('/admin/login');
      return;
    }
    loadContributors();
  }, [navigate]);

  const loadContributors = async () => {
    setLoading(true);
    try {
      const res = await contributorAPI.getAll();
      setContributors((res as { data: Contributor[] }).data || []);
    } catch (err) {
      console.error('加载贡献者失败', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!newContributor.name.trim()) {
      alert('姓名不能为空');
      return;
    }
    setProcessing(0);
    try {
      await contributorAPI.create({
        name: newContributor.name.trim(),
        points: Number(newContributor.points) || 0,
        description: newContributor.description.trim(),
      });
      setNewContributor({ name: '', points: 0, description: '' });
      setShowCreateForm(false);
      loadContributors();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : '创建失败');
    } finally {
      setProcessing(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('确定要删除此贡献者记录吗?')) return;
    setProcessing(id);
    try {
      await contributorAPI.delete(id);
      loadContributors();
    } catch (err) {
      console.error('删除失败', err);
      alert('删除失败');
    } finally {
      setProcessing(null);
    }
  };

  const handleEditClick = (contrib: Contributor) => {
    setEditContributor(contrib);
    setEditForm({
      name: contrib.name,
      points: contrib.points,
      description: contrib.description || '',
    });
    setError('');
  };

  const handleEditSave = async () => {
    if (!editContributor || !editForm.name.trim()) return;
    setProcessing(editContributor.id);
    setError('');
    try {
      await contributorAPI.update(editContributor.id, {
        name: editForm.name.trim(),
        points: Number(editForm.points) || 0,
        description: editForm.description.trim(),
      });
      setEditContributor(null);
      loadContributors();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '更新失败');
    } finally {
      setProcessing(null);
    }
  };

  const handleEditCancel = () => {
    setEditContributor(null);
    setError('');
  };

  if (loading && pageTab === 'contributors') {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        {/* 顶层 Tab：贡献者荣誉榜 / Q&A 管理 */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-sm w-fit mb-6">
          <button
            onClick={() => setPageTab('contributors')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${pageTab === 'contributors' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            贡献者荣誉榜
          </button>
          <button
            onClick={() => setPageTab('qna')}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${pageTab === 'qna' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            Q&A 管理
          </button>
        </div>

        {pageTab === 'qna' ? (
          <GuideQnaManager />
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold text-gray-800">贡献者荣誉榜管理</h2>
            </div>

            <Card className="mb-6">
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>贡献者列表</CardTitle>
              <Button onClick={() => setShowCreateForm(!showCreateForm)}>
                {showCreateForm ? '取消' : '添加贡献者'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {showCreateForm && (
              <div className="border rounded-lg p-4 mb-6 space-y-3 bg-amber-50/50 border-amber-200">
                <h3 className="text-sm font-bold text-amber-800 mb-2">新建贡献者</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">贡献者姓名 *</label>
                    <Input
                      placeholder="姓名 *"
                      value={newContributor.name}
                      onChange={(e) => setNewContributor(prev => ({ ...prev, name: e.target.value }))}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">积分数 *</label>
                    <Input
                      type="number"
                      placeholder="贡献积分 *"
                      value={newContributor.points}
                      onChange={(e) => setNewContributor(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">贡献描述 / 改进意见说明 (可选)</label>
                  <Textarea
                    placeholder="例如：反馈了变更流程的卡顿问题，协助优化了用户体验"
                    value={newContributor.description}
                    onChange={(e) => setNewContributor(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreate} loading={processing === 0}>
                    保存添加
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                    取消
                  </Button>
                </div>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">排名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">姓名</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">贡献积分</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">贡献描述</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {contributors.map((contrib, index) => {
                    const isEditing = editContributor?.id === contrib.id;
                    return (
                      <tr key={contrib.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                          {index === 0 ? '🥇 第一名' : index === 1 ? '🥈 第二名' : index === 2 ? '🥉 第三名' : `${index + 1}`}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                          {isEditing ? (
                            <Input
                              value={editForm.name}
                              onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                              className="w-32"
                            />
                          ) : (
                            contrib.name
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-mono">
                          {isEditing ? (
                            <Input
                              type="number"
                              value={editForm.points}
                              onChange={(e) => setEditForm(prev => ({ ...prev, points: parseInt(e.target.value) || 0 }))}
                              className="w-24"
                            />
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold border border-amber-200/50">
                              {contrib.points} 分
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 max-w-md">
                          {isEditing ? (
                            <Textarea
                              value={editForm.description}
                              onChange={(e) => setEditForm(prev => ({ ...prev, description: e.target.value }))}
                              rows={2}
                            />
                          ) : (
                            contrib.description || '-'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          {isEditing ? (
                            <div className="flex justify-end gap-2">
                              {error && <span className="text-xs text-red-500 self-center mr-2">{error}</span>}
                              <Button size="sm" onClick={handleEditSave} loading={processing === contrib.id}>
                                保存
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleEditCancel}>
                                取消
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleEditClick(contrib)}>
                                编辑
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => handleDelete(contrib.id)}
                                loading={processing === contrib.id}
                              >
                                删除
                              </Button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {contributors.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-sm text-gray-400">
                        暂无贡献者记录，请点击右上角添加。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
          </>
        )}
      </div>
    </Layout>
  );
}
