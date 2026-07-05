import React, { useState, useEffect, useCallback } from 'react';
import { projectAPI, applicationAPI, settingsAPI } from '../services';
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

// 技术文件取号类别（7 类）
export const TECH_CATEGORIES = [
  { code: 'PRODUCT_TECH', name: '产品技术文件', format: 'QTD-项目代号-6位流水号', needProject: true, hint: '工艺流程图、工艺规程、使用说明书属于此类' },
  { code: 'GENERAL_TECH', name: '通用技术', format: 'QTD-CM-6位流水号', needProject: true, hint: '通用技术指南、技术规范、规定、标准属于此类' },
  { code: 'DHF', name: 'DHF', format: 'DHF-项目代号-6位流水号', needProject: true, hint: 'M0-M5开发过程文件，如《产品需求规格说明书》《系统设计方案》等属于此类' },
  { code: 'SOP', name: 'SOP', format: 'SOP-项目代号-6位流水号', needProject: true, hint: '产品装配/调试/检验/售后/来料检验/设备操作规程/治具操作规程等属于此类' },
  { code: 'PROGRAM', name: '程序', format: 'SOFT-项目代号-S1+6位流水号', needProject: true, hint: '固件、应用软件、工具驱动、配置参数、软件清单等属于此类' },
  { code: 'BOM', name: 'BOM', format: 'BOM-子类型-项目代号-6位流水号', needProject: true, hint: '仪器、模块、PCBA、软件等属于此类', hasSubType: true },
  { code: 'OTHER_DRAWING', name: '其他图纸', format: 'DRW-CM-6位流水号', needProject: false, hint: '指除机械图纸、线材图纸外，不在规范内的图纸' },
] as const;

// BOM 子类型（2 类）
export const BOM_SUBTYPES = [
  { code: 'BOM', name: '仪器/模块/软件清单', format: 'BOM-项目代号-6位流水号', legacyCodes: ['BOM_ASSE', 'BOM_SOFT'] as string[] },
  { code: 'BOM_PCBA', name: 'PCBA', format: 'BOM-PCBA-6位流水号', legacyCodes: [] as string[] },
] as const;

export function TechnicalDocumentForm({ onApplicationSubmitted }: TechnicalDocumentFormProps) {
  const [formData, setFormData] = useState({
    applicant_name: '',
    document_name: '',
    category: '',
    bomSubType: 'BOM' as string,
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

  const selectedCategory = TECH_CATEGORIES.find(c => c.code === formData.category);
  const needProject = selectedCategory?.needProject ?? false;

  const handleCaptchaReset = useCallback(() => {
    setCapToken(null);
  }, []);

  const loadProjects = useCallback(async () => {
    try {
      const projectsRes = await projectAPI.getAll('approved,pending');
      const rawProjects = (projectsRes as { data: ProjectItem[] }).data || [];
      setProjects(rawProjects);
    } catch (err) {
      console.error('加载项目失败', err);
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
    }
    if (!formData.document_name.trim()) {
      setError('请填写文档名称');
      return;
    }
    if (!formData.category) {
      setError('请选择文件类别');
      return;
    }
    if (needProject && !formData.project_code.trim()) {
      setError('请选择项目代号');
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
      // BOM 类别提交其子类型 code，其余提交类别 code 本身
      const finalCategory = formData.category === 'BOM' ? formData.bomSubType : formData.category;
      const projectCode = needProject ? formData.project_code.trim() : '';
      const response = await applicationAPI.create({
        applicant_name: formData.applicant_name.trim(),
        document_name: formData.document_name.trim(),
        project_code: projectCode,
        category: finalCategory,
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
            <CardTitle className="text-2xl font-bold text-slate-900">技术文件编号申请</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">DHF / SOP / BOM / 程序 / 产品技术文件 / 通用技术 / 其他图纸</p>
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
              <span>成功生成技术文件编号</span>
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
              placeholder="请输入文档名称"
              required
              className="border-2 focus:border-sky-400"
            />
          </div>

          <div className="space-y-2 p-4 rounded-2xl border border-slate-200 bg-white">
            <label className="text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">🧭</span>
              文件类别
              <span className="text-destructive">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {TECH_CATEGORIES.map(cat => (
                <button
                  key={cat.code}
                  type="button"
                  className={`rounded-xl border p-3 text-left transition ${formData.category === cat.code ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-sky-300'}`}
                  onClick={() => setFormData(prev => ({ ...prev, category: cat.code, project_code: '' }))}
                >
                  <div className="text-sm font-semibold">{cat.name}</div>
                  <div className="text-[11px] text-slate-500 mt-1 break-all">{cat.format}</div>
                </button>
              ))}
            </div>

            {formData.category === 'BOM' && (
              <div className="mt-3 space-y-2">
                <label className="text-xs font-semibold text-slate-700">BOM 子类型</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {BOM_SUBTYPES.map(sub => (
                    <button
                      key={sub.code}
                      type="button"
                      className={`rounded-lg border p-2.5 text-left transition ${formData.bomSubType === sub.code ? 'border-sky-500 bg-sky-50 shadow-sm' : 'border-slate-200 bg-white hover:border-sky-300'}`}
                      onClick={() => setFormData(prev => ({ ...prev, bomSubType: sub.code }))}
                    >
                      <div className="text-xs font-semibold">{sub.name}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5 break-all">{sub.format}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedCategory?.hint && (
              <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                💡 {selectedCategory.hint}
              </p>
            )}
          </div>

          {needProject && (
            <div className="space-y-2 p-4 rounded-2xl border border-slate-200 bg-white">
              <label className="text-sm font-semibold flex items-center gap-2">
                <span className="text-lg">🗂️</span>
                选择项目代号
                <span className="text-destructive">*</span>
              </label>
              <FilterableProjectSelector
                projects={projects}
                value={formData.project_code}
                onChange={(code) => setFormData(prev => ({ ...prev, project_code: code }))}
                placeholder="请选择项目代号"
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
