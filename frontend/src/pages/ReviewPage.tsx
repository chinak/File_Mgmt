import { useState, useCallback, useEffect } from 'react';
import { Card, Form, Input, Button, Table, Space, App, Tag, Modal, Select, DatePicker } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ArchiveRecord, ArchiveListResponse, TransitionAction, BatchTransitionResponse, CreateArchiveRequest } from '@shared/types';
import apiClient from '../api/client';
import axios from 'axios';
import dayjs from 'dayjs';
import ArchiveDetailModal from '../components/ArchiveDetailModal';

/** 主流程状态中文映射（8个状态 + completed 终态） */
const STATUS_LABELS: Record<string, { text: string; color: string }> = {
  pending_shipment: { text: '待分支机构寄出', color: 'default' },
  in_transit: { text: '寄送总部在途', color: 'processing' },
  hq_received: { text: '总部已收到', color: 'warning' },
  review_passed: { text: '审核通过', color: 'success' },
  review_rejected: { text: '审核不通过', color: 'error' },
  pending_return: { text: '待总部回寄', color: 'warning' },
  return_in_transit: { text: '总部回寄在途', color: 'processing' },
  branch_received: { text: '分支已确认收到', color: 'success' },
  completed: { text: '完结', color: 'default' },
};

/** 综合部归档状态中文映射（含 archive_not_started） */
const ARCHIVE_STATUS_LABELS: Record<string, { text: string; color: string }> = {
  archive_not_started: { text: '归档待启动', color: 'default' },
  pending_transfer: { text: '待转交', color: 'warning' },
  pending_archive: { text: '待综合部入库', color: 'processing' },
  archived: { text: '已归档-完结', color: 'success' },
};

/** 批量操作按钮定义 */
const BATCH_ACTIONS: { label: string; action: TransitionAction }[] = [
  { label: '确认收到', action: 'confirm_received' },
  { label: '审核通过', action: 'review_pass' },
  { label: '审核不通过', action: 'review_reject' },
  { label: '回寄分支', action: 'return_branch' },
  { label: '确认已寄出', action: 'confirm_shipped_back' },
  { label: '转交综合部', action: 'transfer_general' },
];

