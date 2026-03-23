# 需求文档

## 简介

档案管理系统是一个面向金融机构的合同档案全生命周期管理平台。系统覆盖从数据导入、分支机构寄送、运营审核分发到综合部归档的完整业务流程，实现合同档案状态的实时追踪与管理。系统支持三类角色（运营人员、分支机构、综合部）协同操作，确保合同在各环节的流转可追溯、可查询。

系统区分电子版合同与纸质版合同：电子版合同创建后主流程状态为空、综合部归档状态直接设为"已归档-完结"，无需经历寄送、审核、归档流程；纸质版合同需走完整的业务流程。

系统采用"双状态字段"设计：主流程状态（status）跟踪寄送、审核、回寄的完整流程（8个状态值），综合部归档状态（archive_status）独立跟踪归档流程（4个状态值）。审核通过后，archive_status 从"归档待启动"激活为"待转交"；审核不通过时，合同经回寄循环后可重新寄送审核，循环次数不限。当主流程到达"分支已确认收到"且 archive_status 为"已归档-完结"时，记录完全完结；若 archive_status 仍为"归档待启动"（审核不通过路径），则自动回到"待分支机构寄出"重新开始流程。

系统提供基于 React + Ant Design 的 Web 前端界面，所有列表页采用表格勾选 + 表格上方批量操作按钮的交互模式，各角色通过浏览器完成所有业务操作。

## 术语表

- **档案管理系统（Archive_Management_System）**：管理合同档案全生命周期的信息系统
- **运营人员（Operator）**：负责数据导入、确认收到合同、审核合同（通过/不通过）、回寄分支、转交综合部的核心操作角色
- **分支机构（Branch）**：负责寄送纸质合同材料、确认收到回寄材料的角色
- **综合部（General_Affairs_Department）**：负责确认纸质合同入库归档的角色
- **档案记录（Archive_Record）**：系统中代表一份合同档案的数据条目，包含客户信息和当前状态
- **德索系统（Desuo_System）**：外部业务系统，运营人员从中下载原始 Excel 数据
- **Web_Frontend**：基于 React 和 Ant Design 构建的浏览器端用户界面
- **OCR_Engine**：光学字符识别引擎，用于从扫描件图片或 PDF 中自动提取文字信息
- **扫描件（Scan_File）**：档案合同的数字化扫描文件，支持 JPG、PNG 图片格式和 PDF 格式
- **合同版本类型（Contract_Version_Type）**：标识合同的介质类型，取值为"电子版"或"纸质版"。电子版合同创建后直接完结，纸质版合同需经历完整的寄送、审核、归档流程
- **主流程状态（Status）**：跟踪纸质版合同从寄送到回寄的完整流程，包含8个状态值：待分支机构寄出、寄送总部在途、总部已收到、审核通过、审核不通过、待总部回寄、总部回寄在途、分支已确认收到
- **综合部归档状态（Archive_Status）**：独立跟踪综合部归档流程，包含4个状态值：归档待启动、待转交、待综合部入库、已归档-完结

## 需求

### 需求 1：角色与权限管理

**用户故事：** 作为系统管理员，我希望系统支持基于角色的访问控制，以便不同角色只能执行其职责范围内的操作。

#### 验收标准

1. THE Archive_Management_System SHALL 支持三种角色：运营人员（Operator）、分支机构（Branch）、综合部（General_Affairs_Department）
2. WHEN 运营人员登录系统时，THE Archive_Management_System SHALL 授予数据导入、档案搜索、确认收到、审核通过、审核不通过、回寄分支、确认已寄出、转交综合部、扫描件上传与 OCR 识别的操作权限
3. WHEN 分支机构登录系统时，THE Archive_Management_System SHALL 仅展示该分支机构所属营业部名下的档案记录，并授予确认寄出和确认收到回寄的操作权限
4. WHEN 综合部登录系统时，THE Archive_Management_System SHALL 授予确认入库归档的操作权限
5. IF 用户尝试执行其角色权限范围外的操作，THEN THE Archive_Management_System SHALL 拒绝该操作并显示"权限不足"提示信息

### 需求 2：档案数据字段定义

**用户故事：** 作为运营人员，我希望每条档案记录包含完整的客户信息和状态信息，以便准确追踪合同的全生命周期。

#### 验收标准

