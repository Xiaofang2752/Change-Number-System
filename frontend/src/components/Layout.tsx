import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ShieldCheck, LogOut, LayoutDashboard, Database, Settings, LogIn, FileText, TrendingUp, Award } from 'lucide-react';
import { Button } from './ui/button';

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const location = useLocation();
  const isAdmin = localStorage.getItem('isAdmin') === 'true';

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('isAdmin');
    window.location.href = '/';
  };

  const navItems = isAdmin ? [
    { label: '控制面板', path: '/admin/dashboard', icon: LayoutDashboard },
    { label: '申请管理', path: '/admin/applications', icon: FileText },
    { label: '项目管理', path: '/admin/projects', icon: Database },
    { label: '编号类型', path: '/admin/number-types', icon: Settings },
    { label: '技术文件', path: '/admin/technical-documents', icon: FileText },
    { label: '人工审核', path: '/admin/review', icon: ShieldCheck },
    { label: '变更进度', path: '/admin/change-progress', icon: TrendingUp },
    { label: '贡献者', path: '/admin/contributors', icon: Award },
  ] : [];

  return (
    <div className="min-h-screen flex flex-col">
      {/* Decorative Background Pattern */}
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 rounded-full blur-3xl opacity-60" />
        <div className="absolute top-1/2 -right-24 w-96 h-96 bg-accent/5 rounded-full blur-3xl opacity-60" />
      </div>

      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link to="/" className="flex items-center gap-3 group">
                <img
                  src="/company-logo.svg"
                  alt="公司 Logo"
                  className="h-10 w-auto max-w-[120px] rounded-lg border border-slate-200 shadow-sm transition-transform group-hover:scale-105 object-contain"
                />
                <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600">
                  自动取号系统
                </h1>
              </Link>
            </div>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link key={item.path} to={item.path}>
                  <Button
                    variant={location.pathname === item.path ? 'secondary' : 'ghost'}
                    size="sm"
                    className="gap-2"
                  >
                    <item.icon size={16} />
                    {item.label}
                  </Button>
                </Link>
              ))}
            </nav>

            <div className="flex items-center gap-3">
              {isAdmin ? (
                <div className="flex items-center gap-2">
                  <div className="hidden lg:block text-right mr-2">
                    <p className="text-xs font-semibold text-slate-900">管理员模式</p>
                    <p className="text-[10px] text-success">系统已授权</p>
                  </div>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="gap-2 shadow-lg shadow-destructive/10"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} />
                    <span className="hidden sm:inline">退出</span>
                  </Button>
                </div>
              ) : (
                <Link to="/admin/login">
                  <Button variant="outline" size="sm" className="gap-2 border-primary/20 hover:bg-primary/5 text-primary">
                    <LogIn size={16} />
                    <span>管理员登录</span>
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="flex-grow pt-16">
        {children}
      </main>

      <footer className="bg-white border-t py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            <p className="text-xs text-muted-foreground">
              © {new Date().getFullYear()} 自动取号系统
            </p>
            <span className="text-xs text-muted-foreground">版本 {import.meta.env.VITE_APP_VERSION || 'v1.0'}</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
