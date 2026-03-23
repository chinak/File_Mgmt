import { useState } from 'react';
import { Upload, Button, Modal, Table, Card, App, Space, Typography } from 'antd';
import { InboxOutlined, DownloadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { ImportResponse } from '@shared/types';
import apiClient from '../api/client';
import axios from 'axios';

const { Dragger } = Upload;
const { Text } = Typography;

/** 导入错误详情表格列定义 */
const errorColumns = [
  { title: '行号', dataIndex: 'row', key: 'row', width: 80 },
  { title: '错误原因', dataIndex: 'reason', key: 'reason' },
];

export default function ImportPage() {
  const { message } = App.useApp();
  const [importing, setImporting] = useState(false);
  const [resultVisible, setResultVisible] = useState(false);
  const [importResult, setImportResult] = useState<ImportResponse | null>(null);

  /** 下载导入模板 */
  const handleDownloadTemplate = async () => {
    try {
      const res = await apiClient.get('/archives/template', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'archive_import_template.xlsx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      message.error('模板下载失败');
    }
  };

  /** 处理文件导入 */
  const handleImport = async (file: File) => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post<ImportResponse>('/archives/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportResult(res.data);
      setResultVisible(true);
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : '导入失败，请检查文件格式';
      message.error(msg);
    } finally {
      setImporting(false);
    }
  };

  /** Dragger 配置 */
  const draggerProps: UploadProps = {
    name: 'file',
    multiple: false,
    accept: '.xlsx,.xls',
    showUploadList: false,
    beforeUpload(file) {
      handleImport(file);
      return false; // 阻止自动上传
    },
  };

  return (
    <Card title="数据导入">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
          下载导入模板
        </Button>

        <Dragger {...draggerProps} disabled={importing}>
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">
            {importing ? '正在导入...' : '点击或拖拽 Excel 文件到此区域上传'}
          </p>
          <p className="ant-upload-hint">仅支持 .xlsx / .xls 格式</p>
        </Dragger>
      </Space>

      {/* 导入结果弹窗 */}
      <Modal
        title="导入结果"
        open={resultVisible}
        onCancel={() => setResultVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setResultVisible(false)}>
            确定
          </Button>,
        ]}
        width={640}
      >
        {importResult && (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Space size="large">
              <Text>总行数：{importResult.totalRows}</Text>
              <Text type="success">成功：{importResult.successCount}</Text>
              <Text type="danger">失败：{importResult.failureCount}</Text>
            </Space>
            {importResult.errors.length > 0 && (
              <Table
                columns={errorColumns}
                dataSource={importResult.errors.map((e) => ({ ...e, key: e.row }))}
                size="small"
                pagination={false}
                scroll={{ y: 300 }}
              />
            )}
          </Space>
        )}
      </Modal>
    </Card>
  );
}
