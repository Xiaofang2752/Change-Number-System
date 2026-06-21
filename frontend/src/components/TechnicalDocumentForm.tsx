import React, { useState, useEffect, useCallback } from 'react';
import { projectAPI, applicationAPI, settingsAPI, technicalDocumentAPI } from '../services';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { FilterableProjectSelector } from './FilterableProjectSelector';
import { CapVerification } from './CapVerification';
import { Copy, Check } from 'lucide-react';

interface ProjectItem {
  id: number;
  code: string;
  name: string;
  status: string;
  created_at: string;
}

interface TechnicalDocumentFormProps {
  onApplicationSubmitted?: () => void;
}

export function TechnicalDocumentForm({ onApplicationSubmitted }: TechnicalDocumentFormProps) {
  const [formData, setFormData] = useState({
    applicant_name: '',
    document_name: '',
    file_scope: 'project',
    project_code: '',
  });
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  const [cooldownConfig, setCooldownConfig] = useState(10);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [captchaKey, setCaptchaKey] = useState(0);
  const [capToken, setCapToken] = useState<string | null>(null);

  const handleCaptchaReset = useCallback(() => {
    setCapToken(null);
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const [projectsRes, keywordsRes] = await Promise.all([
        projectAPI.getAll('approved,pending'),
        technicalDocumentAPI.getKeywords('approved,pending')
      ]);
      
      const rawProjects = (projectsRes as { data: ProjectItem[] }).data || [];
      const rawKeywords = (keywordsRes as { data: { id: number; keyword: string; description: string; status: string; created_at: string }[] }).data || [];
      
      const mappedKeywords = rawKeywords.map(kw => ({
        id: -kw.id, // Use negative ID to avoid collision with project ID
        code: kw.keyword,
        name: `[QTD关键字] ${kw.description || ''}`,
        status: kw.status,
        created_at: kw.created_at
      }));

      setProjects([...rawProjects, ...mappedKeywords]);
    } catch (err) {
      console.error('加载项目和关键字失败', err);
    }
  }, []);

  const loadCooldown = useCallback(async () => {
    try {
      const res = await settingsAPI.getCooldown();
      const cooldown = (res as { data: { cooldown_seconds: number } }).data?.cooldown_seconds;
      if (cooldown) {
        setCooldownConfig(cooldown);
      }
    } catch (err) {
      console.error('加载冷却时间失败', err);
    }
  }, []);

  useEffect(() => {
    loadProjects();
    loadCooldown();
  }, [loadProjects, loadCooldown]);

  const startCooldown = useCallback((seconds?: number) => {
    const cooldownTime = seconds || cooldownConfig;
    setIsCoolingDown(true);
    setCooldownSeconds(cooldownTime);
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setIsCoolingDown(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownConfig]);

  const copyToClipboard = useCallback(async (number: string) => {
    try {
      await navigator.clipboard.writeText(number);
      setCopiedNumber(number);
      setTimeout(() => setCopiedNumber(null), 2000);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = number;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopiedNumber(number);
      setTimeout(() => setCopiedNumber(null), 2000);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.applicant_name.trim()) {
      setError('请填写申请人姓名');
      return;
    }    if (!formData.document_name.trim()) {
      setError('请填写文档名称');
      return;
    }    if (formData.file_scope === 'project' && !formData.project_code.trim()) {
      setError('请选择项目管理类文件的项目代号');
      return;
    }
    if (!capToken) {
      setError('请完成人机验证');
      return;
    }
    if (isCoolingDown) {
      setError(`请等待 ${cooldownSeconds} 秒后可再次取号`);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const projectCode = formData.file_scope === 'project' ? formData.project_code.trim() : '';
      const response = await applicationAPI.create({
        applicant_name: formData.applicant_name.trim(),
        document_name: formData.document_name.trim(),
        project_code: projectCode,
        number_type: 'QTD',
        capToken,
      });

      const fullNumber = (response as { data: { full_number: string } }).data?.full_number || '申请成功';
      setResult(fullNumber);

      if (onApplicationSubmitted) {
        onApplicationSubmitted();
      }

      startCooldown();
      setFormData(prev => ({ ...prev, project_code: '' }));
      setCapToken(null);
      setCaptchaKey(prev => prev + 1);
    } catch (err: unknown) {
      const errorInfo = err as { response?: { status: number; data?: { retryAfter?: number } }; message?: string };
      if (errorInfo.response?.status === 429) {
        const retryAfter = errorInfo.response?.data?.retryAfter || cooldownConfig;
        setError(`请求过于频繁，请等待 ${retryAfter} 秒后再次取号`);
        startCooldown(retryAfter);
      } else {
        setError(errorInfo.message || '提交申请失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-full relative overflow-hidden border-2 border-sky-300/30 shadow-2xl shadow-sky-200/40">
      <div className="absolute inset-0 bg-gradient-to-br from-sky-50 via-transparent to-white pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-sky-500 via-cyan-500 to-blue-500 animate-pulse" />
      <CardHeader className="relative bg-gradient-to-r from-sky-50 via-cyan-50 to-slate-50 border-b border-sky-200/60">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-sky-200/40 border-2 border-sky-300">
            <span className="text-2xl">📄</span>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold text-slate-900">技术文件取号</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">QTD：Quaero Technical Document</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative pt-6 px-4 sm:px-6 space-y-6">
        {error && (
          <div className="bg-red-50 border-2 border-red-200 text-red-800 px-5 py-4 rounded-lg">
            <div className="flex items-start gap-2">
              <span className="text-xl">⚠️</span>
              <div className="flex-1 font-medium">{error}</div>
            </div>
          </div>
        )}
        {result && (
          <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-teal-500/10 border-2 border-emerald-500/30 rounded-2xl p-5 shadow-xl shadow-emerald-500/5 animate-in zoom-in-95 duration-200">
            <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 mb-2.5 flex items-center gap-1.5 select-none">
              <span>🎉</span>
              <span>成功生成 QTD 编号</span>
            </div>
            
            <div className="flex items-center justify-between gap-4 bg-slate-900 text-emerald-400 border-2 border-slate-800 rounded-xl px-5 py-4 font-mono shadow-inner relative group overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />
              <span className="relative z-10 text-xl sm:text-2xl md:text-3xl font-extrabold tracking-wider break-all select-all">
                {result}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-10 w-10 p-0 border-emerald-500/30 bg-slate-900 hover:bg-slate-800 hover:border-emerald-400 shrink-0 relative z-10 shadow-sm transition-all"
                onClick={() => copyToClipboard(result)}
                title="复制编号"
              >
                {copiedNumber === result ? (
                  <Check className="h-5 w-5 text-emerald-400" />
                ) : (
                  <Copy className="h-5 w-5 text-emerald-400" />
                )}
              </Button>
            </div>
            {copiedNumber === result && (
              <div className="mt-2 text-xs text-emerald-700 font-semibold text-center select-none flex items-center justify-center gap-1">
                <span>✓</span>
                <span>已成功复制到剪贴板，可直接粘贴使用</span>
              </div>
            )}
          </div>
        )}

        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 space-y-3">
          <p className="font-semibold">QTD 取号说明</p>
          <ul className="list-disc ml-5 space-y-1 text-sm text-slate-600">
            <li>编号前缀固定为 <span className="font-medium">QTD</span>。</li>
            <li>项目管理类文件会使用项目代号或 QTD 关键字，生成格式为 <span className="font-medium">QTD-项目代号-流水号</span>。</li>
            <li>非项目管理类文件省略关键字，生成格式为 <span className="font-medium">QTD-流水号</span>。</li>
          </ul>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2 p-4 rounded-2xl border border-slate-200 bg-white">
            <label className="text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">👤</span>
              申请人姓名
              <span className="text-destructive">*</span>
            </label>
            <Input
              value={formData.applicant_name}
              onChange={(e) => setFormData(prev => ({ ...prev, applicant_name: e.target.value }))}
              placeholder="请输入申请人姓名"
              required
              className="border-2 focus:border-sky-400"
            />
          </div>

          <div className="space-y-2 p-4 rounded-2xl border border-slate-200 bg-white">
            <label className="text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">📝</span>
              文档名称
              <span className="text-destructive">*</span>
            </label>
            <Input
              value={formData.document_name}
              onChange={(e) => setFormData(prev => ({ ...prev, document_name: e.target.value }))}
              placeholder="请输入文档名称，例如 DHF 文档名称"
              required
              className="border-2 focus:border-sky-400"
            />
          </div>

          <div className="space-y-2 p-4 rounded-2xl border border-slate-200 bg-white">
            <label className="text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">🧭</span>
              文件归类
            </label>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                className={`rounded-xl border p-4 text-left transition ${formData.file_scope === 'project' ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white'}`}
                onClick={() => setFormData(prev => ({ ...prev, file_scope: 'project' }))}
              >
                <div className="text-sm font-semibold">项目类文件</div>
                <div className="text-xs text-slate-500 mt-1">项目上使用，如产品需求规格说明书等</div>
              </button>
              <button
                type="button"
                className={`rounded-xl border p-4 text-left transition ${formData.file_scope === 'non-project' ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white'}`}
                onClick={() => setFormData(prev => ({ ...prev, file_scope: 'non-project', project_code: '' }))}
              >
                <div className="text-sm font-semibold">非项目类文件</div>
                <div className="text-xs text-slate-500 mt-1">如通用文档，某些通用SOP</div>
              </button>
            </div>
          </div>

          {formData.file_scope === 'project' && (
            <div className="space-y-2 p-4 rounded-2xl border border-slate-200 bg-white">
              <div className="flex items-center justify-between gap-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <span className="text-lg">🗂️</span>
                  选择项目关键字 / 代号
                  <span className="text-destructive">*</span>
                </label>
           
              </div>
              <FilterableProjectSelector
                projects={projects}
                value={formData.project_code}
                onChange={(code) => setFormData(prev => ({ ...prev, project_code: code }))}
                placeholder="请选择项目关键字或代号"
              />
            </div>
          )}

          <div className="space-y-2 p-4 rounded-2xl border border-slate-200 bg-white">
            <label className="text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">🔒</span>
              人机验证
              <span className="text-destructive">*</span>
            </label>
            <CapVerification
              key={captchaKey}
              endpoint="/cap/"
              onSolve={(token) => {
                setCapToken(token);
                setError(null);
              }}
              onReset={handleCaptchaReset}
              onError={(msg) => {
                setCapToken(null);
                setError(msg);
              }}
            />
          </div>

          <Button
            type="submit"
            loading={loading}
            size="lg"
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-sky-600 to-cyan-600 hover:from-sky-700 hover:to-cyan-700 text-white shadow-xl"
            disabled={isCoolingDown || loading || !capToken}
          >
            {isCoolingDown ? `请等待 ${cooldownSeconds}s 后再次取号` : '提交申请'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