export default function ReviewPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [searchValues, setSearchValues] = useState<{ customerName?: string; fundAccount?: string }>({});
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<ArchiveRecord | null>(null);
  const [editLoading, setEditLoading] = useState(false);
  const [editForm] = Form.useForm();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm] = Form.useForm();

  /** 查询档案列表 */
  const fetchRecords = useCallback(async (p: number, ps: number, search: { customerName?: string; fundAccount?: string }) => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = { page: p, pageSize: ps };
      if (search.customerName) params.customerName = search.customerName;
      if (search.fundAccount) params.fundAccount = search.fundAccount;

      const res = await apiClient.get<ArchiveListResponse>('/archives', { params });
      setRecords(res.data.records);
      setTotal(res.data.total);
    } catch {
      message.error('查询失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchRecords(1, pageSize, {});
  }, [fetchRecords, pageSize]);

  /** 搜索 */
  const handleSearch = (values: { customerName?: string; fundAccount?: string }) => {
    setSearchValues(values);
    setPage(1);
    fetchRecords(1, pageSize, values);
  };

  /** 分页变更 */
  const handlePageChange = (p: number, ps: number) => {
    setPage(p);
    setPageSize(ps);
    setSelectedRowKeys([]);
    fetchRecords(p, ps, searchValues);
  };

  /** 批量操作 */
  const handleBatchAction = async (action: TransitionAction, label: string) => {
    if (selectedRowKeys.length === 0) {
      message.warning('请至少选择一条档案记录');
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiClient.post<BatchTransitionResponse>('/archives/batch-transition', {
        archiveIds: selectedRowKeys,
        action,
      });
      const { successCount, failureCount } = res.data;
      if (failureCount === 0) {
        message.success(`${label}成功 ${successCount} 条记录`);
      } else {
        message.warning(`成功 ${successCount} 条，失败 ${failureCount} 条`);
      }
      setSelectedRowKeys([]);
      fetchRecords(page, pageSize, searchValues);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : '操作失败';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /** 检查是否可以执行特定操作 */
  const canExecuteAction = (action: TransitionAction): boolean => {
    if (selectedRowKeys.length === 0) return false;

    const selectedRecords = records.filter(r => selectedRowKeys.includes(r.id));

    switch (action) {
      case 'confirm_received':
        // 仅当所有选中记录状态都为 in_transit 时启用
        return selectedRecords.every(r => r.status === 'in_transit');
      case 'review_pass':
      case 'review_reject':
        // 仅当所有选中记录状态都为 hq_received 时启用
        return selectedRecords.every(r => r.status === 'hq_received');
      case 'return_branch':
        // 仅当所有选中记录状态都为 review_passed 或 review_rejected 时启用
        return selectedRecords.every(r => r.status === 'review_passed' || r.status === 'review_rejected');
      case 'confirm_shipped_back':
        // 仅当所有选中记录状态都为 pending_return 时启用
        return selectedRecords.every(r => r.status === 'pending_return');
      case 'transfer_general':
        // 仅当所有选中记录 archive_status 都为 pending_transfer 时启用
        return selectedRecords.every(r => r.archiveStatus === 'pending_transfer');
      default:
        return false;
    }
  };
  /** 创建新档案记录 */
  const handleCreateArchive = async (values: CreateArchiveRequest) => {
    setCreateLoading(true);
    try {
      await apiClient.post('/archives', {
        ...values,
        openDate: values.openDate ? dayjs(values.openDate).format('YYYY-MM-DD') : undefined,
      });
      message.success('新增记录成功');
      setCreateModalOpen(false);
      createForm.resetFields();
      fetchRecords(1, pageSize, {});
      setPage(1);
      setSearchValues({});
    } catch (err: unknown) {
      const msg = axios.isAxiosError(err) && err.response?.data?.message
        ? err.response.data.message : '新增失败';
      message.error(msg);
    } finally {
      setCreateLoading(false);
    }
  };

  /** 表格列定义 */
  const columns: ColumnsType<ArchiveRecord> = [
    {
      title: '客户姓名',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 120,
      render: (val: string, record: ArchiveRecord) => (
        <Button type="link" style={{ padding: 0 }} onClick={() => setDetailId(record.id)}>
          {val}
        </Button>
      ),
    },
    { title: '资金账号', dataIndex: 'fundAccount', key: 'fundAccount', width: 140 },
    { title: '营业部', dataIndex: 'branchName', key: 'branchName', width: 120 },
    { title: '合同类型', dataIndex: 'contractType', key: 'contractType', width: 120 },
    { title: '开户日期', dataIndex: 'openDate', key: 'openDate', width: 120 },
    {
      title: '合同版本类型',
      dataIndex: 'contractVersionType',
      key: 'contractVersionType',
      width: 110,
      render: (val: string) => (val === 'paper' ? '纸质版' : '电子版'),
    },
    {
      title: '主流程状态',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (val: string | null) => {
        if (!val) return '-';
        const label = STATUS_LABELS[val];
        return label ? <Tag color={label.color}>{label.text}</Tag> : val;
      },
    },
    {
      title: '综合部归档状态',
      dataIndex: 'archiveStatus',
      key: 'archiveStatus',
      width: 140,
      render: (val: string) => {
        const label = ARCHIVE_STATUS_LABELS[val];
        return label ? <Tag color={label.color}>{label.text}</Tag> : val;
      },
    },
    {
      title: '操作',
      key: 'actions',
      width: 80,
      render: (_: unknown, record: ArchiveRecord) => (
        <Button
          size="small"
          disabled={record.status === 'completed'}
          onClick={() => {
            setEditingRecord(record);
            editForm.setFieldsValue({
              customerName: record.customerName,
              fundAccount: record.fundAccount,
              branchName: record.branchName,
              contractType: record.contractType,
              openDate: record.openDate ? dayjs(record.openDate) : null,
              contractVersionType: record.contractVersionType,
            });
          }}
        >
          编辑
        </Button>
      ),
    },
  ];

  return (
    <Card title="审核分发">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* 搜索表单 */}
        <Form layout="inline" onFinish={handleSearch}>
          <Form.Item name="customerName" label="客户姓名">
            <Input placeholder="请输入客户姓名" allowClear />
          </Form.Item>
          <Form.Item name="fundAccount" label="资金账号">
            <Input placeholder="请输入资金账号" allowClear />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>
              查询
            </Button>
          </Form.Item>
          <Form.Item>
            <Button onClick={() => setCreateModalOpen(true)}>
              新增记录
            </Button>
          </Form.Item>
        </Form>

        {/* 批量操作按钮组 */}
        <Space wrap>
          {BATCH_ACTIONS.map(({ label, action }) => (
            <Button
              key={action}
              loading={submitting}
              disabled={!canExecuteAction(action)}
              onClick={() => handleBatchAction(action, label)}
            >
              {label}
            </Button>
          ))}
        </Space>

        {/* 档案列表 */}
        <Table
          columns={columns}
          dataSource={records}
          rowKey="id"
          loading={loading}
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys as string[]),
          }}
          pagination={{
            current: page,
            pageSize,
            total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: handlePageChange,
          }}
          scroll={{ x: 1100 }}
        />
      </Space>

      {/* 档案详情弹窗 */}
      <ArchiveDetailModal
        archiveId={detailId}
        open={detailId !== null}
        onClose={() => setDetailId(null)}
      />

      {/* 编辑弹窗 */}
      <Modal
        title="编辑档案记录"
        open={editingRecord !== null}
        onCancel={() => { setEditingRecord(null); editForm.resetFields(); }}
        onOk={() => editForm.submit()}
        confirmLoading={editLoading}
        destroyOnClose
      >
        <Form
          form={editForm}
          layout="vertical"
          onFinish={async (values) => {
            if (!editingRecord) return;
            setEditLoading(true);
            try {
              await apiClient.put(`/archives/${editingRecord.id}`, {
                ...values,
                openDate: values.openDate ? values.openDate.format('YYYY-MM-DD') : undefined,
              });
              message.success('编辑成功');
              setEditingRecord(null);
              editForm.resetFields();
              fetchRecords(page, pageSize, searchValues);
            } catch (err: unknown) {
              const msg = axios.isAxiosError(err) && err.response?.data?.message
                ? err.response.data.message : '编辑失败';
              message.error(msg);
            } finally {
              setEditLoading(false);
            }
          }}
        >
          <Form.Item name="customerName" label="客户姓名" rules={[{ required: true, message: '请输入客户姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="fundAccount" label="资金账号" rules={[{ required: true, message: '请输入资金账号' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="branchName" label="营业部" rules={[{ required: true, message: '请输入营业部' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="contractType" label="合同类型" rules={[{ required: true, message: '请输入合同类型' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="openDate" label="开户日期" rules={[{ required: true, message: '请选择开户日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="contractVersionType" label="合同版本类型" rules={[{ required: true, message: '请选择合同版本类型' }]}>
            <Select options={[{ value: 'paper', label: '纸质版' }, { value: 'electronic', label: '电子版' }]} />
          </Form.Item>
        </Form>
      </Modal>

      {/* 新增记录弹窗 */}
      <Modal
        title="新增档案记录"
        open={createModalOpen}
        onCancel={() => { setCreateModalOpen(false); createForm.resetFields(); }}
        onOk={() => createForm.submit()}
        confirmLoading={createLoading}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreateArchive}
        >
          <Form.Item name="customerName" label="客户姓名" rules={[{ required: true, message: '请输入客户姓名' }]}>
            <Input placeholder="请输入客户姓名" />
          </Form.Item>
          <Form.Item name="fundAccount" label="资金账号" rules={[{ required: true, message: '请输入资金账号' }]}>
            <Input placeholder="请输入资金账号" />
          </Form.Item>
          <Form.Item name="branchName" label="营业部" rules={[{ required: true, message: '请输入营业部' }]}>
            <Input placeholder="请输入营业部" />
          </Form.Item>
          <Form.Item name="contractType" label="合同类型" rules={[{ required: true, message: '请输入合同类型' }]}>
            <Input placeholder="请输入合同类型" />
          </Form.Item>
          <Form.Item name="openDate" label="开户日期" rules={[{ required: true, message: '请选择开户日期' }]}>
            <DatePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="contractVersionType" label="合同版本类型" rules={[{ required: true, message: '请选择合同版本类型' }]}>
            <Select placeholder="请选择合同版本类型" options={[{ value: 'paper', label: '纸质版' }, { value: 'electronic', label: '电子版' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
}
