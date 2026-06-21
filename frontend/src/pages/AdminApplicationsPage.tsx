import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { applicationAPI, adminAPI } from '../services';
import type { Application } from '../services';
import { Layout } from '../components/Layout';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { formatBeijingTime } from '@/utils/timezone';
import { Trash2, ArrowUpDown, ArrowUp, ArrowDown, X } from 'lucide-react';

type SortField = 'created_at' | 'full_number' | 'applicant_name';
type SortOrder = 'ASC' | 'DESC' | '';

interface Filters {
  keyword: string;
  applicant_name: string;
  project_code: string;
  number_type: string;
  ip_address: string;
  start_date: string;
  end_date: string;
}

export function AdminApplicationsPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // 从 URL 参数初始化筛选条件
  const getInitialFilters = (): Filters => ({
    keyword: searchParams.get('keyword') || '',
    applicant_name: searchParams.get('applicant_name') || '',
    project_code: searchParams.get('project_code') || '',
    number_type: searchParams.get('number_type') || '',
    ip_address: searchParams.get('ip_address') || '',
    start_date: searchParams.get('start_date') || '',
    end_date: searchParams.get('end_date') || '',
  });

  const [activeTab, setActiveTab] = useState<'change_management' | 'technical_document'>(
    (searchParams.get('tab') as 'change_management' | 'technical_document') || 'change_management'
  );

  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: Number(searchParams.get('page')) || 1, limit: 20, total: 0, totalPages: 0 });
  const [filters, setFilters] = useState<Filters>(getInitialFilters);
  const [debouncedFilters, setDebouncedFilters] = useState<Filters>(getInitialFilters);
  const filterTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // 排序状态
  const [sortBy, setSortBy] = useState<SortField>(searchParams.get('sort_by') as SortField || 'created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>(searchParams.get('sort_order') as SortOrder || 'DESC');

  // 多选状态
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // 同步筛选参数到 URL（防抖）
  const syncFiltersToURL = useCallback((newFilters: Filters) => {
    const params = new URLSearchParams();
    params.set('tab', activeTab);
    if (newFilters.keyword) params.set('keyword', newFilters.keyword);
    if (newFilters.applicant_name) params.set('applicant_name', newFilters.applicant_name);
    if (newFilters.project_code) params.set('project_code', newFilters.project_code);
    if (newFilters.number_type) params.set('number_type', newFilters.number_type);
    if (newFilters.ip_address) params.set('ip_address', newFilters.ip_address);
    if (newFilters.start_date) params.set('start_date', newFilters.start_date);
    if (newFilters.end_date) params.set('end_date', newFilters.end_date);
    params.set('page', String(pagination.page));
    if (sortBy) params.set('sort_by', sortBy);
    if (sortOrder) params.set('sort_order', sortOrder);
    setSearchParams(params);
  }, [pagination.page, sortBy, sortOrder, activeTab, setSearchParams]);

  // 当防抖的筛选状态或标签变化时，同步到 URL
  useEffect(() => {
    syncFiltersToURL(debouncedFilters);
  }, [debouncedFilters, activeTab, syncFiltersToURL]);

  // 组件卸载时清理定时器
  useEffect(() => {
    return () => {
      if (filterTimerRef.current) {
        clearTimeout(filterTimerRef.current);
      }
    };
  }, []);

  // 检查管理员权限
  useEffect(() => {
    if (localStorage.getItem('isAdmin') !== 'true') {
      navigate('/admin/login');
      return;
    }
  }, [navigate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const apiFilters: any = {
        ...debouncedFilters,
        page: pagination.page,
        limit: pagination.limit,
        sort_by: sortBy,
        sort_order: sortOrder,
      };

      if (activeTab === 'change_management') {
        apiFilters.exclude_type = 'QTD,HISTORICAL';
      } else {
        apiFilters.number_type = debouncedFilters.number_type || 'QTD,HISTORICAL';
      }

      const res = await applicationAPI.getAll(apiFilters);
      const data = (res as { data: { data: Application[]; pagination: typeof pagination } }).data;
      setApplications(data?.data || []);
      setPagination(data?.pagination || pagination);
      // 分页/筛选变化时清空选中状态
      setSelectedIds([]);
    } catch (err) {
      console.error('加载数据失败', err);
    } finally {
      setLoading(false);
    }
  }, [debouncedFilters, pagination.page, pagination.limit, sortBy, sortOrder, activeTab]);

  // 加载数据
  useEffect(() => {
    loadData();
  }, [loadData]);

  // 切换标签
  const handleTabChange = (tab: 'change_management' | 'technical_document') => {
    setActiveTab(tab);
    setPagination(prev => ({ ...prev, page: 1 }));
    setSelectedIds([]);
    const clearedFilters = {
      keyword: '',
      applicant_name: '',
      project_code: '',
      number_type: '',
      ip_address: '',
      start_date: '',
      end_date: '',
    };
    setFilters(clearedFilters);
    setDebouncedFilters(clearedFilters);
  };

  // 单条删除
  const handleDelete = async (id: number, applicantName: string) => {
    if (!confirm(`确定要删除 "${applicantName}" 的申请记录吗？此操作不可撤销。`)) {
      return;
    }

    setDeletingId(id);
    try {
      await adminAPI.deleteApplication(id);
      loadData();
    } catch (err) {
      console.error('删除失败', err);
      alert('删除失败，请重试');
    } finally {
      setDeletingId(null);
    }
  };

  // 批量删除
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;

    if (!confirm(`确定要删除选中的 ${selectedIds.length} 条记录吗？此操作不可撤销。`)) {
      return;
    }

    setIsBulkDeleting(true);
    try {
      const res = await adminAPI.batchDeleteApplications(selectedIds);
      const deleted = (res as { data: { deleted: number } }).data?.deleted || 0;
      alert(`成功删除 ${deleted} 条记录`);
      setSelectedIds([]);
      loadData();
    } catch (err) {
      console.error('批量删除失败', err);
      alert('批量删除失败，请重试');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // 分页变化
  const handlePageChange = (newPage: number) => {
    setPagination(prev => ({ ...prev, page: newPage }));
  };

  // 关键字搜索
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPagination(prev => ({ ...prev, page: 1 }));
    const newFilters = { ...filters, keyword: e.target.value };
    setFilters(newFilters);
    
    // 清除之前的定时器
    if (filterTimerRef.current) {
      clearTimeout(filterTimerRef.current);
    }
    
    // 设置新的定时器，500ms 后同步到 URL 和加载数据
    filterTimerRef.current = setTimeout(() => {
      setDebouncedFilters(newFilters);
    }, 500);
  };

  // 筛选条件变化时更新 URL
  const updateFilter = (key: keyof Filters, value: string) => {
    setPagination(prev => ({ ...prev, page: 1 }));
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    
    // 清除之前的定时器
    if (filterTimerRef.current) {
      clearTimeout(filterTimerRef.current);
    }
    
    // 设置新的定时器，500ms 后同步到 URL 和加载数据
    filterTimerRef.current = setTimeout(() => {
      setDebouncedFilters(newFilters);
    }, 500);
  };

  // 清除单个筛选条件
  const clearFilter = (key: keyof Filters) => {
    setPagination(prev => ({ ...prev, page: 1 }));
    const newFilters = { ...filters, [key]: '' };
    setFilters(newFilters);
    setDebouncedFilters(newFilters);
    
    if (filterTimerRef.current) {
      clearTimeout(filterTimerRef.current);
    }
  };

  // 清除所有筛选条件
  const clearAllFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 }));
    const newFilters: Filters = {
      keyword: '',
      applicant_name: '',
      project_code: '',
      number_type: '',
      ip_address: '',
      start_date: '',
      end_date: '',
    };
    setFilters(newFilters);
    setDebouncedFilters(newFilters);
    
    if (filterTimerRef.current) {
      clearTimeout(filterTimerRef.current);
    }
  };

  // 排序切换
  const toggleSort = (field: SortField) => {
    let newOrder: SortOrder = 'DESC';
    if (sortBy === field) {
      if (sortOrder === 'DESC') newOrder = 'ASC';
      else if (sortOrder === 'ASC') newOrder = '';
      else newOrder = 'DESC';
    }

    setSortBy(field);
    setSortOrder(newOrder);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  // 获取排序图标
  const getSortIcon = (field: SortField) => {
    if (sortBy !== field) return <ArrowUpDown className="h-4 w-4 ml-1 inline" />;
    if (sortOrder === 'ASC') return <ArrowUp className="h-4 w-4 ml-1 inline" />;
    if (sortOrder === 'DESC') return <ArrowDown className="h-4 w-4 ml-1 inline" />;
    return <ArrowUpDown className="h-4 w-4 ml-1 inline" />;
  };

  // 全选/反选
  const toggleSelectAll = () => {
    if (selectedIds.length === applications.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(applications.map(app => app.id));
    }
  };

  // 选择/取消选择单行
  const toggleSelect = (id: number) => {
    if (selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(selectedId => selectedId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  // 检查是否全选
  const isAllSelected = applications.length > 0 && selectedIds.length === applications.length;

  // 检查是否有激活的筛选条件
  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  if (loading) {
    return (
      <Layout>
        <div className="min-h-screen flex items-center justify-center">加载中...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
          <h2 className="text-2xl font-bold text-gray-800">申请记录管理</h2>
          
          <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-sm w-fit">
            <button
              onClick={() => handleTabChange('change_management')}
              className={`px-4 py-2 text-xs font-bold rounded-lg transition-all duration-200 select-none ${
                activeTab === 'change_management'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              变更管理 (DCP/CR/CN/TD)
            </button>
            <button
              onClick={() => handleTabChange('technical_document')}
              className={`px-4.5 py-2 text-xs font-bold rounded-lg transition-all duration-200 select-none ${
                activeTab === 'technical_document'
                  ? 'bg-white text-primary shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              技术文件 (QTD/历史文档)
            </button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>
                {activeTab === 'change_management' ? '变更管理申请记录' : '技术文件申请/导入记录'}
              </CardTitle>
              {selectedIds.length > 0 && (
                <div className="flex items-center gap-3 bg-primary/10 px-4 py-2 rounded-lg animate-in fade-in slide-in-from-top-2">
                  <span className="text-sm font-medium text-primary">
                    已选择 {selectedIds.length} 项
                  </span>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    loading={isBulkDeleting}
                    className="gap-1"
                  >
                    <Trash2 className="h-3 w-3" />
                    批量删除
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedIds([])}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {/* 筛选区域 */}
            <div className="bg-gradient-to-r from-blue-50/50 to-indigo-50/50 p-4 rounded-lg border border-blue-200/50 mb-6 space-y-3">
              {/* 关键字搜索 */}
              <div className="flex gap-3">
                <Input
                  type="text"
                  placeholder="搜索申请人/项目/编号..."
                  value={filters.keyword}
                  onChange={handleSearch}
                  className="flex-1"
                />
              </div>

              {/* 高级筛选 */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                <Input
                  placeholder="申请人姓名"
                  value={filters.applicant_name}
                  onChange={(e) => updateFilter('applicant_name', e.target.value)}
                />
                <Input
                  placeholder="项目代号"
                  value={filters.project_code}
                  onChange={(e) => updateFilter('project_code', e.target.value)}
                />
                <Input
                  placeholder="编号类型"
                  value={filters.number_type}
                  onChange={(e) => updateFilter('number_type', e.target.value)}
                />
                <Input
                  placeholder="IP 地址"
                  value={filters.ip_address}
                  onChange={(e) => updateFilter('ip_address', e.target.value)}
                />
              </div>

              {/* 日期范围 */}
              <div className="flex gap-3 items-center">
                <Input
                  type="date"
                  value={filters.start_date}
                  onChange={(e) => updateFilter('start_date', e.target.value)}
                  className="max-w-[200px]"
                />
                <span className="text-muted-foreground">至</span>
                <Input
                  type="date"
                  value={filters.end_date}
                  onChange={(e) => updateFilter('end_date', e.target.value)}
                  className="max-w-[200px]"
                />
                {hasActiveFilters && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearAllFilters}
                    className="ml-auto"
                  >
                    <X className="h-3 w-3 mr-1" />
                    清除所有筛选
                  </Button>
                )}
              </div>

              {/* 筛选条件标签 */}
              {hasActiveFilters && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {filters.applicant_name && (
                    <Badge variant="secondary" className="gap-1">
                      申请人: {filters.applicant_name}
                      <button onClick={() => clearFilter('applicant_name')} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filters.project_code && (
                    <Badge variant="secondary" className="gap-1">
                      项目: {filters.project_code}
                      <button onClick={() => clearFilter('project_code')} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filters.number_type && (
                    <Badge variant="secondary" className="gap-1">
                      类型: {filters.number_type}
                      <button onClick={() => clearFilter('number_type')} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {filters.ip_address && (
                    <Badge variant="secondary" className="gap-1">
                      IP: {filters.ip_address}
                      <button onClick={() => clearFilter('ip_address')} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                  {(filters.start_date || filters.end_date) && (
                    <Badge variant="secondary" className="gap-1">
                      日期: {filters.start_date || '开始'} 至 {filters.end_date || '结束'}
                      <button onClick={() => { clearFilter('start_date'); clearFilter('end_date'); }} className="ml-1 hover:text-destructive">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )}
                </div>
              )}
            </div>

            {applications.length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">暂无申请记录</div>
            ) : (
              <>
                <div className="overflow-x-auto rounded-md border mb-6">
                  <table className="w-full">
                    <thead className="bg-muted">
                      <tr>
                        <th className="h-12 px-4 text-left font-medium whitespace-nowrap w-12">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={toggleSelectAll}
                          />
                        </th>
                        <th className="h-12 px-4 text-left font-medium whitespace-nowrap">完整编号</th>
                        <th
                          className="h-12 px-4 text-left font-medium whitespace-nowrap cursor-pointer hover:bg-muted/80 transition-colors select-none"
                          onClick={() => toggleSort('applicant_name')}
                        >
                          <span className="flex items-center">
                            申请人
                            {getSortIcon('applicant_name')}
                          </span>
                        </th>
                        <th className="h-12 px-4 text-left font-medium whitespace-nowrap">项目代号</th>
                        <th className="h-12 px-4 text-left font-medium whitespace-nowrap">编号类型</th>
                        <th
                          className="h-12 px-4 text-left font-medium whitespace-nowrap cursor-pointer hover:bg-muted/80 transition-colors select-none"
                          onClick={() => toggleSort('created_at')}
                        >
                          <span className="flex items-center">
                            申请时间
                            {getSortIcon('created_at')}
                          </span>
                        </th>
                        <th className="h-12 px-4 text-left font-medium whitespace-nowrap">IP 地址</th>
                        <th className="h-12 px-4 text-left font-medium whitespace-nowrap">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {applications.map(app => (
                        <tr key={app.id} className="border-b hover:bg-muted/50 transition-colors">
                          <td className="p-4 whitespace-nowrap">
                            <Checkbox
                              checked={selectedIds.includes(app.id)}
                              onCheckedChange={() => toggleSelect(app.id)}
                            />
                          </td>
                          <td className="p-4 whitespace-nowrap">
                            <Badge variant="default">{app.full_number}</Badge>
                          </td>
                          <td className="p-4 whitespace-nowrap">{app.applicant_name}</td>
                          <td className="p-4 whitespace-nowrap">{app.project_code}</td>
                          <td className="p-4 whitespace-nowrap">
                            <Badge variant="secondary">{app.number_type}</Badge>
                          </td>
                          <td className="p-4 text-muted-foreground whitespace-nowrap">
                            {formatBeijingTime(app.created_at)}
                          </td>
                          <td className="p-4 text-muted-foreground whitespace-nowrap">{app.ip_address || '-'}</td>
                          <td className="p-4 whitespace-nowrap">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(app.id, app.applicant_name)}
                              loading={deletingId === app.id}
                              className="gap-1"
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
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
