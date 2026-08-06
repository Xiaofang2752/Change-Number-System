import React, { useState, useEffect, useCallback, useRef } from 'react';
import { applicationAPI, projectAPI, numberTypeAPI, dcpAPI } from '../services';
import type { Project, NumberType, Application } from '../services';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatBeijingTime } from '@/utils/timezone';

const TECH_NUMBER_TYPES = ['QTD', 'DHF', 'SOP', 'SOFT', 'BOM', 'DRW', 'HISTORICAL'];

// DCP 自动填充模板下载功能：2026-08-07 当天起前台开放，此前隐藏该入口
const DCP_AUTO_FILL_ENABLED_FROM = '2026-08-07';
// 临时预览开关：测试期强制开放功能（正式上线前应置为 false，由上方日期控制）
const DCP_AUTO_FILL_FORCE_ENABLED = true;
const isDcpAutoFillEnabled =
  DCP_AUTO_FILL_FORCE_ENABLED || new Date() >= new Date(`${DCP_AUTO_FILL_ENABLED_FROM}T00:00:00`);

interface StatsData {
  total: number;
  byType?: Array<{ number_type: string; count: number }>;
}



export function ApplicationList() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState({
    keyword: '',
    project_code: '',
    number_type: '',
    start_date: '',
    end_date: '',
    applicant_name: '',
    ip_address: ''
  });
  const [stats, setStats] = useState<StatsData | null>(null);
  const isAdmin = localStorage.getItem('isAdmin') === 'true';
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // 高级筛选的候选数据
  const [projects, setProjects] = useState<Project[]>([]);
  const [numberTypes, setNumberTypes] = useState<NumberType[]>([]);

  // 复制状态
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);

  // 搜索防抖 ref
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      // 处理 end_date，添加结束时间 23:59:59
      const apiFilters = { ...filters };
      if (apiFilters.end_date) {
        apiFilters.end_date = apiFilters.end_date + ' 23:59:59';
      }

      const [appsRes, statsRes] = await Promise.all([
        applicationAPI.getAll({ ...apiFilters, exclude_type: TECH_NUMBER_TYPES.join(','), page: pagination.page, limit: pagination.limit }),
        applicationAPI.getStats(),
      ]);

      setApplications((appsRes as { data: { data: Application[]; pagination: typeof pagination } }).data?.data || []);
      setPagination((appsRes as { data: { data: Application[]; pagination: typeof pagination } }).data?.pagination || pagination);
      
      const rawStats = (statsRes as { data: StatsData }).data || null;
      if (rawStats) {
        const filteredByType = (rawStats.byType || []).filter(item => !TECH_NUMBER_TYPES.includes(item.number_type));
        const techCount = (rawStats.byType || []).filter(item => TECH_NUMBER_TYPES.includes(item.number_type)).reduce((sum, item) => sum + item.count, 0);
        setStats({
          ...rawStats,
          total: Math.max(0, rawStats.total - techCount),
          byType: filteredByType,
        });
      } else {
        setStats(null);
      }
    } catch (err) {
      console.error('加载数据失败', err);
    } finally {
      setLoading(false);
    }
  }, [filters.keyword, filters.project_code, filters.number_type, filters.start_date, filters.end_date, filters.applicant_name, filters.ip_address, pagination.page, pagination.limit]);
  
  // 加载高级筛选的候选数据
  const loadFilterOptions = useCallback(async () => {
    try {
      const [projectsRes, numberTypesRes] = await Promise.all([
        projectAPI.getAll('approved'),
        numberTypeAPI.getAll('approved'),
      ]);
      setProjects((projectsRes as { data: Project[] }).data || []);
      const rawTypes = (numberTypesRes as { data: NumberType[] }).data || [];
      setNumberTypes(rawTypes.filter(nt => !TECH_NUMBER_TYPES.includes(nt.type_code)));
    } catch (err) {
      console.error('加载筛选选项失败', err);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadFilterOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.keyword, filters.project_code, filters.number_type, filters.start_date, filters.end_date, filters.applicant_name, filters.ip_address, pagination.page, loadFilterOptions]);

  // 清理搜索防抖
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 重置到第一页
    setPagination(prev => ({ ...prev, page: 1 }));
    
    const value = e.target.value;
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setFilters(prev => ({ ...prev, keyword: value }));
    }, 300);
  };

  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  const handleExport = async () => {
    if (!isAdmin) return;
    try {
      await applicationAPI.exportCSV();
    } catch (err) {
      console.error('导出失败', err);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(applications.map(app => app.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectOne = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(i => i !== id));
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirm(`确定要删除选中的 ${selectedIds.length} 条记录吗？`)) return;

    try {
      await applicationAPI.batchDelete(selectedIds);
      setSelectedIds([]);
      loadData();
    } catch (err) {
      console.error('批量删除失败', err);
    }
  };

  // 复制编号到剪贴板
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

  // 检查记录是否应该高亮（30 秒内创建的记录）
  const isRecent = useCallback((createdAt: string) => {
    // SQLite 的 CURRENT_TIMESTAMP 是 UTC 时间，需要正确解析
    // 如果字符串不包含时区信息，添加 'Z' 表示 UTC
    const timeString = createdAt.endsWith('Z') ? createdAt : createdAt + 'Z';
    const recordTime = new Date(timeString).getTime();
    const now = Date.now();
    return (now - recordTime) < 30000;
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>申请记录</CardTitle>
          <div className="flex gap-2">
            {isAdmin && selectedIds.length > 0 && (
              <Button variant="destructive" size="sm" onClick={handleBatchDelete}>
                批量删除 ({selectedIds.length})
              </Button>
            )}
            {isAdmin && (
              <Button variant="default" onClick={handleExport}>
                导出 CSV
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <div className="bg-primary/10 p-4 rounded-lg text-center">
              <span className="block text-xs text-muted-foreground mb-1">总申请数</span>
              <span className="block text-2xl font-bold text-primary">{stats.total}</span>
            </div>
            {stats.byType?.map((item: { number_type: string; count: number }) => (
              <div key={item.number_type} className="bg-primary/10 p-4 rounded-lg text-center">
                <span className="block text-xs text-muted-foreground mb-1">{item.number_type}</span>
                <span className="block text-2xl font-bold text-primary">{item.count}</span>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 mb-6">
          <Input
            type="text"
            placeholder="搜索申请人/项目/编号..."
            value={filters.keyword}
            onChange={handleSearch}
            className="flex-1"
          />
          <Button variant="outline" size="sm" onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}>
            {showAdvancedFilters ? '收起筛选' : '高级筛选'}
          </Button>
        </div>

        {showAdvancedFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 mb-6 p-4 bg-muted/30 rounded-lg text-xs md:text-sm">
            <div className="space-y-2">
              <label className="text-sm font-medium">开始日期</label>
              <Input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
                className="w-full text-xs md:text-sm h-10 px-2 md:px-3"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">结束日期</label>
              <Input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
                className="w-full text-xs md:text-sm h-10 px-2 md:px-3"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">项目代号</label>
              <select
                value={filters.project_code}
                onChange={(e) => setFilters(prev => ({ ...prev, project_code: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-2 md:px-3 py-2 text-xs md:text-sm"
              >
                <option value="">所有项目</option>
                {projects.map(p => (
                  <option key={p.id} value={p.code}>{p.code} - {p.name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">编号类型</label>
              <select
                value={filters.number_type}
                onChange={(e) => setFilters(prev => ({ ...prev, number_type: e.target.value }))}
                className="flex h-10 w-full rounded-md border border-input bg-background px-2 md:px-3 py-2 text-xs md:text-sm"
              >
                <option value="">所有类型</option>
                {numberTypes.map(nt => (
                  <option key={nt.id} value={nt.type_code}>{nt.type_code} - {nt.type_name}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">申请人姓名</label>
              <Input
                type="text"
                placeholder="输入申请人姓名"
                value={filters.applicant_name}
                onChange={(e) => setFilters(prev => ({ ...prev, applicant_name: e.target.value }))}
                className="w-full text-xs md:text-sm h-10 px-2 md:px-3"
              />
            </div>
            {isAdmin && (
              <div className="space-y-2">
                <label className="text-sm font-medium">IP 地址</label>
                <Input
                  type="text"
                  placeholder="输入 IP 地址"
                  value={filters.ip_address}
                  onChange={(e) => setFilters(prev => ({ ...prev, ip_address: e.target.value }))}
                  className="w-full text-xs md:text-sm h-10 px-2 md:px-3"
                />
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="text-center py-10 text-muted-foreground">加载中...</div>
        ) : applications.length === 0 ? (
          <div className="text-center py-10 text-muted-foreground">暂无申请记录</div>
        ) : (
          <>
            {/* 移动端/窄屏卡片列表：在小屏幕或窄宽度下完全自适应，无需滚动条 */}
            <div className="md:hidden space-y-4 mb-6">
              {applications.map(app => {
                const recent = isRecent(app.created_at);
                return (
                  <div
                    key={app.id}
                    className={cn(
                      'p-4 rounded-xl border-2 transition-all hover:shadow-md bg-white space-y-3 relative overflow-hidden',
                      recent ? 'border-blue-500 bg-yellow-50/30' : 'border-border/60'
                    )}
                  >
                    {recent && (
                      <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(app.full_number)}
                        className="inline-flex items-center gap-1.5 group cursor-pointer hover:bg-muted rounded px-2 py-1 transition-colors"
                        title="点击复制"
                      >
                        <Badge variant="default" className="text-xs font-mono tracking-wide">{app.full_number}</Badge>
                        {copiedNumber === app.full_number ? (
                          <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-muted-foreground opacity-60 group-hover:opacity-100 transition-opacity shrink-0" />
                        )}
                      </button>
                      <Badge variant="secondary" className="text-[10px] md:text-xs">{app.number_type}</Badge>
                    </div>

                    {app.number_type === 'DCP' && isDcpAutoFillEnabled && app.dcp_template_id && (
                      <Button
                        type="button"
                        size="sm"
                        className="w-full bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => dcpAPI.download(app.id)}
                      >
                        📄 下载 DCP《设计变更方案》
                      </Button>
                    )}

                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground pt-1 border-t border-dashed border-border/80">
                      <div>
                        <span className="font-medium text-foreground">申请人:</span> {app.applicant_name}
                      </div>
                      <div>
                        <span className="font-medium text-foreground">项目代号:</span> {app.project_code}
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span>🕒</span>
                        <span>{formatBeijingTime(app.created_at)}</span>
                      </span>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center justify-between pt-2 border-t border-border/40">
                        <label className="flex items-center gap-2 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(app.id)}
                            onChange={(e) => handleSelectOne(app.id, e.target.checked)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                          <span className="text-xs">选择该项</span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 桌面端表格：在中大屏幕下正常以表格方式展示，保证大屏幕的最佳排版 */}
            <div className="hidden md:block overflow-x-auto rounded-md border mb-6">
              <table className="w-full">
                <thead className="bg-muted">
                  <tr>
                    {isAdmin && <th className="h-12 px-4 text-left font-medium w-12 whitespace-nowrap">
                      <input
                        type="checkbox"
                        onChange={handleSelectAll}
                        checked={applications.length > 0 && selectedIds.length === applications.length}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </th>}
                    <th className="h-12 px-4 text-left font-medium text-xs md:text-sm whitespace-nowrap">完整编号</th>
                    <th className="h-12 px-4 text-left font-medium text-xs md:text-sm whitespace-nowrap">申请人</th>
                    <th className="h-12 px-4 text-left font-medium text-xs md:text-sm whitespace-nowrap">项目代号</th>
                    <th className="h-12 px-4 text-left font-medium text-xs md:text-sm whitespace-nowrap">编号类型</th>
                        <th className="h-12 px-4 text-left font-medium text-xs md:text-sm whitespace-nowrap">操作</th>
                        <th className="h-12 px-4 text-left font-medium text-xs md:text-sm whitespace-nowrap">申请时间</th>
                  </tr>
                </thead>
                <tbody>
                  {applications.map(app => {
                    const recent = isRecent(app.created_at);
                    return (
                      <tr
                        key={app.id}
                        className={cn(
                          'border-b transition-colors hover:bg-muted/50',
                          recent && 'bg-yellow-50 border-l-4 border-l-blue-500'
                        )}
                      >
                        {isAdmin && (
                          <td className="p-4 text-xs md:text-sm whitespace-nowrap">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(app.id)}
                              onChange={(e) => handleSelectOne(app.id, e.target.checked)}
                              className="h-4 w-4 rounded border-gray-300"
                            />
                          </td>
                        )}
                        <td className="p-4 font-medium text-xs md:text-sm whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => copyToClipboard(app.full_number)}
                            className="inline-flex items-center gap-1.5 group cursor-pointer hover:bg-muted rounded px-1 py-0.5 transition-colors"
                            title="点击复制"
                          >
                            <Badge variant="default" className="text-xs md:text-sm">{app.full_number}</Badge>
                            {copiedNumber === app.full_number ? (
                              <Check className="h-3 w-3 text-green-600 shrink-0" />
                            ) : (
                              <Copy className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                            )}
                          </button>
                          {copiedNumber === app.full_number && (
                            <div className="text-xs text-green-600 mt-0.5">已复制</div>
                          )}
                        </td>
                        <td className="p-4 text-xs md:text-sm whitespace-nowrap">{app.applicant_name}</td>
                        <td className="p-4 text-xs md:text-sm whitespace-nowrap">{app.project_code}</td>
                        <td className="p-4 text-xs md:text-sm whitespace-nowrap">
                          <Badge variant="secondary" className="text-xs md:text-sm">{app.number_type}</Badge>
                        </td>
                        <td className="p-4 text-xs md:text-sm whitespace-nowrap">
                          {app.number_type === 'DCP' && isDcpAutoFillEnabled && app.dcp_template_id ? (
                            <Button
                              type="button"
                              size="sm"
                              className="bg-green-600 hover:bg-green-700 text-white whitespace-nowrap"
                              onClick={() => dcpAPI.download(app.id)}
                            >
                              📄 下载
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </td>
                        <td className="p-4 text-xs md:text-sm text-muted-foreground whitespace-nowrap">
                          {formatBeijingTime(app.created_at)}
                        </td>
                      </tr>
                    );
                  })}
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
                {pagination.page} / {pagination.totalPages || 1}
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
        )}
      </CardContent>
    </Card>
  );
}