1. THE Archive_Record SHALL 包含以下必填字段：客户姓名、资金账号、营业部、合同类型、开户日期、合同版本类型（Contract_Version_Type）
2. THE Archive_Record SHALL 包含一个"合同版本类型"字段，取值范围为：电子版、纸质版
3. THE Archive_Record SHALL 包含一个"主流程状态"（status）字段，用于跟踪寄送、审核、回寄的完整流程，取值范围为：待分支机构寄出、寄送总部在途、总部已收到、审核通过、审核不通过、待总部回寄、总部回寄在途、分支已确认收到
4. THE Archive_Record SHALL 包含一个"综合部归档状态"（archive_status）字段，用于独立跟踪综合部归档流程，取值范围为：归档待启动、待转交、待综合部入库、已归档-完结
5. WHEN 合同版本类型为"纸质版"的档案记录首次创建时，THE Archive_Management_System SHALL 将"主流程状态"设置为"待分支机构寄出"，"综合部归档状态"设置为"归档待启动"
6. WHEN 合同版本类型为"电子版"的档案记录首次创建时，THE Archive_Management_System SHALL 将"主流程状态"设置为空（不参与寄送流程），"综合部归档状态"设置为"已归档-完结"，表示直接完结
7. THE Archive_Management_System SHALL 确保资金账号在系统内唯一标识一条档案记录
8. WHEN 主流程状态为"分支已确认收到"且综合部归档状态为"已归档-完结"时，THE Archive_Management_System SHALL 判定该档案记录为"完全完结"状态，并将主流程状态置为"完结"
9. WHEN 主流程状态为"分支已确认收到"且综合部归档状态为"归档待启动"时，THE Archive_Management_System SHALL 自动将主流程状态回退为"待分支机构寄出"，使该记录重新进入寄送审核循环

### 需求 3：Excel 数据导入（数据建立）

**用户故事：** 作为运营人员，我希望通过导入 Excel 文件批量创建档案记录，以便高效地将德索系统的数据录入档案管理系统。

#### 验收标准

1. WHEN 运营人员上传符合模板格式的 Excel 文件时，THE Archive_Management_System SHALL 解析文件内容并根据每行数据的合同版本类型生成档案记录：合同版本类型为"纸质版"时主流程状态设为"待分支机构寄出"、综合部归档状态设为"归档待启动"，合同版本类型为"电子版"时主流程状态设为空、综合部归档状态设为"已归档-完结"
2. WHEN Excel 文件中存在格式不符合模板要求的行时，THE Archive_Management_System SHALL 跳过该行并在导入结果中标注具体的错误原因和行号
3. WHEN 导入完成后，THE Archive_Management_System SHALL 显示导入结果摘要，包含成功导入条数和失败条数
4. IF Excel 文件为空或文件格式不是 .xlsx/.xls，THEN THE Archive_Management_System SHALL 拒绝导入并提示"文件格式不正确，请上传 Excel 文件"
5. THE Archive_Management_System SHALL 提供 Excel 导入模板的下载功能，模板包含客户姓名、资金账号、营业部、合同类型、开户日期、合同版本类型字段
6. IF Excel 文件中某行的合同版本类型字段值不是"电子版"或"纸质版"，THEN THE Archive_Management_System SHALL 跳过该行并在导入结果中标注"合同版本类型不合法"

### 需求 4：分支机构操作

**用户故事：** 作为分支机构操作人员，我希望在寄出合同材料后能在系统中确认寄出，在收到回寄材料后能确认收到，以便总部能追踪寄送和回寄状态。所有操作通过表格勾选后点击表格上方的批量操作按钮完成。

#### 验收标准

1. WHEN 分支机构登录系统时，THE Archive_Management_System SHALL 展示该营业部名下所有档案记录列表，每行带有勾选框，表格上方提供批量操作按钮
2. WHEN 分支机构勾选一条或多条主流程状态为"待分支机构寄出"的档案记录并点击表格上方的"确认寄出"按钮时，THE Archive_Management_System SHALL 将所选记录的主流程状态从"待分支机构寄出"更新为"寄送总部在途"
3. WHEN 分支机构勾选一条或多条主流程状态为"总部回寄在途"的档案记录并点击表格上方的"确认收到"按钮时，THE Archive_Management_System SHALL 将所选记录的主流程状态从"总部回寄在途"更新为"分支已确认收到"
4. THE Archive_Management_System SHALL 支持分支机构对多条档案记录进行批量确认寄出和批量确认收到操作
5. IF 分支机构未勾选任何档案记录即点击操作按钮，THEN THE Archive_Management_System SHALL 提示"请至少选择一条档案记录"
6. THE Web_Frontend SHALL 在分支机构页面的表格上方显示"确认寄出"和"确认收到"两个批量操作按钮，不在操作列中放置按钮

