import api from './api';
import axios from 'axios';

export interface Project {
  id: number;
  code: string;
  name: string;
  status: string;
  created_by?: string;
  created_at: string;
  approved_at?: string;
  project_code?: string;
  project_name?: string;
  user_id?: string;
}

export interface NumberType {
  id: number;
  type_code: string;
  type_name: string;
  description: string;
  status: string;
  created_by?: string;
  created_at: string;
  approved_at?: string;
  user_id?: string;
}

export interface TechnicalDocumentKeyword {
  id: number;
  keyword: string;
  description?: string;
  status: string;
  created_by?: string;
  created_at: string;
  approved_at?: string;
}

export interface Application {
  id: number;
  applicant_name: string;
  applicant_type?: string;
  document_name?: string;
  project_code: string;
  number_type: string;
  category?: string;
  sub_category?: string;
  serial_number: number;
  full_number: string;
  source_number?: string;
  ip_address?: string;
  created_at: string;
  dcp_template_id?: number | null; // 申请时间当日或之前发布的 DCP 模板版本 id（用于判断是否可下载）
}


export interface ChangeProgress {
  id: number;
  project_code?: string;
  project_name?: string;
  cr_no: string;
  dcp_no: string;
  cn_no: string;
  change_description: string;
  affects_regulation: number; // 0 or 1
  regulation_content: string;
  cr_progress: string;
  cn_progress: string;
  created_at: string;
  updated_at: string;
}

export const projectAPI = {
  getAll: (status?: string) => {
    const params = status ? { status } : undefined;
    return api.get('/projects', { params });
  },
  getPending: () => api.get('/projects/requests'),
  create: (data: { code: string; name: string }) => api.post('/projects', data),
  update: (id: number, data: Partial<Project>) => api.put(`/projects/${id}`, data),
  delete: (id: number) => api.delete(`/projects/${id}`),
  request: (data: { project_code: string; project_name: string; applicant_name: string }) =>
    api.post('/projects/request', data),
  review: (id: number, data: { status: string; reviewer_note?: string }) =>
    api.put(`/projects/${id}/review`, data),
};

export const numberTypeAPI = {
  getAll: (status?: string) => {
    const params = status ? { status } : undefined;
    return api.get('/number-types', { params });
  },
  getPending: () => api.get('/number-types/requests'),
  create: (data: { type_code: string; type_name: string; description?: string }) =>
    api.post('/number-types', data),
  update: (id: number, data: Partial<NumberType>) => api.put(`/number-types/${id}`, data),
  delete: (id: number) => api.delete(`/number-types/${id}`),
  request: (data: { type_code: string; type_name: string; description?: string; applicant_name: string }) =>
    api.post('/number-types/request', data),
  review: (id: number, data: { status: string; reviewer_note?: string }) =>
    api.put(`/number-types/${id}/review`, data),
};

