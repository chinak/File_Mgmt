/**
 * 权限校验中间件
 * 校验当前用户角色是否具有所需权限，需在 authenticate 中间件之后使用
 */
import { Request, Response, NextFunction } from 'express';
import type { Permission } from '../../shared/types';
/**
 * 权限校验中间件工厂函数
 * 接收所需权限列表，返回中间件函数
 * 校验当前用户角色是否具有所有所需权限
 * @param requiredPermissions - 执行该操作所需的权限列表
 */
export declare function authorize(...requiredPermissions: Permission[]): (req: Request, res: Response, next: NextFunction) => void;
//# sourceMappingURL=authorize.d.ts.map