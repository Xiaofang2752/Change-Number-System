import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { Home } from './pages/Home';
import { GuideTenQnA } from './pages/GuideTenQnA';
import { TechnicalDocumentPage } from './pages/TechnicalDocumentPage';
import { ChangeManagementPage } from './pages/ChangeManagementPage';
import { AdminLogin } from './pages/AdminLogin';
import { AdminDashboard } from './pages/AdminDashboard';
import { ReviewPage } from './pages/ReviewPage';
import { ProjectsPage } from './pages/ProjectsPage';
import { NumberTypesPage } from './pages/NumberTypesPage';
import { AdminTechnicalDocumentPage } from './pages/AdminTechnicalDocumentPage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { AdminApplicationsPage } from './pages/AdminApplicationsPage';
import { AdminChangeProgressPage } from './pages/AdminChangeProgressPage';
import { AdminContributorsPage } from './pages/AdminContributorsPage';
import { ProtectedRoute } from './components/ProtectedRoute';

function App() {
  return (
    <AppProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/change-management" element={<ChangeManagementPage />} />
          <Route path="/technical-document" element={<TechnicalDocumentPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/guide/ten-qna" element={<GuideTenQnA />} />
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/review"
            element={
              <ProtectedRoute>
                <ReviewPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/projects"
            element={
              <ProtectedRoute>
                <ProjectsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/number-types"
            element={
              <ProtectedRoute>
                <NumberTypesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/technical-documents"
            element={
              <ProtectedRoute>
                <AdminTechnicalDocumentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/change-password"
            element={
              <ProtectedRoute>
                <ChangePasswordPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/applications"
            element={
              <ProtectedRoute>
                <AdminApplicationsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/change-progress"
            element={
              <ProtectedRoute>
                <AdminChangeProgressPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/contributors"
            element={
              <ProtectedRoute>
                <AdminContributorsPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Router>
    </AppProvider>
  );
}

export default App;