export const applicationAPI = {
  create: (data: { applicant_name: string; document_name?: string; project_code?: string; number_type?: string; category?: string; source_number?: string; applicant_type?: string; capToken?: string; confirmDuplicate?: boolean }) =>
    api.post('/applications', data),
  getAll: (params: { page?: number; limit?: number; keyword?: string; project_code?: string; number_type?: string; exclude_type?: string; category?: string; start_date?: string; end_date?: string; applicant_name?: string; ip_address?: string; sort_by?: string; sort_order?: string }) => api.get('/applications', { params }),
  update: (id: number, data: Partial<Application>) => api.put(`/applications/${id}`, data),
  getStats: () => api.get('/applications/stats'),
  delete: (id: number) => api.delete(`/applications/${id}`),
  batchDelete: (ids: number[]) => api.delete('/applications', { data: { ids } }),
  exportCSV: async () => {
    // 使用原始axios实例，绕过响应拦截器
    const token = localStorage.getItem('adminToken');
    const response = await axios.get('/api/applications/export', {
      responseType: 'blob',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `applications_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export const dcpAPI = {
  getTemplateMeta: () => api.get('/dcp/template'),
  uploadTemplate: (formData: FormData) =>
    api.post('/dcp/template', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        Authorization: localStorage.getItem('adminToken') ? `Bearer ${localStorage.getItem('adminToken')}` : '',
      },
    }),
  // 触发浏览器下载已填充的 DCP《设计变更方案》.docx（文件名由后端 Content-Disposition 指定）
  download: (id: number) => {
    const a = document.createElement('a');
    a.href = `/api/dcp/${id}`;
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  },
};

export const adminAPI = {
  login: (data: { username: string; password: string }) => api.post('/admin/login', data),
  logout: () => api.post('/admin/logout'),
  changePassword: (data: { currentPassword: string; newPassword: string }) => api.post('/admin/change-password', data),
  deleteApplication: (id: number) => api.delete(`/admin/applications/${id}`),
  batchDeleteApplications: (ids: number[]) => api.delete('/admin/applications/batch', { data: { ids } }),
};

export const technicalDocumentAPI = {
  getKeywords: (status?: string) => {
    const params = status ? { status } : undefined;
    return api.get('/technical-documents/keywords', { params });
  },
  createKeyword: (data: { keyword: string; description?: string }) => api.post('/technical-documents/keywords', data),
  updateKeyword: (id: number, data: Partial<TechnicalDocumentKeyword>) => api.put(`/technical-documents/keywords/${id}`, data),
  deleteKeyword: (id: number) => api.delete(`/technical-documents/keywords/${id}`),
  import: (data: { entries: string[]; applicant_name?: string; project_code?: string }) => api.post('/technical-documents/import', data),
};

export const settingsAPI = {
  getFeatureToggles: () => api.get('/settings/feature-toggles'),
  updateFeatureToggles: (data: { allow_request_project?: boolean; allow_request_number_type?: boolean }) =>
    api.put('/settings/feature-toggles', data),
  getCooldown: () => api.get('/settings/cooldown'),
  updateCooldown: (data: { cooldown_seconds: number }) =>
    api.put('/settings/cooldown', data),
};

export const changeProgressAPI = {
  getAll: (keyword?: string) => api.get('/change-progress', { params: { keyword } }),
  create: (data: Partial<ChangeProgress>) => api.post('/change-progress', data),
  update: (id: number, data: Partial<ChangeProgress>) => api.put(`/change-progress/${id}`, data),
  delete: (id: number) => api.delete(`/change-progress/${id}`),
  import: (data: { entries: Partial<ChangeProgress>[] }) =>
    api.post('/change-progress/import', data),
  exportCSV: async (keyword?: string) => {
    const token = localStorage.getItem('adminToken');
    const response = await axios.get('/api/change-progress/export', {
      responseType: 'blob',
      params: keyword ? { keyword } : undefined,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const date = new Date().toISOString().split('T')[0];
    link.setAttribute('download', `change_progress_${date}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  },
};

export interface Contributor {
  id: number;
  name: string;
  points: number;
  description?: string;
  created_at: string;
  updated_at: string;
}

export const contributorAPI = {
  getAll: () => api.get('/contributors'),
  create: (data: { name: string; points?: number; description?: string }) => api.post('/contributors', data),
  update: (id: number, data: Partial<Contributor>) => api.put(`/contributors/${id}`, data),
  delete: (id: number) => api.delete(`/contributors/${id}`),
};

// ===== 10 问 10 答管理 =====

export interface GuideQna {
  id?: number;
  sort_order: number;
  question: string;
  answer: string;
  status?: 'draft' | 'published';
  updated_at?: string;
}

export interface GuideQnaPublished {
  items: GuideQna[];
  published_at: string | null;
}

export interface GuideQnaHistory {
  id: number;
  version_label: string;
  content_hash_short: string;
  published_at: string;
}

export interface GuideQnaHistoryDetail {
  id: number;
  version_label: string;
  content_hash_short: string;
  published_at: string;
  items: { question: string; answer: string; sort_order: number }[];
}

export const guideQnaAPI = {
  getPublished: () => api.get('/guide-qna'),
  getDraft: () => api.get('/guide-qna/draft'),
  saveDraft: (data: { items: Partial<GuideQna>[] }) => api.put('/guide-qna/draft', data),
  publish: () => api.post('/guide-qna/publish', {}),
  getHistoryList: () => api.get('/guide-qna/history'),
  getHistoryDetail: (id: number) => api.get(`/guide-qna/history/${id}`),
  deleteHistory: (id: number) => api.delete(`/guide-qna/history/${id}`),
};

