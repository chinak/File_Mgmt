import { useState, useEffect, useCallback } from 'react';
import { Card, Table, Button, App, Space, Tag } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import type { ArchiveRecord, ArchiveListResponse, TransitionAction, BatchTransitionResponse } from '@shared/types';
import apiClient from '../api/client';
import axios from 'axios';
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
  { label: '确认寄出', action: 'confirm_shipment' },
  { label: '确认收到', action: 'confirm_return_received' },
];

/** 分支机构寄送确认页
 * 需求: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 9.3, 9.9
 */
export default function ShipmentPage() {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState<ArchiveRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);

  /** 查询本营业部所有档案记录 */
  const fetchRecords = useCallback(async (p: number, ps: number) => {
    setLoading(true);
    try {
      const res = await apiClient.get<ArchiveListResponse>('/archives', {
        params: { page: p, pageSize: ps },
      });
      setRecords(res.data.records);
      setTotal(res.data.total);
    } catch {
      message.error('查询失败');
    } finally {
      setLoading(false);
    }
  }, [message]);

  useEffect(() => {
    fetchRecords(1, pageSize);
  }, [fetchRecords, pageSize]);

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
      fetchRecords(page, pageSize);
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
      case 'confirm_shipment':
        // 仅当所有选中记录状态都为 pending_shipment 时启用
        return selectedRecords.every(r => r.status === 'pending_shipment');
      case 'confirm_return_received':
        // 仅当所有选中记录状态都为 return_in_transit 时启用
        return selectedRecords.every(r => r.status === 'return_in_transit');
      default:
        return false;
    }
  };

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
    { title: '资金账号', dataIndex: 'fundAccount', key: 'fundAccount', width: 150 },
    { title: '营业部', dataIndex: 'branchName', key: 'branchName', width: 120 },
    { title: '合同类型', dataIndex: 'contractType', key: 'contractType', width: 120 },
    { title: '开户日期', dataIndex: 'openDate', key: 'openDate', width: 120 },
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
  ];

  return (
    <Card title="寄送确认">
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
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
            onChange: (p, ps) => {
              setPage(p);
              setPageSize(ps);
              setSelectedRowKeys([]);
              fetchRecords(p, ps);
            },
          }}
          scroll={{ x: 900 }}
        />
      </Space>

      {/* 档案详情弹窗 */}
      <ArchiveDetailModal
        archiveId={detailId}
        open={detailId !== null}
        onClose={() => setDetailId(null)}
      />
    </Card>
  );
}
