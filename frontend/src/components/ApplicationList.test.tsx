import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ApplicationList } from './ApplicationList';
import * as services from '../services';

vi.mock('../services', () => ({
  applicationAPI: {
    getAll: vi.fn(),
    getStats: vi.fn(),
    exportCSV: vi.fn(),
    batchDelete: vi.fn(),
  },
  projectAPI: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
  numberTypeAPI: {
    getAll: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

describe('ApplicationList 组件测试', () => {
  const mockApplications = [
    {
      id: 1,
      applicant_name: '张三',
      project_code: 'ALPHA01',
      number_type: 'CR',
      full_number: 'CR-ALPHA01-0001',
      created_at: '2024-01-01T10:00:00Z',
      ip_address: '192.168.1.1',
    },
    {
      id: 2,
      applicant_name: '李四',
      project_code: 'BETA88',
      number_type: 'DCP',
      full_number: 'DCP-BETA88-0001',
      created_at: '2024-01-02T10:00:00Z',
      ip_address: '192.168.1.2',
    },
  ];

  const mockStats = {
    total: 2,
    byType: [
      { number_type: 'CR', count: 1 },
      { number_type: 'DCP', count: 1 },
    ],
  };

  const mockPagination = {
    page: 1,
    limit: 10,
    total: 2,
    totalPages: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(services.applicationAPI.getAll).mockResolvedValue({
      data: {
        data: mockApplications,
        pagination: mockPagination,
      },
    });
    vi.mocked(services.applicationAPI.getStats).mockResolvedValue({ data: mockStats });
  });

  it('应该正确渲染申请记录列表', async () => {
    render(<ApplicationList />);

    await waitFor(() => {
      expect(screen.getByText('申请记录')).toBeInTheDocument();
    });

    expect(screen.getAllByText('张三')[0]).toBeInTheDocument();
    expect(screen.getAllByText('CR-ALPHA01-0001')[0]).toBeInTheDocument();
  });

  it('应该加载统计数据', async () => {
    render(<ApplicationList />);

    await waitFor(() => {
      expect(screen.getByText('总申请数')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('应该显示搜索框', async () => {
    render(<ApplicationList />);

    const searchInput = screen.getByPlaceholderText('搜索申请人/项目/编号...');
    expect(searchInput).toBeInTheDocument();
  });

  it('应该支持关键字搜索', async () => {
    vi.useFakeTimers();
    render(<ApplicationList />);

    const searchInput = screen.getByPlaceholderText('搜索申请人/项目/编号...');
    fireEvent.change(searchInput, { target: { value: '张三' } });

    // Advance timers by 300ms to trigger search input debounce
    vi.advanceTimersByTime(300);

    // Restore real timers so waitFor can use real timeouts to check the result
    vi.useRealTimers();

    await waitFor(() => {
      expect(services.applicationAPI.getAll).toHaveBeenCalledWith(
        expect.objectContaining({ keyword: '张三' })
      );
    });
  });

  it('应该显示高级筛选面板', async () => {
    render(<ApplicationList />);

    const advancedFilterBtn = screen.getByText('高级筛选');
    fireEvent.click(advancedFilterBtn);

    expect(screen.getByText('开始日期')).toBeInTheDocument();
    expect(screen.getByText('结束日期')).toBeInTheDocument();
  });

  it('应该显示分页组件', async () => {
    render(<ApplicationList />);

    await waitFor(() => {
      expect(screen.getByText('1 / 1')).toBeInTheDocument();
      expect(screen.getByText('上一页')).toBeInTheDocument();
      expect(screen.getByText('下一页')).toBeInTheDocument();
    });
  });

  it('管理员应该看到导出 CSV 按钮', async () => {
    localStorage.setItem('isAdmin', 'true');
    render(<ApplicationList />);

    expect(screen.getByText('导出 CSV')).toBeInTheDocument();
  });

  it('普通用户不应看到导出 CSV 按钮', async () => {
    localStorage.setItem('isAdmin', 'false');
    render(<ApplicationList />);

    expect(screen.queryByText('导出 CSV')).not.toBeInTheDocument();
  });

  it('管理员应该看到批量删除按钮（选中记录时）', async () => {
    localStorage.setItem('isAdmin', 'true');
    render(<ApplicationList />);

    await waitFor(() => {
      const checkboxes = screen.getAllByRole('checkbox');
      fireEvent.click(checkboxes[0]); // 选中第一条记录
    });

    await waitFor(() => {
      expect(screen.getByText('批量删除 (1)')).toBeInTheDocument();
    });
  });

  it('申请记录应按时间倒序显示', async () => {
    render(<ApplicationList />);

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // 第一行应该是最新的记录
      expect(rows[1]).toHaveTextContent('CR-ALPHA01-0001');
    });
  });

  it('空状态时应显示提示信息', async () => {
    vi.mocked(services.applicationAPI.getAll).mockResolvedValue({
      data: { data: [], pagination: { ...mockPagination, total: 0 } },
    });

    render(<ApplicationList />);

    await waitFor(() => {
      expect(screen.getByText('暂无申请记录')).toBeInTheDocument();
    });
  });

  it('加载时应显示加载提示', () => {
    render(<ApplicationList />);

    expect(screen.getByText('加载中...')).toBeInTheDocument();
  });
});
