# 实现计划：档案管理系统重构

## 概述

本次重构的核心变更：将3个状态字段（status / branch_return_status / archive_status）合并为2个（status / archive_status），主流程状态扩展为8个状态值 + completed 终态，综合部归档状态新增 archive_not_started，新增 confirm_received / review_reject / confirm_shipped_back 三个操作，实现审核不通过循环回退逻辑，所有前端页面改为批量操作模式。

由于是已有系统重构，按依赖关系从底层到上层逐步修改：类型定义 → 数据库 schema → 状态机 → 业务逻辑 → API 层 → 前端页面。

**重要：数据库 schema 变更后需删除旧数据库文件 `backend/data/archive.db*` 并重建。**

## 任务列表

- [x] 1. 重构共享类型定义
  - [x] 1.1 重构 `shared/types.ts` 中的类型与枚举
    - 删除 `BranchReturnStatus` 类型及 `BRANCH_RETURN_STATUSES` 常量
    - 修改 `MainStatus` 为8个状态值：`pending_shipment`、`in_transit`、`hq_received`、`review_passed`、`review_rejected`、`pending_return`、`return_in_transit`、`branch_received`
    - 修改 `ArchiveSubStatus` 为4个状态值：`archive_not_started`、`pending_transfer`、`pending_archive`、`archived`
    - 修改 `TransitionAction` 新增 `confirm_received`、`review_reject`、`confirm_shipped_back` 三个操作
    - 修改 `ArchiveRecord` 接口：删除 `branchReturnStatus` 字段，`status` 类型改为 `MainStatus | 'completed' | null`
    - 修改 `ArchiveQueryParams` 接口：删除 `branchReturnStatus` 字段
    - 更新 `Permission` 类型：新增 `confirm_received`、`review_reject`、`confirm_shipped_back` 权限
    - 更新 `MAIN_STATUSES`、`ARCHIVE_SUB_STATUSES`、`TRANSITION_ACTIONS` 常量数组
    - _需求: 2.2, 2.3, 2.4, 2.5_

- [x] 2. 重构数据库 schema 与数据访问层
  - [x] 2.1 重构 `backend/src/database-init.ts` 数据库表结构
    - 删除 `archive_records` 表的 `branch_return_status` 列及其索引
    - 修改 `status` 列的 CHECK 约束为新的8个状态值 + `completed`
    - 修改 `archive_status` 列的 CHECK 约束为4个状态值（含 `archive_not_started`），默认值改为 `archive_not_started`
    - 删除 `idx_branch_return_status` 索引
    - _需求: 2.1, 2.3, 2.4_
  - [x] 2.2 重构 `backend/src/models/ArchiveRepository.ts` 数据访问层
    - 删除 `ArchiveRow` 中的 `branch_return_status` 字段
    - 修改 `rowToRecord` 函数：删除 `branchReturnStatus` 映射
    - 修改 `CreateArchiveInput`：删除 `branchReturnStatus` 字段
    - 修改 `UpdateArchiveInput`：删除 `branchReturnStatus` 字段
    - 修改 `create` 方法的 INSERT 语句：删除 `branch_return_status` 列
    - 修改 `update` 方法：删除 `branchReturnStatus` 相关逻辑
    - 修改 `queryWithPagination` 方法：删除 `branchReturnStatus` 查询条件
    - _需求: 2.1_
  - [x] 2.3 更新 `backend/tests/unit/database.test.ts` 和 `backend/tests/unit/repositories.test.ts`
    - 更新测试中所有涉及 `branchReturnStatus` / `branch_return_status` 的断言和测试数据
    - 更新初始状态相关断言：纸质版 archive_status 改为 `archive_not_started`
    - _需求: 2.1_

- [x] 3. 检查点 - 类型定义与数据层验证
  - 确保所有测试通过，如有问题请向用户确认。
  - **用户需删除旧数据库文件 `backend/data/archive.db*` 后重启后端以重建数据库。**

