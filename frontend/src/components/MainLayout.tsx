import { useMemo } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, App } from 'antd';
import {
  UploadOutlined,
  AuditOutlined,
  ScanOutlined,
  SendOutlined,
  InboxOutlined,
  LogoutOutlined,
} from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '@shared/types';
import type { MenuProps } from 'antd';

const { Header, Content, Sider } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

/** 各角色对应的菜单配置 */
const ROLE_MENUS: Record<UserRole, MenuItem[]> = {
  operator: [
    { key: '/operator/import', icon: <UploadOutlined />, label: '数据导入' },
    { key: '/operator/review', icon: <AuditOutlined />, label: '审核分发' },
    { key: '/operator/ocr', icon: <ScanOutlined />, label: 'OCR 识别' },
  ],
  branch: [
    { key: '/branch/shipment', icon: <SendOutlined />, label: '寄送确认' },
  ],
  general_affairs: [
    { key: '/general-affairs/archive', icon: <InboxOutlined />, label: '归档确认' },
  ],
};

/** 角色中文名称 */
const ROLE_LABELS: Record<UserRole, string> = {
  operator: '运营人员',
  branch: '分支机构',
  general_affairs: '综合部',
};

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { message } = App.useApp();

  const menuItems = useMemo(() => {
    if (!user) return [];
    return ROLE_MENUS[user.role] ?? [];
  }, [user]);

  const onMenuClick: MenuProps['onClick'] = ({ key }) => {
    navigate(key);
  };

  const handleLogout = () => {
    logout();
    message.success('已退出登录');
    navigate('/login', { replace: true });
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider breakpoint="lg" collapsedWidth={80}>
        <div style={{ height: 48, margin: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ color: '#fff', fontSize: 16, fontWeight: 500, whiteSpace: 'nowrap' }}>档案管理系统</span>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={onMenuClick}
        />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 16, borderBottom: '1px solid #f0f0f0' }}>
          {user && (
            <span style={{ marginRight: 'auto' }}>
              {user.username}（{ROLE_LABELS[user.role]}）
            </span>
          )}
          <Button icon={<LogoutOutlined />} onClick={handleLogout}>
            退出
          </Button>
        </Header>
        <Content style={{ margin: 24 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