### 需求 5：运营审核与分发

**用户故事：** 作为运营人员，我希望在收到纸质合同后能在系统中完成确认收到、审核（通过/不通过）、回寄分支和转交综合部等操作，以便合同能继续流转到下一环节。所有操作通过表格勾选后点击表格上方的批量操作按钮完成。

#### 验收标准

1. THE Archive_Management_System SHALL 支持运营人员查看所有状态的档案记录，并支持按客户姓名、资金账号搜索筛选，每行带有勾选框，表格上方提供批量操作按钮
2. WHEN 运营人员勾选一条或多条主流程状态为"寄送总部在途"的档案记录并点击"确认收到"按钮时，THE Archive_Management_System SHALL 将所选记录的主流程状态从"寄送总部在途"更新为"总部已收到"
3. WHEN 运营人员勾选一条或多条主流程状态为"总部已收到"的档案记录并点击"审核通过"按钮时，THE Archive_Management_System SHALL 将所选记录的主流程状态更新为"审核通过"，同时将综合部归档状态从"归档待启动"更新为"待转交"
4. WHEN 运营人员勾选一条或多条主流程状态为"总部已收到"的档案记录并点击"审核不通过"按钮时，THE Archive_Management_System SHALL 将所选记录的主流程状态更新为"审核不通过"，综合部归档状态保持"归档待启动"不变
5. WHEN 运营人员勾选一条或多条主流程状态为"审核通过"或"审核不通过"的档案记录并点击"回寄分支"按钮时，THE Archive_Management_System SHALL 将所选记录的主流程状态更新为"待总部回寄"
6. WHEN 运营人员勾选一条或多条主流程状态为"待总部回寄"的档案记录并点击"确认已寄出"按钮时，THE Archive_Management_System SHALL 将所选记录的主流程状态从"待总部回寄"更新为"总部回寄在途"
7. WHEN 运营人员勾选一条或多条综合部归档状态为"待转交"的档案记录并点击"转交综合部"按钮时，THE Archive_Management_System SHALL 将所选记录的综合部归档状态从"待转交"更新为"待综合部入库"
8. THE Web_Frontend SHALL 在运营审核页面的表格上方显示"确认收到"、"审核通过"、"审核不通过"、"回寄分支"、"确认已寄出"、"转交综合部"六个批量操作按钮，不在操作列中放置按钮
9. IF 运营人员未勾选任何档案记录即点击操作按钮，THEN THE Archive_Management_System SHALL 提示"请至少选择一条档案记录"
10. WHEN 运营人员点击档案记录的"编辑"按钮时，THE Archive_Management_System SHALL 弹出编辑表单，允许修改客户姓名、资金账号、营业部、合同类型、开户日期、合同版本类型字段
11. IF 档案记录已完全完结，THEN THE Archive_Management_System SHALL 禁止编辑该记录
12. WHEN 运营人员修改资金账号时，THE Archive_Management_System SHALL 校验新资金账号在系统内的唯一性，重复时拒绝保存并提示"资金账号已存在"

### 需求 6：综合部归档确认

**用户故事：** 作为综合部操作人员，我希望在收到纸质合同并放入档案柜后能在系统中确认入库，以便完成档案的最终归档。所有操作通过表格勾选后点击表格上方的批量操作按钮完成。

#### 验收标准

