import { useState, useEffect } from 'react';
import { dcpAPI } from '../services';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

type DocTemplateType = 'DCP' | 'IMPACT' | 'RISK';

interface DcpTemplateVersion {
  id: number;
  filename?: string;
  published_at?: string;
  created_by?: string | null;
}

interface DcpTemplateMeta {
  type?: DocTemplateType;
  exists: boolean;
  filename?: string;
  updated_at?: string;
  latest_id?: number | null;
  versions?: DcpTemplateVersion[];
}

const TEMPLATE_TYPES: { type: DocTemplateType; label: string; hint: string }[] = [
  { type: 'DCP', label: 'DCP《设计变更方案》', hint: '{dcp_no} / {project_code} / {applicant_name} / {date}' },
  { type: 'IMPACT', label: '《变更影响评估表》', hint: '{dcp_no} 等占位符，其余由工程师填写' },
  { type: 'RISK', label: '《风险登记册》', hint: '{dcp_no} 等占位符，其余由工程师填写' },
];

/**
 * DCP 相关表单模板维护组件（版本化）。
 * 供管理员在"变更管理"页的对应页签下导入/维护 Word(.docx) 模板。
 * 支持 DCP《设计变更方案》、《变更影响评估表》、《风险登记册》三类。
 */
export function DcpTemplateManager() {
  const [activeType, setActiveType] = useState<DocTemplateType>('DCP');
  const [meta, setMeta] = useState<DcpTemplateMeta | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const loadMeta = () => {
    dcpAPI.getTemplateMeta(activeType)
      .then((res) => {
        setMeta((res as unknown as { data: DcpTemplateMeta }).data);
      })
      .catch(() => {
        // 获取失败不影响页面渲染（多为未登录/网络问题，由拦截器统一处理）
      });
  };

  useEffect(() => {
    loadMeta();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeType]);

  useEffect(() => {
    if (!notification) return;
    const timer = setTimeout(() => setNotification(null), 3000);
    return () => clearTimeout(timer);
  }, [notification]);

  const handleUpload = async () => {
    if (!file || uploading) return;

    if (!file.name.toLowerCase().endsWith('.docx')) {
      setNotification({ message: '请上传 .docx 格式的 Word 模板', type: 'error' });
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      await dcpAPI.uploadTemplate(activeType, formData);
      await loadMeta();
      setFile(null);
      setNotification({ message: `${TEMPLATE_TYPES.find(t => t.type === activeType)?.label} 模板已上传（已新增版本）`, type: 'success' });
    } catch (err: unknown) {
      console.error('上传模板失败:', err);
      setNotification({ message: (err as { message?: string }).message || '上传失败，请重试', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  const activeMeta = TEMPLATE_TYPES.find(t => t.type === activeType);

  return (
    <div className="space-y-6">
      {notification && (
        <div className={`px-4 py-3 rounded-lg shadow-sm ${
          notification.type === 'success' ? 'bg-green-500 text-white' : 'bg-red-500 text-white'
        }`}>
          <span className="text-sm font-medium">
            {notification.type === 'success' ? '✓ ' : '✗ '}
            {notification.message}
          </span>
        </div>
      )}

      <Card>
        <CardContent>
          <div className="space-y-4">
            {/* 模板类型切换 */}
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_TYPES.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => { setActiveType(t.type); setFile(null); }}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors ${
                    activeType === t.type
                      ? 'bg-primary text-white border-primary'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-primary'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="font-medium mb-1">当前模板状态（{activeMeta?.label}）</div>
              <div className="text-sm text-muted-foreground">
                {meta?.exists ? (
                  <span>
                    已上传模板：<span className="font-medium text-gray-700">{meta.filename}</span>
                    {meta.updated_at && <span> （更新于 {meta.updated_at}）</span>}
                  </span>
                ) : (
                  <span className="text-orange-600">尚未上传模板，工程师在提交对应 DCP 编号申请后将无法下载该表单。</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".docx"
                onChange={(e) => setFile(e.target.files && e.target.files[0] ? e.target.files[0] : null)}
                className="block text-sm text-gray-600
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-blue-50 file:text-blue-700
                  hover:file:bg-blue-100"
              />
              <Button onClick={handleUpload} disabled={!file || uploading}>
                {uploading ? '上传中...' : '上传模板'}
              </Button>
              {file && (
                <span className="text-sm text-muted-foreground">已选择：{file.name}</span>
              )}
            </div>

            <div className="text-xs text-muted-foreground leading-relaxed">
              上传的 Word(.docx) 模板将用于自动生成对应表单。请在模板中使用以下占位符（大括号为英文半角），系统会自动替换为申请内容：
              <div className="mt-2 space-y-1">
                <div><code className="bg-gray-100 px-1 rounded">{'{dcp_no}'}</code> — DCP 编号（自动填充申请后的编号）</div>
                <div><code className="bg-gray-100 px-1 rounded">{'{project_code}'}</code> — 项目代号</div>
                <div><code className="bg-gray-100 px-1 rounded">{'{applicant_name}'}</code> — 申请人</div>
                <div><code className="bg-gray-100 px-1 rounded">{'{date}'}</code> — 申请日期（YYYY-MM-DD）</div>
              </div>
              <div className="mt-2 text-orange-600">
                每次上传都会新增一个模板版本。工程师下载时，系统按其 DCP 编号的「申请日期」对应到当日或之前发布的该类型最新模板版本。
              </div>
            </div>

            {meta?.versions && meta.versions.length > 0 && (
              <div className="mt-4">
                <div className="font-medium mb-2 text-sm">模板版本历史（按发布时间倒序）</div>
                <div className="overflow-x-auto rounded-md border">
                  <table className="w-full text-xs">
                    <thead className="bg-muted">
                      <tr>
                        <th className="h-9 px-3 text-left font-medium whitespace-nowrap">版本 ID</th>
                        <th className="h-9 px-3 text-left font-medium whitespace-nowrap">文件名</th>
                        <th className="h-9 px-3 text-left font-medium whitespace-nowrap">发布时间</th>
                        <th className="h-9 px-3 text-left font-medium whitespace-nowrap">上传人</th>
                      </tr>
                    </thead>
                    <tbody>
                      {meta.versions.map((v) => (
                        <tr key={v.id} className="border-t">
                          <td className="px-3 py-2 whitespace-nowrap font-mono">#{v.id}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{v.filename || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{v.published_at || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">{v.created_by || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
