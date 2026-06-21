import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ReviewPage } from '../pages/ReviewPage';
import * as services from '../services';
import { MemoryRouter } from 'react-router-dom';

const mockNavigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../services', () => ({
  projectAPI: {
    getPending: vi.fn(),
    review: vi.fn(),
  },
  numberTypeAPI: {
    getPending: vi.fn(),
    review: vi.fn(),
  },
}));

const renderWithRouter = (component: React.ReactElement) => {
  return render(
    <MemoryRouter>
      {component}
    </MemoryRouter>
  );
};

describe('ReviewPage 组件测试', () => {
  const mockPendingProjects = [
    {
      id: 1,
      project_code: 'NEW001',
      project_name: 'New Project 1',
      user_id: 'user1',
      created_at: '2024-01-01T10:00:00Z',
      status: 'pending',
    },
  ];

  const mockPendingNumberTypes = [
    {
      id: 1,
      type_code: 'NEW',
      type_name: 'New Type',
      description: 'Test description',
      user_id: 'user2',
      created_at: '2024-01-02T10:00:00Z',
      status: 'pending',
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('isAdmin', 'true');
    vi.mocked(services.projectAPI.getPending).mockResolvedValue({ data: mockPendingProjects });
    vi.mocked(services.numberTypeAPI.getPending).mockResolvedValue({ data: mockPendingNumberTypes });
  });

  it('应该正确渲染审核页面', async () => {
    renderWithRouter(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByText('审核管理')).toBeInTheDocument();
    });
  });

  it('应该加载待审核的项目申请', async () => {
    renderWithRouter(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByText('NEW001')).toBeInTheDocument();
    });
  });

  it('应该加载待审核的编号类型申请', async () => {
    renderWithRouter(<ReviewPage />);

    await waitFor(() => {
      const numberTypeTab = screen.getByText('编号类型审核');
      fireEvent.click(numberTypeTab);
    });

    await waitFor(() => {
      expect(screen.getByText('NEW')).toBeInTheDocument();
    });
  });

  it('应该显示审核备注输入框', async () => {
    renderWithRouter(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText('审核备注 (可选)')).toBeInTheDocument();
    });
  });

  it('应该显示通过和拒绝按钮', async () => {
    renderWithRouter(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByText('✓ 通过')).toBeInTheDocument();
      expect(screen.getByText('✗ 拒绝')).toBeInTheDocument();
    });
  });

  it('点击通过应该调用审核 API', async () => {
    vi.mocked(services.projectAPI.review).mockResolvedValue({ data: {} });

    renderWithRouter(<ReviewPage />);

    await waitFor(() => {
      const approveButton = screen.getByText('✓ 通过');
      fireEvent.click(approveButton);
    });

    await waitFor(() => {
      expect(services.projectAPI.review).toHaveBeenCalledWith(1, {
        status: 'approved',
        reviewer_note: '',
      });
    });
  });

  it('点击拒绝应该调用审核 API', async () => {
    vi.mocked(services.projectAPI.review).mockResolvedValue({ data: {} });

    renderWithRouter(<ReviewPage />);

    await waitFor(() => {
      const rejectButton = screen.getByText('✗ 拒绝');
      fireEvent.click(rejectButton);
    });

    await waitFor(() => {
      expect(services.projectAPI.review).toHaveBeenCalledWith(1, {
        status: 'rejected',
        reviewer_note: '',
      });
    });
  });

  it('应该支持输入审核备注', async () => {
    renderWithRouter(<ReviewPage />);

    await waitFor(() => {
      const noteInput = screen.getByPlaceholderText('审核备注 (可选)');
      fireEvent.change(noteInput, { target: { value: '审核通过' } });
    });

    const noteInput = screen.getByPlaceholderText('审核备注 (可选)');
    expect(noteInput).toHaveValue('审核通过');
  });

  it('审核成功后应该刷新列表', async () => {
    vi.mocked(services.projectAPI.review).mockResolvedValue({ data: {} });

    renderWithRouter(<ReviewPage />);

    await waitFor(() => {
      const approveButton = screen.getByText('✓ 通过');
      fireEvent.click(approveButton);
    });

    await waitFor(() => {
      expect(services.projectAPI.getPending).toHaveBeenCalledTimes(2); // 初始加载 + 审核后刷新
    });
  });

  it('无待审核申请时应显示空状态', async () => {
    vi.mocked(services.projectAPI.getPending).mockResolvedValue({ data: [] });
    vi.mocked(services.numberTypeAPI.getPending).mockResolvedValue({ data: [] });

    renderWithRouter(<ReviewPage />);

    await waitFor(() => {
      expect(screen.getByText('暂无待审核的项目申请')).toBeInTheDocument();
    });
  });

  it('应该显示待审核数量徽章', async () => {
    renderWithRouter(<ReviewPage />);

    await waitFor(() => {
      const projectTab = screen.getByText(/项目代号审核/);
      expect(projectTab).toHaveTextContent('1');
    });
  });

  it('非管理员应该被重定向到登录页', () => {
    localStorage.removeItem('isAdmin');
    mockNavigate.mockClear();

    renderWithRouter(<ReviewPage />);

    expect(mockNavigate).toHaveBeenCalledWith('/admin/login');
  });
});