- [-] 4. 重构状态机引擎
  - [x] 4.1 重构 `backend/src/services/StateMachineService.ts` 状态机核心逻辑
    - 删除 `BRANCH_RETURN_TRANSITIONS` 分支回寄状态转换表
    - 重写 `MAIN_STATUS_TRANSITIONS` 为8个状态的完整转换表：pending_shipment→[confirm_shipment]→in_transit→[confirm_received]→hq_received→[review_pass]→review_passed / [review_reject]→review_rejected；review_passed/review_rejected→[return_branch]→pending_return→[confirm_shipped_back]→return_in_transit→[confirm_return_received]→branch_received
    - 重写 `ARCHIVE_STATUS_TRANSITIONS`：新增 `archive_not_started` 状态（review_pass 时自动激活为 pending_transfer）
    - 更新 `ACTION_ROLE_MAP`：新增 `confirm_received`→operator、`review_reject`→operator、`confirm_shipped_back`→operator
    - 重写 `ACTION_STATUS_FIELD_MAP`：所有操作（除 transfer_general 和 confirm_archive）都作用于 `status` 字段
    - 实现 `review_pass` 联动逻辑：status 从 hq_received→review_passed 的同时，archive_status 从 archive_not_started→pending_transfer
    - 实现 `confirm_return_received` 的自动判断逻辑：branch_received 后根据 archive_status 自动回退（archive_not_started→pending_shipment）或完结（archived→completed）
    - 重写 `isFullyCompleted`：判断 `status === 'completed'`
    - 删除 `transitionBranchReturnStatus` 方法，所有主流程操作统一走 `transitionMainStatus`
    - 删除审核前置条件中对 `reviewed_pending_dispatch` 的检查（旧逻辑），改为由状态转换表自然约束
    - _需求: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  - [x] 4.2 重构 `backend/tests/unit/stateMachine.test.ts` 状态机测试
    - 删除所有 `BRANCH_RETURN_TRANSITIONS` 相关测试
    - 删除所有 `branchReturnStatus` 相关测试用例
    - 新增8个主流程状态的完整转换测试（含 hq_received、review_passed、review_rejected、pending_return、return_in_transit、branch_received）
    - 新增 `confirm_received`、`review_reject`、`confirm_shipped_back` 操作的测试
    - 新增 `review_pass` 联动 archive_status 的测试
    - 新增 `confirm_return_received` 自动判断逻辑的测试（回退到 pending_shipment / 完结为 completed）
    - 新增 `isFullyCompleted` 基于 `status === 'completed'` 的测试
    - 更新辅助函数 `makePaperRecord`：删除 `branchReturnStatus`，`archiveStatus` 默认值改为 `archive_not_started`
    - _需求: 7.1, 7.5, 7.6, 7.7_
  - [ ]* 4.3 编写属性测试：主流程状态机合法转换
    - **Property 10: 主流程状态机合法转换**
    - **验证: 需求 4.2, 4.3, 5.2, 5.5, 5.6, 7.1, 7.5**
  - [ ]* 4.4 编写属性测试：审核操作对 archive_status 的联动
    - **Property 11: 审核操作对 archive_status 的联动**
    - **验证: 需求 5.3, 5.4, 7.8**
  - [ ]* 4.5 编写属性测试：综合部归档状态机合法转换
    - **Property 12: 综合部归档状态机合法转换**
    - **验证: 需求 5.7, 6.2, 6.5, 7.2**
  - [ ]* 4.6 编写属性测试：审核不通过循环回退
    - **Property 8: 审核不通过循环回退**
    - **验证: 需求 2.9, 7.7, 7.8**
  - [ ]* 4.7 编写属性测试：完全完结判定与保护
    - **Property 7: 完全完结判定与保护**
    - **验证: 需求 2.8, 5.11, 6.4, 7.6**
  - [ ]* 4.8 编写属性测试：电子版合同不可变更
    - **Property 14: 电子版合同不可变更**
    - **验证: 需求 7.4**
  - [ ]* 4.9 编写属性测试：转交操作独立性
    - **Property 13: 转交操作独立性**
    - **验证: 需求 7.10**

