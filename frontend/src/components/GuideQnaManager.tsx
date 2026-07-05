import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { guideQnaAPI } from '../services';
import type { GuideQna, GuideQnaHistory, GuideQnaHistoryDetail } from '../services';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Badge } from './ui/badge';
import { Trash2, Plus, Save, Upload, ChevronUp, ChevronDown, History } from 'lucide-react';
import { formatBeijingTime } from '@/utils/timezone';

type Tab = 'edit' | 'history';

/**
 * Q&A 管理主体内容（不含 Layout 与页面标题）。
 * 供贡献者页面的 Tab 内嵌使用。
 */
export function GuideQnaManager() {
  const [tab, setTab] = useState<Tab>('edit');
  const [draft, setDraft] = useState<GuideQna[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [publishMsg, setPublishMsg] = useState<string | null>(null);

  // 历史 Tab 状态
  const [historyList, setHistoryList] = useState<GuideQnaHistory[]>([]);
  const [historyDetail, setHistoryDetail] = useState<GuideQnaHistoryDetail | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    loadDraft();
  }, []);

  const loadDraft = async () => {
    setLoading(true);
    try {
      const res = await guideQnaAPI.getDraft();
      const data = (res as { data: GuideQna[] }).data;
      setDraft(data || []);
    } catch (err) {
      console.error('加载草稿失败', err);
      setError('加载草稿失败');
    } finally {
      setLoading(false);
    }
  };

  const handleItemChange = (idx: number, field: 'question' | 'answer', value: string) => {
    setDraft(prev => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const handleAddItem = () => {
    setDraft(prev => [...prev, { sort_order: prev.length + 1, question: '', answer: '' }]);
  };

  const handleDeleteItem = (idx: number) => {
    setDraft(prev => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, sort_order: i + 1 })));
  };

  const handleMoveItem = (idx: number, direction: 'up' | 'down') => {
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === draft.length - 1) return;
    const newDraft = [...draft];
    const target = direction === 'up' ? idx - 1 : idx + 1;
    [newDraft[idx], newDraft[target]] = [newDraft[target], newDraft[idx]];
    setDraft(newDraft.map((it, i) => ({ ...it, sort_order: i + 1 })));
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    setError(null);
    try {
      const items = draft.map((it, i) => ({
        question: it.question,
        answer: it.answer,
        sort_order: i + 1,
      }));
      const res = await guideQnaAPI.saveDraft({ items });
      const data = (res as { data: GuideQna[] }).data;
      setDraft(data || []);
      alert('草稿已保存');
    } catch (err) {
      console.error('保存草稿失败', err);
      setError('保存草稿失败');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    if (!confirm('确认发布？当前发布版将归档为历史版本。')) return;
    setPublishing(true);
    setPublishMsg(null);
    try {
      const res = await guideQnaAPI.publish();
      const data = (res as { data: { published: boolean; reason?: string; version_label?: string } }).data;
      if (data.published) {
        setPublishMsg(`发布成功：${data.version_label}`);
        alert(`发布成功：${data.version_label}`);
      } else {
        setPublishMsg(data.reason || '内容无变化');
        alert(data.reason || '内容无变化，未生成新历史记录');
      }
    } catch (err) {
      console.error('发布失败', err);
      alert('发布失败');
    } finally {
      setPublishing(false);
    }
  };

  const loadHistoryList = async () => {
    setHistoryLoading(true);
    try {
      const res = await guideQnaAPI.getHistoryList();
      const data = (res as { data: GuideQnaHistory[] }).data;
      setHistoryList(data || []);
    } catch (err) {
      console.error('加载历史列表失败', err);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleViewHistory = async (id: number) => {
    try {
      const res = await guideQnaAPI.getHistoryDetail(id);
      const data = (res as { data: GuideQnaHistoryDetail }).data;
      setHistoryDetail(data);
    } catch (err) {
      console.error('加载历史详情失败', err);
    }
  };

  const handleDeleteHistory = async (id: number) => {
    if (!confirm('确认删除此历史版本？此操作不可撤销。')) return;
    try {
      await guideQnaAPI.deleteHistory(id);
      if (historyDetail?.id === id) setHistoryDetail(null);
      loadHistoryList();
    } catch (err) {
      console.error('删除失败', err);
      alert('删除失败');
    }
  };

  const handleTabChange = (newTab: Tab) => {
    setTab(newTab);
    if (newTab === 'history' && historyList.length === 0) {
      loadHistoryList();
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-800">Q&A 管理</h2>
        <p className="text-sm text-muted-foreground mt-1">维护"变更实操 10 问 10 答"内容，支持草稿编辑与发布版本管理</p>
      </div>

      {/* Tab */}
      <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-sm w-fit">
        <button
          onClick={() => handleTabChange('edit')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'edit' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          编辑当前版本
        </button>
        <button
          onClick={() => handleTabChange('history')}
          className={`px-4 py-2 text-xs font-bold rounded-lg transition-all ${tab === 'history' ? 'bg-white text-primary shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
        >
          历史版本
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
      )}

      {tab === 'edit' && (
        <Card>
          <CardHeader className="border-b">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">编辑草稿</CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleAddItem} className="flex items-center gap-1.5">
                  <Plus className="h-4 w-4" />新增问答
                </Button>
                <Button variant="outline" size="sm" onClick={handleSaveDraft} loading={saving} className="flex items-center gap-1.5">
                  <Save className="h-4 w-4" />保存草稿
                </Button>
                <Button size="sm" onClick={handlePublish} loading={publishing} className="flex items-center gap-1.5">
                  <Upload className="h-4 w-4" />发布
                </Button>
              </div>
            </div>
            {publishMsg && (
              <p className="text-xs text-emerald-700 mt-2">{publishMsg}</p>
            )}
          </CardHeader>
          <CardContent className="pt-4">
            {loading ? (
              <div className="text-center py-10 text-muted-foreground">加载中...</div>
            ) : draft.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">暂无问答，点击"新增问答"开始编辑</div>
            ) : (
              <div className="space-y-4">
                {draft.map((item, idx) => (
                  <div key={idx} className="p-4 border rounded-lg bg-white space-y-3">
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="font-mono">问 {idx + 1}</Badge>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleMoveItem(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                          title="上移"
                        >
                          <ChevronUp className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleMoveItem(idx, 'down')}
                          disabled={idx === draft.length - 1}
                          className="p-1 rounded hover:bg-slate-100 disabled:opacity-30"
                          title="下移"
                        >
                          <ChevronDown className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteItem(idx)}
                          className="p-1 rounded hover:bg-red-50 text-red-500"
                          title="删除"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-700 mb-1 block">问题</label>
                      <Input
                        value={item.question}
                        onChange={(e) => handleItemChange(idx, 'question', e.target.value)}
                        placeholder="请输入问题"
                      />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1 block">答案（Markdown）</label>
                        <Textarea
                          value={item.answer}
                          onChange={(e) => handleItemChange(idx, 'answer', e.target.value)}
                          placeholder="支持 Markdown：列表用 - 或 1.，图片 ![描述](URL)，链接 [文字](URL)"
                          rows={8}
                          className="font-mono text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-xs font-bold text-slate-700 mb-1 block">预览</label>
                        <div className="border rounded-md p-3 bg-slate-50 h-full overflow-y-auto prose prose-sm max-w-none prose-img:rounded-md">
                          {item.answer.trim() ? (
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.answer}</ReactMarkdown>
                          ) : (
                            <span className="text-muted-foreground text-xs">答案预览区</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {tab === 'history' && (
        <Card>
          <CardHeader className="border-b">
            <CardTitle className="text-lg flex items-center gap-2">
              <History className="h-5 w-5" />
              历史版本列表
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {historyLoading ? (
              <div className="text-center py-10 text-muted-foreground">加载中...</div>
            ) : historyList.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">暂无历史版本</div>
            ) : (
              <>
                <div className="space-y-2 mb-4">
                  {historyList.map(h => (
                    <div key={h.id} className="flex items-center justify-between p-3 border rounded-lg bg-white">
                      <div>
                        <div className="font-semibold text-sm text-slate-700">{h.version_label}</div>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {formatBeijingTime(h.published_at)} · 哈希: {h.content_hash_short}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleViewHistory(h.id)}>
                          查看
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => handleDeleteHistory(h.id)} className="gap-1">
                          <Trash2 className="h-3.5 w-3.5" />
                          删除
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                {historyDetail && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-bold text-slate-700 mb-3">
                      {historyDetail.version_label} 内容预览
                    </h3>
                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                      {historyDetail.items.map((item, idx) => (
                        <div key={idx} className="p-3 border rounded-md bg-white">
                          <div className="font-semibold text-sm">{`问${idx + 1}：${item.question}`}</div>
                          <div className="text-sm text-muted-foreground mt-2 prose prose-sm max-w-none prose-img:rounded-md">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.answer}</ReactMarkdown>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default GuideQnaManager;
