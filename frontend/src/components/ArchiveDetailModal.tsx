import { useEffect, useState } from 'react';
import { Modal, Descriptions, Timeline, Tag, Spin, App } from 'antd';
import type { ArchiveRecord, StatusChangeLog, ArchiveDetailResponse } from '@shared/types';
import apiClient from '../api/client';

/** 状态字段中文名映射 */
const STATUS_FIELD_LABELS: Record<string, string> = {
  status: '主流程状态',
  archive_status: '综合部归档状态',
};

/** 状态值中文映射 */
const STATUS_VALUE_LABELS: Record<string, string> = {
  pending_shipment: '待分支机构寄出',
  in_transit: '寄送总部在途',
  hq_received: '总部已收到',
  review_passed: '审核通过',
  review_rejected: '审核不通过',
  pending_return: '待总部回寄',
  return_in_transit: '总部回寄在途',
  branch_received: '分支已确认收到',
  completed: '完结',
  archive_not_started: '归档待启动',
  pending_transfer: '待转交',
  pending_archive: '待综合部入库',
  archived: '已归档-完结',
};

/** 操作中文映射 */
const ACTION_LABELS: Record<string, string> = {
  create: '创建',
  confirm_shipment: '确认寄出',
  confirm_received: '确认收到',
  review_pass: '审核通过',
  review_reject: '审核不通过',
  return_branch: '回寄分支',
  confirm_shipped_back: '确认已寄出',
  confirm_return_received: '确认收到回寄',
  transfer_general: '转交综合部',
  confirm_archive: '确认入库',
};

/** 合同版本类型中文映射 */
const VERSION_TYPE_LABELS: Record<string, string> = {
  electronic: '电子版',
  paper: '纸质版',
};

interface Props {
  archiveId: string | null;
  open: boolean;
  onClose: () => void;
}

/** 档案详情弹窗
 * 需求: 8.4
 */
export default function ArchiveDetailModal({ archiveId, open, onClose }: Props) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<ArchiveRecord | null>(null);
  const [history, setHistory] = useState<StatusChangeLog[]>([]);

  useEffect(() => {
    if (!open || !archiveId) return;
    setLoading(true);
    apiClient
      .get<ArchiveDetailResponse>(`/archives/${archiveId}`)
      .then((res) => {
        setRecord(res.data.record);
        setHistory(res.data.statusHistory);
      })
      .catch(() => message.error('获取档案详情失败'))
      .finally(() => setLoading(false));
  }, [open, archiveId, message]);

  const handleClose = () => {
    setRecord(null);
    setHistory([]);
    onClose();
  };

  return (
    <Modal
      title="档案详情"
      open={open}
      onCancel={handleClose}
      footer={null}
      width={720}
      destroyOnClose
    >
      <Spin spinning={loading}>
        {record && (
          <>
            {/* 基本信息 */}
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 24 }}>
              <Descriptions.Item label="客户姓名">{record.customerName}</Descriptions.Item>
              <Descriptions.Item label="资金账号">{record.fundAccount}</Descriptions.Item>
              <Descriptions.Item label="营业部">{record.branchName}</Descriptions.Item>
              <Descriptions.Item label="合同类型">{record.contractType}</Descriptions.Item>
              <Descriptions.Item label="开户日期">{record.openDate}</Descriptions.Item>
              <Descriptions.Item label="合同版本类型">
                <Tag color={record.contractVersionType === 'electronic' ? 'blue' : 'orange'}>
                  {VERSION_TYPE_LABELS[record.contractVersionType] ?? record.contractVersionType}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="主流程状态">
                {record.status
                  ? (STATUS_VALUE_LABELS[record.status] ?? record.status)
                  : <Tag color="default">-</Tag>}
              </Descriptions.Item>
              <Descriptions.Item label="综合部归档状态" span={2}>
                {STATUS_VALUE_LABELS[record.archiveStatus] ?? record.archiveStatus}
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">{record.createdAt}</Descriptions.Item>
              <Descriptions.Item label="更新时间">{record.updatedAt}</Descriptions.Item>
            </Descriptions>

            {/* 状态变更历史 */}
            <div style={{ fontWeight: 500, marginBottom: 12 }}>状态变更历史</div>
            {history.length === 0 ? (
              <div style={{ color: '#999', textAlign: 'center', padding: '16px 0' }}>暂无变更记录</div>
            ) : (
              <Timeline
                mode="left"
                items={history.map((log) => ({
                  key: log.id,
                  label: log.operatedAt,
                  children: (
                    <div>
                      <span style={{ fontWeight: 500 }}>{log.operatorName}</span>
                      {' 执行了 '}
                      <Tag>{ACTION_LABELS[log.action] ?? log.action}</Tag>
                      <br />
                      <span style={{ color: '#666', fontSize: 12 }}>
                        {STATUS_FIELD_LABELS[log.statusField] ?? log.statusField}：
                        {log.previousValue
                          ? `${STATUS_VALUE_LABELS[log.previousValue] ?? log.previousValue} → `
                          : ''}
                        {STATUS_VALUE_LABELS[log.newValue] ?? log.newValue}
                      </span>
                    </div>
                  ),
                }))}
              />
            )}
          </>
        )}
      </Spin>
    </Modal>
  );
}
