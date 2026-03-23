import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './ProtectedRoute';
import LoginPage from '../pages/LoginPage';
import MainLayout from '../components/MainLayout';
import ImportPage from '../pages/ImportPage';
import ReviewPage from '../pages/ReviewPage';
import OcrPage from '../pages/OcrPage';
import ShipmentPage from '../pages/ShipmentPage';
import ArchivePage from '../pages/ArchivePage';

// 无权限页面
function UnauthorizedPage() {
  return <div style={{ padding: 48, textAlign: 'center' }}>权限不足，无法访问此页面。</div>;
}

// 档案详情页（独立路由，所有角色可访问）
function ArchiveDetailPage() {
  return <div>档案详情</div>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/unauthorized',
    element: <UnauthorizedPage />,
  },
  // 需要登录的路由，统一使用 MainLayout
  {
    element: (
      <ProtectedRoute allowedRoles={['operator', 'branch', 'general_affairs']}>
        <MainLayout />
      </ProtectedRoute>
    ),
    children: [
      // 运营人员路由
      {
        path: '/operator/import',
        element: (
          <ProtectedRoute allowedRoles={['operator']}>
            <ImportPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/operator/review',
        element: (
          <ProtectedRoute allowedRoles={['operator']}>
            <ReviewPage />
          </ProtectedRoute>
        ),
      },
      {
        path: '/operator/ocr',
        element: (
          <ProtectedRoute allowedRoles={['operator']}>
            <OcrPage />
          </ProtectedRoute>
        ),
      },
      // 分支机构路由
      {
        path: '/branch/shipment',
        element: (
          <ProtectedRoute allowedRoles={['branch']}>
            <ShipmentPage />
          </ProtectedRoute>
        ),
      },
      // 综合部路由
      {
        path: '/general-affairs/archive',
        element: (
          <ProtectedRoute allowedRoles={['general_affairs']}>
            <ArchivePage />
          </ProtectedRoute>
        ),
      },
      // 档案详情（所有已登录角色可访问）
      {
        path: '/archives/:id',
        element: (
          <ProtectedRoute allowedRoles={['operator', 'branch', 'general_affairs']}>
            <ArchiveDetailPage />
          </ProtectedRoute>
        ),
      },
    ],
  },
  // 根路径重定向到登录页
  {
    path: '/',
    element: <Navigate to="/login" replace />,
  },
]);
