import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Form, Input, Button, Card, App } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useAuth } from '../hooks/useAuth';
import type { LoginRequest, LoginResponse } from '@shared/types';
import apiClient from '../api/client';
import axios from 'axios';

/** 根据角色返回登录后的默认首页路径 */
function getDefaultPath(role: string): string {
  switch (role) {
    case 'operator':
      return '/operator/import';
    case 'branch':
      return '/branch/shipment';
    case 'general_affairs':
      return '/general-affairs/archive';
    default:
      return '/login';
  }
}

export default function LoginPage() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  // 已登录则跳转到对应首页
  if (isAuthenticated && user) {
    navigate(getDefaultPath(user.role), { replace: true });
    return null;
  }

  const onFinish = async (values: LoginRequest) => {
    setLoading(true);
    try {
      const res = await apiClient.post<LoginResponse>('/auth/login', values);
      const { token, user: userInfo } = res.data;
      login(token, {
        id: userInfo.id,
        username: userInfo.username,
        role: userInfo.role,
        branchName: userInfo.branchName,
        permissions: [], // useAuth 内部会根据角色补充
      });
      message.success('登录成功');
      navigate(getDefaultPath(userInfo.role), { replace: true });
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : '登录失败，请检查用户名和密码';
      message.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f0f2f5' }}>
      <Card title="档案管理系统" style={{ width: 380 }} styles={{ header: { textAlign: 'center', fontSize: 20 } }}>
        <Form name="login" onFinish={onFinish} autoComplete="off" size="large">
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
