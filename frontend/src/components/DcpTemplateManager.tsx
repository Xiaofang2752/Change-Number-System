import { useState, useEffect } from 'react';
import { dcpAPI } from '../services';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';

interface DcpTemplateMeta {
  exists: boolean;
  filename?: string;
  updated_at?: string;
}

/**
 * DCP《设计变更方案》模板维护组件。
 * 供管理员在"变更管理"页的对应页签下导入/维护 Word(.docx) 模板。
 */
export function DcpTemplateManager() {
  const [meta, setMeta] = useState<DcpTemplateMeta | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    dcpAPI.getTemplateMeta()
      .then((res) => {
        setMeta((res as unknown as { data: DcpTemplateMeta }).data);
      })
      .catch(() => {
        // 获取失败不影响页面渲染（多为未登录/网络问题，由拦截器统一处理）
      });
  }, []);

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
      const res = await dcpAPI.uploadTemplate(formData);
      const data = (res as unknown as { data: { filename: string; updated_at: string } }).data;
      setMeta({ exists: true, filename: data.filename, updated_at: data.updated_at });
      setFile(null);
      setNotification({ message: 'DCP 模板已更新', type: 'success' });
    } catch (err: unknown) {
      console.error('上传 DCP 模板失败:', err);
      setNotification({ message: (err as { message?: string }).message || '上传失败，请重试', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

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
            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="font-medium mb-1">当前模板状态</div>
              <div className="text-sm text-muted-foreground">
                {meta?.exists ? (
                  <span>
                    已上传模板：<span className="font-medium text-gray-700">{meta.filename}</span>
                    {meta.updated_at && <span> （更新于 {meta.updated_at}）</span>}
                  </span>
                ) : (
                  <span className="text-orange-600">尚未上传模板，用户在提交 DCP 编号申请后将无法下载《设计变更方案》。</span>
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
              上传的 Word(.docx) 模板将用于自动生成 DCP《设计变更方案》。请在模板中使用以下占位符（大括号为英文半角），系统会自动替换为申请内容：
              <div className="mt-2 space-y-1">
                <div><code className="bg-gray-100 px-1 rounded">{'{dcp_no}'}</code> — DCP 编号（自动填充申请后的编号）</div>
                <div><code className="bg-gray-100 px-1 rounded">{'{project_code}'}</code> — 项目代号</div>
                <div><code className="bg-gray-100 px-1 rounded">{'{applicant_name}'}</code> — 申请人</div>
                <div><code className="bg-gray-100 px-1 rounded">{'{date}'}</code> — 申请日期（YYYY-MM-DD）</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
