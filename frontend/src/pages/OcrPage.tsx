import { useState } from 'react';
import { Card, Upload, Button, Form, Input, Select, Space, App, Tooltip } from 'antd';
import { UploadOutlined, WarningOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import type { OcrResponse, ImportResponse } from '@shared/types';
import apiClient from '../api/client';
import axios from 'axios';

/** OCR 置信度阈值，低于此值标记为需人工复核 */
const CONFIDENCE_THRESHOLD = 0.8;

/** 合同版本类型选项 */
const VERSION_TYPE_OPTIONS = [
  { label: '电子版', value: 'electronic' },
  { label: '纸质版', value: 'paper' },
];

/** OCR 字段配置 */
const OCR_FIELDS = [
  { name: 'customerName', label: '客户姓名' },
  { name: 'fundAccount', label: '资金账号' },
  { name: 'branchName', label: '营业部' },
  { name: 'contractType', label: '合同类型' },
  { name: 'openDate', label: '开户日期' },
] as const;

type OcrFieldKey = (typeof OCR_FIELDS)[number]['name'] | 'contractVersionType';

export default function OcrPage() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [recognized, setRecognized] = useState(false);
  // 记录每个字段的置信度
  const [confidences, setConfidences] = useState<Partial<Record<OcrFieldKey, number>>>({});

  /** 上传并识别 */
  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await apiClient.post<OcrResponse>('/ocr/recognize', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!res.data.success) {
        message.error('扫描件识别失败，请检查文件清晰度后重试');
        return;
      }

      const { fields } = res.data;
      // 自动填充表单
      form.setFieldsValue({
        customerName: fields.customerName.value,
        fundAccount: fields.fundAccount.value,
        branchName: fields.branchName.value,
        contractType: fields.contractType.value,
        openDate: fields.openDate.value,
        contractVersionType: fields.contractVersionType.value,
      });

      // 记录置信度
      setConfidences({
        customerName: fields.customerName.confidence,
        fundAccount: fields.fundAccount.confidence,
        branchName: fields.branchName.confidence,
        contractType: fields.contractType.confidence,
        openDate: fields.openDate.confidence,
        contractVersionType: fields.contractVersionType.confidence,
      });

      setRecognized(true);
      message.success('识别完成，请核对各字段');
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : '扫描件识别失败，请检查文件清晰度后重试';
      message.error(msg);
    } finally {
      setUploading(false);
    }
  };

  /** Upload 配置 */
  const uploadProps: UploadProps = {
    accept: '.jpg,.jpeg,.png,.pdf',
    maxCount: 1,
    showUploadList: false,
    beforeUpload(file) {
      // 文件大小校验（10MB）
      if (file.size > 10 * 1024 * 1024) {
        message.error('文件大小超出限制，请压缩后重新上传');
        return false;
      }
      handleUpload(file);
      return false;
    },
  };

  /** 提交表单，保存为档案记录 */
  const handleSubmit = async (values: Record<string, string>) => {
    setSubmitting(true);
    try {
      // 通过导入接口创建单条记录（构造一个单行 Excel 数据）
      // 或者直接调用后端创建接口（如果有的话）
      // 这里使用导入接口，构造 FormData
      const { default: XLSX } = await import('xlsx');
      const wsData = [
        ['客户姓名', '资金账号', '营业部', '合同类型', '开户日期', '合同版本类型'],
        [
          values.customerName,
          values.fundAccount,
          values.branchName,
          values.contractType,
          values.openDate,
          values.contractVersionType === 'electronic' ? '电子版' : '纸质版',
        ],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
      const buffer = XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });

      const formData = new FormData();
      formData.append('file', blob, 'ocr_import.xlsx');
      const res = await apiClient.post<ImportResponse>('/archives/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (res.data.successCount > 0) {
        message.success('档案记录创建成功');
        form.resetFields();
        setRecognized(false);
        setConfidences({});
      } else {
        const errorMsg = res.data.errors.length > 0 ? res.data.errors[0].reason : '创建失败';
        message.error(errorMsg);
      }
    } catch (err: unknown) {
      const msg =
        axios.isAxiosError(err) && err.response?.data?.message
          ? err.response.data.message
          : '保存失败';
      message.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  /** 判断字段是否低置信度 */
  const isLowConfidence = (field: OcrFieldKey): boolean => {
    const c = confidences[field];
    return c !== undefined && c < CONFIDENCE_THRESHOLD;
  };

  /** 渲染带置信度警告的 label */
  const renderLabel = (label: string, field: OcrFieldKey) => {
    if (isLowConfidence(field)) {
      return (
        <Space>
          {label}
          <Tooltip title={`置信度较低 (${((confidences[field] ?? 0) * 100).toFixed(0)}%)，请人工复核`}>
            <WarningOutlined style={{ color: '#faad14' }} />
          </Tooltip>
        </Space>
      );
    }
    return label;
  };

  return (
    <Card title="OCR 识别">
      <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 600 }}>
        {/* 上传区域 */}
        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />} loading={uploading}>
            {uploading ? '识别中...' : '上传扫描件'}
          </Button>
        </Upload>
        <span style={{ color: '#999', fontSize: 12 }}>支持 JPG、PNG、PDF 格式，最大 10MB</span>

        {/* OCR 结果表单 */}
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          disabled={!recognized && !form.isFieldsTouched()}
        >
          {OCR_FIELDS.map(({ name, label }) => (
            <Form.Item
              key={name}
              name={name}
              label={renderLabel(label, name)}
              rules={[{ required: true, message: `请输入${label}` }]}
              className={isLowConfidence(name) ? 'low-confidence-field' : ''}
            >
              <Input
                placeholder={`请输入${label}`}
                style={isLowConfidence(name) ? { borderColor: '#faad14' } : undefined}
              />
            </Form.Item>
          ))}

          <Form.Item
            name="contractVersionType"
            label={renderLabel('合同版本类型', 'contractVersionType')}
            rules={[{ required: true, message: '请选择合同版本类型' }]}
          >
            <Select
              placeholder="请选择合同版本类型"
              options={VERSION_TYPE_OPTIONS}
              style={isLowConfidence('contractVersionType') ? { borderColor: '#faad14' } : undefined}
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" loading={submitting}>
              保存为档案记录
            </Button>
          </Form.Item>
        </Form>
      </Space>
    </Card>
  );
}