1. WHEN 综合部登录系统时，THE Archive_Management_System SHALL 展示所有"综合部归档状态"为"待综合部入库"的档案记录列表，每行带有勾选框，表格上方提供批量操作按钮
2. WHEN 综合部勾选一条或多条档案记录并点击表格上方的"确认入库"按钮时，THE Archive_Management_System SHALL 将所选记录的"综合部归档状态"从"待综合部入库"更新为"已归档-完结"
3. THE Archive_Management_System SHALL 支持综合部对多条档案记录进行批量确认入库操作
4. WHEN 档案记录的主流程状态为"分支已确认收到"且"综合部归档状态"为"已归档-完结"时，THE Archive_Management_System SHALL 判定该记录为完全完结状态，将主流程状态置为"完结"，禁止任何角色对该记录的任何状态字段进行修改
5. IF 综合部对"综合部归档状态"不是"待综合部入库"的记录点击"确认入库"，THEN THE Archive_Management_System SHALL 拒绝该操作
6. THE Web_Frontend SHALL 在综合部页面的表格上方显示"确认入库"批量操作按钮，不在操作列中放置按钮

### 需求 7：档案状态流转规则

**用户故事：** 作为系统管理员，我希望系统严格控制档案状态的流转顺序，以便确保业务流程的合规性。

#### 验收标准

1. THE Archive_Management_System SHALL 按以下规则控制纸质版合同的主流程状态流转：待分支机构寄出 →[分支确认寄出]→ 寄送总部在途 →[运营确认收到]→ 总部已收到 →[运营审核通过]→ 审核通过（同时 archive_status 从"归档待启动"变为"待转交"）；总部已收到 →[运营审核不通过]→ 审核不通过；审核通过 →[运营回寄分支]→ 待总部回寄；审核不通过 →[运营回寄分支]→ 待总部回寄；待总部回寄 →[运营确认已寄出]→ 总部回寄在途；总部回寄在途 →[分支确认收到]→ 分支已确认收到
2. THE Archive_Management_System SHALL 按以下规则控制综合部归档状态的独立流转：归档待启动 →[审核通过时自动]→ 待转交 →[运营转交综合部]→ 待综合部入库 →[综合部确认入库]→ 已归档-完结
3. WHEN 合同版本类型为"电子版"的档案记录创建时，THE Archive_Management_System SHALL 将主流程状态设为空、综合部归档状态设为"已归档-完结"，该记录不参与寄送、审核、归档的后续流程
4. IF 用户尝试对合同版本类型为"电子版"的档案记录执行任何状态变更操作，THEN THE Archive_Management_System SHALL 拒绝该操作并提示"电子版合同无需执行此操作"
5. IF 用户尝试将纸质版合同的档案记录跳过中间状态直接更新到后续状态，THEN THE Archive_Management_System SHALL 拒绝该操作并提示"状态流转不合法"
6. WHEN 主流程状态为"分支已确认收到"且综合部归档状态为"已归档-完结"时，THE Archive_Management_System SHALL 判定该记录完全完结，将主流程状态置为"完结"，此后禁止任何状态变更操作
7. WHEN 主流程状态为"分支已确认收到"且综合部归档状态为"归档待启动"时，THE Archive_Management_System SHALL 自动将主流程状态回退为"待分支机构寄出"，使该记录重新进入寄送审核循环，循环次数不限
8. WHEN 审核不通过的记录经回寄循环后，THE Archive_Management_System SHALL 保持该记录的综合部归档状态为"归档待启动"不变，直到后续审核通过时才激活为"待转交"
9. THE Archive_Management_System SHALL 记录每次状态变更的操作人、操作时间、变更的状态字段名称和变更前后状态值，形成完整的操作日志
10. WHEN "转交综合部"操作执行后，THE Archive_Management_System SHALL 仅更新"综合部归档状态"字段，不影响主流程状态字段
11. THE Archive_Management_System SHALL 通过组合判断主流程状态和综合部归档状态来区分审核通过路径和审核不通过路径：审核通过路径的 archive_status 为"待转交"或更后续状态，审核不通过路径的 archive_status 始终为"归档待启动"

### 需求 8：档案查询与列表展示

**用户故事：** 作为系统用户，我希望能按多种条件查询和筛选档案记录，以便快速定位所需的档案信息。

#### 验收标准

1. THE Archive_Management_System SHALL 支持按客户姓名、资金账号、营业部、合同类型、主流程状态、综合部归档状态、开户日期范围、合同版本类型进行组合查询
2. WHEN 查询结果超过单页显示数量时，THE Archive_Management_System SHALL 提供分页功能，每页默认显示 20 条记录
3. THE Archive_Management_System SHALL 在档案列表中展示以下字段：客户姓名、资金账号、营业部、合同类型、开户日期、合同版本类型、主流程状态、综合部归档状态
4. WHEN 用户点击某条档案记录时，THE Archive_Management_System SHALL 展示该记录的完整详情，包括所有数据字段和状态变更历史记录
5. THE Archive_Management_System SHALL 在列表中同时展示"主流程状态"和"综合部归档状态"两列，使用户可以清楚看到每份合同的流转进度和归档进度

