/**
 * 权限校验中间件单元测试
 * 覆盖 authorize 中间件的各种场景
 */

import { describe, it, expect, vi } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import { authorize } from '../../src/middlewares/authorize';
import type { JwtPayload } from '../../src/services/AuthService';
// 引入 auth 中间件以加载 Express.Request 的类型扩展
import '../../src/middlewares/auth';

/** 创建模拟的 Request 对象 */
function mockRequest(user?: JwtPayload): Partial<Request> {
  const req: Partial<Request> = {};
  (req as any).user = user;
  return req;
}

/** 创建模拟的 Response 对象 */
function mockResponse(): Partial<Response> & { statusCode?: number; body?: unknown } {
  const res: Partial<Response> & { statusCode?: number; body?: unknown } = {};
  res.status = vi.fn().mockImplementation((code: number) => {
    res.statusCode = code;
    return res as Response;
  });
  res.json = vi.fn().mockImplementation((data: unknown) => {
    res.body = data;
    return res as Response;
  });
  return res;
}

describe('authorize 中间件', () => {
  it('用户具有所需权限时应调用 next()', () => {
    const middleware = authorize('import');
    const req = mockRequest({ userId: '1', username: 'op', role: 'operator' });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('用户具有多个所需权限时应调用 next()', () => {
    const middleware = authorize('import', 'search', 'review');
    const req = mockRequest({ userId: '1', username: 'op', role: 'operator' });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('用户缺少所需权限时应返回 403', () => {
    const middleware = authorize('import');
    const req = mockRequest({ userId: '1', username: 'br', role: 'branch' });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.body).toEqual({
      code: 'PERMISSION_DENIED',
      message: '权限不足',
    });
  });

  it('用户缺少部分所需权限时应返回 403', () => {
    // branch 角色有 confirm_shipment 但没有 import
    const middleware = authorize('confirm_shipment', 'import');
    const req = mockRequest({ userId: '1', username: 'br', role: 'branch' });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('请求中无用户信息时应返回 401', () => {
    const middleware = authorize('import');
    const req = mockRequest(undefined);
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.body).toEqual({
      code: 'UNAUTHORIZED',
      message: '未提供认证令牌',
    });
  });

  it('分支机构用户应有 confirm_shipment 权限', () => {
    const middleware = authorize('confirm_shipment');
    const req = mockRequest({ userId: '1', username: 'br', role: 'branch', branchName: '上海营业部' });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('综合部用户应有 confirm_archive 权限', () => {
    const middleware = authorize('confirm_archive');
    const req = mockRequest({ userId: '1', username: 'ga', role: 'general_affairs' });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('综合部用户不应有 import 权限', () => {
    const middleware = authorize('import');
    const req = mockRequest({ userId: '1', username: 'ga', role: 'general_affairs' });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('不传权限参数时任何已认证用户都应通过', () => {
    const middleware = authorize();
    const req = mockRequest({ userId: '1', username: 'br', role: 'branch' });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('运营人员应有 confirm_received 权限', () => {
    const middleware = authorize('confirm_received');
    const req = mockRequest({ userId: '1', username: 'op', role: 'operator' });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('运营人员应有 review_reject 权限', () => {
    const middleware = authorize('review_reject');
    const req = mockRequest({ userId: '1', username: 'op', role: 'operator' });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('运营人员应有 confirm_shipped_back 权限', () => {
    const middleware = authorize('confirm_shipped_back');
    const req = mockRequest({ userId: '1', username: 'op', role: 'operator' });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).toHaveBeenCalledOnce();
  });

  it('分支机构用户不应有 confirm_received 权限', () => {
    const middleware = authorize('confirm_received');
    const req = mockRequest({ userId: '1', username: 'br', role: 'branch', branchName: '上海营业部' });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('综合部用户不应有 review_reject 权限', () => {
    const middleware = authorize('review_reject');
    const req = mockRequest({ userId: '1', username: 'ga', role: 'general_affairs' });
    const res = mockResponse();
    const next = vi.fn();

    middleware(req as Request, res as Response, next as NextFunction);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
