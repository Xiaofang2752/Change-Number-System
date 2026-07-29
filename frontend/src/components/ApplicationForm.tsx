import React, { useState, useEffect, useCallback } from 'react';
import { projectAPI, numberTypeAPI, applicationAPI, settingsAPI, dcpAPI } from '../services';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
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

interface NumberTypeItem {
  id: number;
  type_code: string;
  type_name: string;
  description?: string;
  status: string;
  created_at: string;
}

interface FeatureToggles {
  allow_request_project: boolean;
  allow_request_number_type: boolean;
}

interface ApplicationFormProps {
  onApplicationSubmitted?: () => void;
}

export function ApplicationForm({ onApplicationSubmitted }: ApplicationFormProps) {
  const [formData, setFormData] = useState({
    applicant_name: '',
    project_code: '',
    number_type: '',
  });

  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [numberTypes, setNumberTypes] = useState<NumberTypeItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  // 记录本次生成结果对应的申请信息，用于 DCP《设计变更方案》下载判断
  const [resultApp, setResultApp] = useState<{ id: number; number_type: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProjectRequest, setShowProjectRequest] = useState(false);
  const [showNumberTypeRequest, setShowNumberTypeRequest] = useState(false);
  const [newProject, setNewProject] = useState({ project_code: '', project_name: '' });
  const [newNumberType, setNewNumberType] = useState({ type_code: '', type_name: '', description: '' });
  const [requestLoading, setRequestLoading] = useState(false);

  // 功能开关状态
  const [featureToggles, setFeatureToggles] = useState<FeatureToggles>({
    allow_request_project: false,
    allow_request_number_type: false
  });
  
  // 检查是否是管理员
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  // 冷却时间状态
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isCoolingDown, setIsCoolingDown] = useState(false);
  
  // 冷却时间配置（从API获取）
  const [cooldownConfig, setCooldownConfig] = useState(10);

  // 复制状态
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  
  // 验证码组件的 key，用于强制重新渲染以重置状态
  const [captchaKey, setCaptchaKey] = useState(0);

  // 人机验证 token
  const [capToken, setCapToken] = useState<string | null>(null);
  
  // 处理验证码重置
  const handleCaptchaReset = useCallback(() => {
    setCapToken(null);
  }, []);

  // 加载功能开关状态
  const loadFeatureToggles = useCallback(async () => {
    try {
      // 每次都从API获取最新状态，确保刷新后立即生效
      const [togglesRes, cooldownRes] = await Promise.all([
        settingsAPI.getFeatureToggles(),
        settingsAPI.getCooldown(),
      ]);

      const toggles = (togglesRes as { data: FeatureToggles }).data;
      if (toggles) {
        setFeatureToggles(toggles);
      }

      const cooldown = (cooldownRes as { data: { cooldown_seconds: number } }).data?.cooldown_seconds;
      if (cooldown) {
        setCooldownConfig(cooldown);
      }
    } catch {
      console.error('加载功能开关失败');
    }
  }, []);

  // 加载项目和编号类型（包括 pending 状态）
  useEffect(() => {
    const loadData = async () => {
      try {
        const [projectsRes, numberTypesRes] = await Promise.all([
          projectAPI.getAll('approved,pending'),
          numberTypeAPI.getAll('approved,pending'),
        ]);
        setProjects((projectsRes as { data: ProjectItem[] }).data || []);
        const rawTypes = (numberTypesRes as { data: NumberTypeItem[] }).data || [];
        setNumberTypes(rawTypes.filter(nt => nt.type_code !== 'QTD'));
      } catch {
        setError('加载数据失败');
      }
    };
    loadData();
    loadFeatureToggles();
  }, [loadFeatureToggles]);

  // 从 localStorage 加载缓存
  useEffect(() => {
    const cachedUser = localStorage.getItem('userInfo');
    if (cachedUser) {
      const userInfo = JSON.parse(cachedUser);
      setFormData(prev => ({
        ...prev,
        applicant_name: userInfo.name || '',
      }));
    }
  }, []);

  const handleProjectRequest = async () => {
    if (!newProject.project_code.trim()) {
      setError('请填写项目代号');
      return;
    }
    setRequestLoading(true);
    try {
      await projectAPI.request({
        project_code: newProject.project_code,
        project_name: newProject.project_name,
        applicant_name: formData.applicant_name || '匿名用户',
      });
      setNewProject({ project_code: '', project_name: '' });
      setShowProjectRequest(false);
      setError(null);
      // 刷新项目列表（包括 pending）
      const res = await projectAPI.getAll('approved,pending');
      setProjects((res as { data: ProjectItem[] }).data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '申请失败');
    } finally {
      setRequestLoading(false);
    }
  };

  const handleNumberTypeRequest = async () => {
    if (!newNumberType.type_code.trim()) {
      setError('请填写类型代码');
      return;
    }
    setRequestLoading(true);
    try {
      await numberTypeAPI.request({
        type_code: newNumberType.type_code,
        type_name: newNumberType.type_name,
        description: newNumberType.description,
        applicant_name: formData.applicant_name || '匿名用户',
      });
      setNewNumberType({ type_code: '', type_name: '', description: '' });
      setShowNumberTypeRequest(false);
      setError(null);
      // 刷新编号类型列表（包括 pending）
      const res = await numberTypeAPI.getAll('approved,pending');
      setNumberTypes((res as { data: NumberTypeItem[] }).data || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : '申请失败');
    } finally {
      setRequestLoading(false);
    }
  };

  // 复制编号到剪贴板
  const copyToClipboard = useCallback(async (number: string) => {
    try {
      await navigator.clipboard.writeText(number);
      setCopiedNumber(number);
      setTimeout(() => setCopiedNumber(null), 2000);
    } catch {
      // 降级方案
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

  // 倒计时逻辑
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
  }, [cooldownConfig]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.applicant_name || !formData.project_code || !formData.number_type) {
      setError('请填写所有必填字段');
      return;
    }

    if (!capToken) {
      setError('请完成人机验证');
      return;
    }

    // 倒计时检查
    if (isCoolingDown) {
      setError(`请等待 ${cooldownSeconds} 秒后可再次取号`);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);
    setResultApp(null);

    try {
      // 保存到 localStorage
      localStorage.setItem('userInfo', JSON.stringify({
        name: formData.applicant_name,
      }));

      const response = await applicationAPI.create({ ...formData, capToken } as { applicant_name: string; project_code: string; number_type: string; capToken: string });
      const resData = (response as { data: { full_number: string; id: number; number_type: string } }).data;
      const fullNumber = resData?.full_number || '申请成功';
      setResult(fullNumber);
      if (resData?.id) {
        setResultApp({ id: resData.id, number_type: resData.number_type });
      }

      // 通知父组件刷新列表
      if (onApplicationSubmitted) {
        onApplicationSubmitted();
      }

      // 启动倒计时
      startCooldown();

      // 清空表单和验证token
      setFormData(prev => ({
        ...prev,
        project_code: '',
        number_type: '',
      }));
      setCapToken(null);
      setCaptchaKey(prev => prev + 1); // 强制重置验证码组件
    } catch (err: unknown) {
      const error = err as { response?: { status: number; data?: { retryAfter?: number } }; message?: string };
      if (error.response?.status === 429) {
        const retryAfter = error.response?.data?.retryAfter || cooldownConfig;
        setError(`请求过于频繁，请等待 ${retryAfter} 秒后再次取号`);
        startCooldown(retryAfter);
      } else {
        setError(error.message || '提交申请失败');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="max-w-2xl mx-auto relative overflow-hidden border-2 border-primary/30 shadow-2xl shadow-primary/20">
      {/* 渐变背景装饰 */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-blue-500/5 pointer-events-none" />
      {/* 顶部装饰条 */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-blue-500 to-primary animate-pulse" />
      
      <CardHeader className="relative bg-gradient-to-r from-primary/10 via-blue-500/10 to-primary/10 border-b border-primary/20">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/20 border-2 border-primary/40 animate-pulse">
            <span className="text-2xl">📝</span>
          </div>
          <div>
            <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
              变更编号申请
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">DCP/CR/CN/TD取号</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="relative pt-6 px-4 sm:px-6 space-y-6">
        {error && (
          <div className="bg-gradient-to-r from-red-50 to-orange-50 border-2 border-destructive/40 text-destructive px-5 py-4 rounded-lg mb-4 shadow-md animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-start gap-2">
              <span className="text-xl">⚠️</span>
              <div className="flex-1 font-medium">{error}</div>
            </div>
          </div>
        )}
        {result && (
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400/60 text-green-700 px-3.5 sm:px-4 py-3 sm:py-3.5 rounded-lg mb-4 shadow-lg animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center justify-between gap-2.5">
              <div className="min-w-0 flex-1">
                <div className="text-[10px] sm:text-xs font-semibold text-green-800 uppercase tracking-wider flex items-center gap-1.5 select-none">
                  <span>✅</span>
                  <span>生成的编号</span>
                </div>
                <div className="font-bold text-sm sm:text-base text-green-900 mt-1 font-mono tracking-wide whitespace-nowrap select-all" title={result}>
                  {result}
                </div>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8.5 w-8.5 p-0 shrink-0 border-green-400 hover:bg-green-100 hover:border-green-500 transition-all flex items-center justify-center"
                onClick={() => copyToClipboard(result)}
                title="点击复制"
              >
                {copiedNumber === result ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4 text-green-600" />
                )}
              </Button>
            </div>
            {copiedNumber === result && (
              <div className="text-[10px] text-green-700 mt-2 font-medium bg-green-100/50 px-2 py-0.5 rounded inline-block">
                ✓ 已复制到剪贴板
              </div>
            )}
            {resultApp?.number_type === 'DCP' && (
              <div className="mt-3 pt-3 border-t border-green-300/60">
                <Button
                  type="button"
                  size="sm"
                  className="bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => dcpAPI.download(resultApp.id)}
                >
                  📄 下载 DCP《设计变更方案》
                </Button>
                <span className="text-[10px] text-green-700 ml-2 align-middle">
                  自动按管理员模板生成，已填充 DCP 编号
                </span>
              </div>
            )}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2 p-4 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 rounded-lg border border-blue-200/50">
            <label className="text-sm font-semibold leading-none flex items-center gap-2">
              <span className="text-lg">👤</span>
              <span>申请人姓名</span>
              <span className="text-destructive">*</span>
            </label>
            <Input
              value={formData.applicant_name}
              onChange={(e) => setFormData(prev => ({ ...prev, applicant_name: e.target.value }))}
              placeholder="请输入申请人姓名"
              required
              className="border-2 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-200 bg-white"
            />
          </div>

          <div className="space-y-2 p-4 bg-gradient-to-r from-purple-50/50 to-pink-50/50 rounded-lg border border-purple-200/50">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold leading-none flex items-center gap-2">
                <span className="text-lg">📁</span>
                <span>项目代号</span>
                <span className="text-destructive">*</span>
              </label>
              {(featureToggles.allow_request_project || isAdmin) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto px-3 py-1 text-xs border-purple-300 hover:bg-purple-100 hover:border-purple-400 transition-all"
                  onClick={() => setShowProjectRequest(!showProjectRequest)}
                >
                  {showProjectRequest ? '✕ 取消' : '+ 申请新项目'}
                </Button>
              )}
            </div>
            {showProjectRequest ? (
              <div className="space-y-3 p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-md shadow-inner">
                <Input
                  placeholder="项目代号 *"
                  value={newProject.project_code}
                  onChange={(e) => setNewProject(prev => ({ ...prev, project_code: e.target.value }))}
                  className="border-2 focus:border-orange-400"
                />
                <Input
                  placeholder="项目名称 (可选)"
                  value={newProject.project_name}
                  onChange={(e) => setNewProject(prev => ({ ...prev, project_name: e.target.value }))}
                  className="border-2 focus:border-orange-400"
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 border-0 shadow-md"
                  loading={requestLoading}
                  onClick={() => handleProjectRequest()}
                >
                  提交申请
                </Button>
              </div>
            ) : (
              <FilterableProjectSelector
                projects={projects}
                value={formData.project_code}
                onChange={(code) => setFormData(prev => ({ ...prev, project_code: code }))}
                placeholder="请选择项目"
              />
            )}
          </div>

          <div className="space-y-2 p-4 bg-gradient-to-r from-green-50/50 to-teal-50/50 rounded-lg border border-green-200/50">
            <div className="flex justify-between items-center">
              <label className="text-sm font-semibold leading-none flex items-center gap-2">
                <span className="text-lg">🏷️</span>
                <span>编号类型</span>
                <span className="text-destructive">*</span>
              </label>
              {(featureToggles.allow_request_number_type || isAdmin) && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-auto px-3 py-1 text-xs border-green-300 hover:bg-green-100 hover:border-green-400 transition-all"
                  onClick={() => setShowNumberTypeRequest(!showNumberTypeRequest)}
                >
                  {showNumberTypeRequest ? '✕ 取消' : '+ 申请新类型'}
                </Button>
              )}
            </div>
            {showNumberTypeRequest ? (
              <div className="space-y-3 p-4 bg-gradient-to-r from-orange-50 to-amber-50 border-2 border-orange-300 rounded-md shadow-inner">
                <Input
                  placeholder="类型代码 *"
                  value={newNumberType.type_code}
                  onChange={(e) => setNewNumberType(prev => ({ ...prev, type_code: e.target.value }))}
                  className="border-2 focus:border-orange-400"
                />
                <Input
                  placeholder="类型名称 (可选)"
                  value={newNumberType.type_name}
                  onChange={(e) => setNewNumberType(prev => ({ ...prev, type_name: e.target.value }))}
                  className="border-2 focus:border-orange-400"
                />
                <Input
                  placeholder="描述 (可选)"
                  value={newNumberType.description}
                  onChange={(e) => setNewNumberType(prev => ({ ...prev, description: e.target.value }))}
                  className="border-2 focus:border-orange-400"
                />
                <Button
                  type="button"
                  size="sm"
                  className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 border-0 shadow-md"
                  loading={requestLoading}
                  onClick={() => handleNumberTypeRequest()}
                >
                  提交申请
                </Button>
              </div>
            ) : (
              <Select
                value={formData.number_type}
                onValueChange={(value) => setFormData(prev => ({ ...prev, number_type: value }))}
              >
                <SelectTrigger className="border-2 focus:border-green-400 transition-all">
                  <SelectValue placeholder="请选择编号类型" />
                </SelectTrigger>
                <SelectContent>
                  {numberTypes.map(nt => (
                    <SelectItem key={nt.id} value={nt.type_code}>
                      {nt.type_code} - {nt.type_name} {nt.status === 'pending' ? '(待审核)' : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* 人机验证 */}
          <div className="space-y-2 p-4 bg-gradient-to-r from-yellow-50/50 to-amber-50/50 rounded-lg border border-yellow-200/50">
            <label className="text-sm font-semibold flex items-center gap-2">
              <span className="text-lg">🔒</span>
              <span>人机验证</span>
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
            className="w-full h-14 text-lg font-bold bg-gradient-to-r from-primary via-blue-600 to-primary hover:from-primary/90 hover:via-blue-700 hover:to-primary/90 shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5 transition-all duration-200 border-2 border-primary/50 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none" 
            disabled={isCoolingDown || loading || !capToken}
          >
            {isCoolingDown ? (
              <span className="flex items-center gap-2">
                <span className="animate-pulse">⏱️</span>
                <span>请等待 {cooldownSeconds}s 后可再次取号</span>
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <span>提交申请</span>
                <span className="text-xl">✨</span>
              </span>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