### 需求 9：Web 前端界面

**用户故事：** 作为系统用户，我希望通过基于 Ant Design 组件库的 Web 界面操作系统，以便获得一致、专业的交互体验。所有列表页采用表格勾选 + 表格上方批量操作按钮的统一交互模式。

#### 验收标准

1. THE Web_Frontend SHALL 使用 React 框架和 Ant Design 组件库构建
2. THE Web_Frontend SHALL 为运营人员提供操作界面，包含 Ant Design Upload 上传组件（Excel 导入）、Table 表格组件（档案列表展示，每行带 Checkbox 勾选框）、Input/Select 搜索组件（档案查询）、表格上方的批量操作 Button 按钮组（确认收到、审核通过、审核不通过、回寄分支、确认已寄出、转交综合部）
3. THE Web_Frontend SHALL 为分支机构提供操作界面，包含 Ant Design Table 表格组件（档案列表，每行带 Checkbox 勾选框）、表格上方的批量操作 Button 按钮组（确认寄出、确认收到）
4. THE Web_Frontend SHALL 为综合部提供操作界面，包含 Ant Design Table 表格组件（待入库档案列表，每行带 Checkbox 勾选框）、表格上方的批量操作 Button 按钮组（确认入库）
5. THE Web_Frontend SHALL 使用 Ant Design Form 表单组件实现所有数据录入和查询筛选功能
6. THE Web_Frontend SHALL 使用 Ant Design Pagination 分页组件实现档案列表的分页展示
7. THE Web_Frontend SHALL 使用 Ant Design Message/Notification 组件展示操作成功、失败和权限不足的提示信息
8. WHEN 用户通过浏览器访问系统时，THE Web_Frontend SHALL 提供基于角色的导航菜单，使用 Ant Design Layout 和 Menu 组件实现页面布局与导航
9. THE Web_Frontend SHALL 在所有列表页面中将操作按钮统一放置在表格上方，不在表格的操作列中放置任何操作按钮，所有操作均通过勾选记录后点击表格上方按钮完成

### 需求 10：档案扫描件 OCR 识别

**用户故事：** 作为运营人员，我希望能上传档案扫描件并通过 OCR 自动识别关键信息，以便减少手动录入工作量并提高数据准确性。

#### 验收标准

1. THE Web_Frontend SHALL 使用 Ant Design Upload 组件为运营人员提供档案扫描件上传功能
2. WHEN 运营人员上传 JPG、PNG 格式的图片文件或 PDF 格式的文件时，THE Archive_Management_System SHALL 接受该文件并提交至 OCR_Engine 进行识别
3. IF 运营人员上传的文件格式不是 JPG、PNG 或 PDF，THEN THE Archive_Management_System SHALL 拒绝该文件并提示"文件格式不支持，请上传 JPG、PNG 或 PDF 格式的扫描件"
4. WHEN OCR_Engine 完成识别后，THE Archive_Management_System SHALL 从扫描件中提取以下关键字段：客户姓名、资金账号、营业部、合同类型、开户日期、合同版本类型
5. WHEN OCR_Engine 返回识别结果后，THE Archive_Management_System SHALL 将识别结果自动填充到档案记录对应的表单字段中
6. WHEN OCR 识别结果自动填充到表单后，THE Web_Frontend SHALL 允许运营人员对每个已填充字段进行手动修正
7. WHEN OCR_Engine 对某个字段的识别置信度低于阈值时，THE Web_Frontend SHALL 以视觉标记（如高亮或警告图标）提示运营人员该字段需要人工复核
8. IF OCR_Engine 识别过程中发生错误或无法识别扫描件内容，THEN THE Archive_Management_System SHALL 提示"扫描件识别失败，请检查文件清晰度后重试"并允许运营人员手动填写所有字段
9. IF 上传的扫描件文件大小超过系统允许的最大限制，THEN THE Archive_Management_System SHALL 拒绝上传并提示"文件大小超出限制，请压缩后重新上传"
