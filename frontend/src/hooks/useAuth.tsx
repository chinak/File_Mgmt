import { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import type { UserRole, Permission } from '@shared/types';

/** 认证上下文中的用户信息 */
export interface AuthUser {
  id: string;
  username: string;
  role: UserRole;
  branchName?: string;
  permissions: Permission[];
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  loading: boolean;
  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'archive_auth_token';
const USER_KEY = 'archive_auth_user';

/** 角色-权限映射表 */
const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  operator: ['import', 'search', 'review', 'return_branch', 'transfer_general', 'upload_scan', 'ocr'],
  branch: ['view_own_archives', 'confirm_shipment'],
  general_affairs: ['confirm_archive'],
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // 初始化时从 localStorage 恢复登录状态
  useEffect(() => {
    try {
      const savedToken = localStorage.getItem(TOKEN_KEY);
      const savedUser = localStorage.getItem(USER_KEY);
      if (savedToken && savedUser) {
        const parsed = JSON.parse(savedUser) as AuthUser;
        // 确保 permissions 与角色一致
        parsed.permissions = ROLE_PERMISSIONS[parsed.role] ?? [];
        setToken(savedToken);
        setUser(parsed);
      }
    } catch {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback((newToken: string, newUser: AuthUser) => {
    // 补充权限信息
    newUser.permissions = ROLE_PERMISSIONS[newUser.role] ?? [];
    setToken(newToken);
    setUser(newUser);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, isAuthenticated: !!token && !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

/** 获取认证上下文 */
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