- [x] 5. 重构状态流转服务与权限模块
  - [x] 5.1 重构 `backend/src/services/ArchiveTransitionService.ts` 状态流转服务
    - 删除 `branch_return_status` 相关的更新逻辑
    - 适配新的 `TransitionResult` 结构（statusField 只有 `status` 和 `archive_status` 两种）
    - 处理 `review_pass` 联动时可能产生的两条日志（status 变更 + archive_status 变更）
    - 处理 `confirm_return_received` 自动判断后的额外状态变更和日志
    - _需求: 7.1, 7.9_
  - [x] 5.2 重构 `backend/src/services/AuthService.ts` 权限映射
    - 更新 `ROLE_PERMISSIONS` 中 operator 角色的权限列表：新增 `confirm_received`、`review_reject`、`confirm_shipped_back`
    - _需求: 1.2_
  - [x] 5.3 重构 `backend/src/services/ImportService.ts` 导入服务
    - 删除 `BranchReturnStatus` 导入和使用
    - 修改纸质版初始状态：`archiveStatus` 改为 `archive_not_started`（原为 `pending_transfer`）
    - 修改 `CreateArchiveInput` 构建：删除 `branchReturnStatus` 字段
    - 电子版初始状态：删除 `branchReturnStatus: 'returned_to_branch'`，`archiveStatus` 保持 `archived`
    - _需求: 3.1, 2.5, 2.6_
  - [x] 5.4 重构 `backend/tests/unit/archiveTransition.test.ts` 状态流转测试
    - 删除所有 `branchReturnStatus` 相关断言
    - 更新辅助函数 `createPaperArchive`：删除 `branchReturnStatus`，`archiveStatus` 改为 `archive_not_started`
    - 更新辅助函数 `createElectronicArchive`：删除 `branchReturnStatus`
    - 更新完整流转路径测试：使用新的8步流转路径（confirm_shipment → confirm_received → review_pass → return_branch → confirm_shipped_back → confirm_return_received + transfer_general → confirm_archive）
    - 新增 `confirm_received`、`review_reject`、`confirm_shipped_back` 操作的流转测试
    - 新增审核不通过循环回退的流转测试
    - _需求: 7.1, 7.7_
  - [x] 5.5 重构 `backend/tests/unit/auth.test.ts` 权限测试
    - 更新运营人员权限数量断言（从7项增加到10项）
    - 新增 `confirm_received`、`review_reject`、`confirm_shipped_back` 权限的断言
    - _需求: 1.2_
  - [x] 5.6 重构 `backend/tests/unit/import.test.ts` 导入测试
    - 更新纸质版初始状态断言：删除 `branchReturnStatus` 断言，`archiveStatus` 改为 `archive_not_started`
    - 更新电子版初始状态断言：删除 `branchReturnStatus` 断言
    - 更新辅助函数中 `archiveRepo.create` 调用：删除 `branchReturnStatus` 参数，`archiveStatus` 改为 `archive_not_started`
    - _需求: 3.1_
  - [ ]* 5.7 编写属性测试：状态变更审计日志完整性
    - **Property 15: 状态变更审计日志完整性**
    - **验证: 需求 7.9**
  - [ ]* 5.8 编写属性测试：初始状态由合同版本类型决定
    - **Property 5: 初始状态由合同版本类型决定**
    - **验证: 需求 2.5, 2.6, 7.3**

- [x] 6. 检查点 - 后端核心逻辑验证
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 7. 重构 API 层
  - [x] 7.1 重构 `backend/src/controllers/archiveController.ts` 控制器
    - 更新 `VALID_ACTIONS` 列表：新增 `confirm_received`、`review_reject`、`confirm_shipped_back`
    - 更新 `BATCH_ALLOWED_ACTIONS` 列表：扩展为支持所有批量操作（confirm_shipment、confirm_received、review_pass、review_reject、return_branch、confirm_shipped_back、confirm_return_received、transfer_general、confirm_archive）
    - 删除 `queryArchives` 中 `branchReturnStatus` 查询参数的提取
    - 更新 `editArchive` 中完全完结判定逻辑：改为检查 `record.status === 'completed'`
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 4.2, 4.3, 6.2, 6.3_
  - [x] 7.2 更新 `backend/src/routes/archive.ts` 路由（如需要）
    - 确认路由无需变更（批量操作已有 batch-transition 路由）
    - _需求: 9.1_
  - [x] 7.3 重构 `backend/tests/unit/archiveController.test.ts` 和 `backend/tests/unit/archiveQuery.test.ts`
    - 更新所有涉及 `branchReturnStatus` 的测试数据和断言
    - 更新 `VALID_ACTIONS` 和 `BATCH_ALLOWED_ACTIONS` 相关测试
    - 更新完全完结判定相关测试
    - _需求: 5.1, 4.2, 6.2_
  - [x] 7.4 重构 `backend/tests/unit/archiveDetail.test.ts`
    - 删除 `branchReturnStatus` 相关断言
    - 更新状态字段相关测试数据
    - _需求: 8.4_
  - [ ]* 7.5 编写属性测试：批量状态流转正确性
    - **Property 16: 批量状态流转正确性**
    - **验证: 需求 4.4, 6.3**

- [x] 8. 检查点 - 后端 API 验证
  - 确保所有测试通过，如有问题请向用户确认。

- [x] 9. 重构前端 - 审核分发页（ReviewPage）
  - [x] 9.1 重构 `frontend/src/pages/ReviewPage.tsx` 为批量操作模式
    - 删除 `BRANCH_RETURN_LABELS` 映射
    - 重写 `STATUS_LABELS` 映射为新的8个主流程状态 + completed 终态的中文标签
    - 重写 `ARCHIVE_STATUS_LABELS` 映射：新增 `archive_not_started`（归档待启动）
    - 删除表格中"分支回寄状态"列
    - 添加 `rowSelection`（Checkbox 勾选框）到 Table 组件
    - 删除操作列中的所有按钮（审核通过、回寄分支、转交综合部、编辑）
    - 在表格上方添加6个批量操作按钮：确认收到、审核通过、审核不通过、回寄分支、确认已寄出、转交综合部
    - 实现批量操作逻辑：勾选记录后调用 `POST /api/archives/batch-transition` 接口
    - 未勾选时点击按钮提示"请至少选择一条档案记录"
    - 保留编辑按钮（可放在表格上方或保留在操作列，根据设计文档要求调整）
    - _需求: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.8, 5.9, 9.2, 9.9_

- [x] 10. 重构前端 - 分支机构页（ShipmentPage）
  - [x] 10.1 重构 `frontend/src/pages/ShipmentPage.tsx` 为批量操作模式
    - 删除 `branchReturnStatus` 相关列和状态映射
    - 重写 `STATUS_LABELS` 为新的主流程状态中文标签
    - 新增 `ARCHIVE_STATUS_LABELS` 映射
    - 删除操作列中的"确认收到"按钮
    - 在表格上方添加2个批量操作按钮：确认寄出、确认收到
    - "确认寄出"按钮：勾选 `pending_shipment` 记录后批量操作
    - "确认收到"按钮：勾选 `return_in_transit` 记录后批量操作（调用 `confirm_return_received`）
    - 未勾选时点击按钮提示"请至少选择一条档案记录"
    - _需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 9.3, 9.9_

- [x] 11. 重构前端 - 综合部页（ArchivePage）
  - [x] 11.1 重构 `frontend/src/pages/ArchivePage.tsx`
    - 删除 `BRANCH_RETURN_LABELS` 映射和"分支回寄状态"列
    - 重写 `ARCHIVE_STATUS_LABELS`：新增 `archive_not_started`
    - 确认批量操作按钮和 rowSelection 已正确实现（当前已有，需验证兼容性）
    - _需求: 6.1, 6.2, 6.3, 6.6, 9.4, 9.9_

- [x] 12. 重构前端 - 详情弹窗与其他组件
  - [x] 12.1 重构 `frontend/src/components/ArchiveDetailModal.tsx`
    - 删除 `STATUS_FIELD_LABELS` 中的 `branch_return_status` 映射
    - 更新 `STATUS_VALUE_LABELS`：新增 `hq_received`、`review_passed`、`review_rejected`、`pending_return`、`return_in_transit`、`branch_received`、`completed`、`archive_not_started` 的中文映射
    - 删除 Descriptions 中"分支回寄状态"行
    - 更新 `ACTION_LABELS`：新增 `confirm_received`（确认收到）、`review_reject`（审核不通过）、`confirm_shipped_back`（确认已寄出）
    - _需求: 8.4_
  - [x] 12.2 更新 `frontend/src/components/MainLayout.tsx` 导航菜单（如需要）
    - 确认导航菜单项无需变更（页面路由不变）
    - _需求: 9.8_

- [x] 13. 检查点 - 前端页面验证
  - 确保所有测试通过，如有问题请向用户确认。
  - 建议用户手动启动前后端进行端到端验证。

- [x] 14. 更新种子数据与其他测试
  - [x] 14.1 更新 `backend/src/utils/seedUsers.ts` 种子用户数据（如需要）
    - 确认种子用户数据无需变更（用户角色不变）
    - _需求: 1.1_
  - [x] 14.2 更新 `backend/tests/unit/authorize.test.ts` 权限中间件测试
    - 更新涉及新权限（confirm_received、review_reject、confirm_shipped_back）的测试用例
    - _需求: 1.2, 1.5_
  - [ ]* 14.3 编写属性测试：角色权限访问控制
    - **Property 1: 角色权限访问控制**
    - **验证: 需求 1.2, 1.3, 1.4, 1.5**
  - [ ]* 14.4 编写属性测试：Excel 导入正确性
    - **Property 9: Excel 导入正确性**
    - **验证: 需求 3.1, 3.2, 3.3**

- [x] 15. 最终检查点 - 全部测试通过
  - 确保所有测试通过，如有问题请向用户确认。

## 备注

- 标记 `*` 的子任务为可选任务，可跳过以加速交付
- 每个任务引用了具体的需求编号，确保需求可追溯
- 数据库 schema 变更后必须删除旧数据库文件重建
- 所有代码使用 TypeScript 实现
- 重构过程中注意保持 API 接口的向后兼容性（如有外部调用方）
