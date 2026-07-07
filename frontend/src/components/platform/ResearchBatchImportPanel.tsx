import { CloudUploadOutlined, FileExcelOutlined } from "@ant-design/icons";
import { App, Button, Col, Row, Space, Tag, Typography, Upload } from "antd";
import { useState } from "react";
import { importFollowUpBatch, type FollowUpBatchImportResult } from "../../lib/followUpBatchImport";
import { activateResearchFromFollowUpBatch } from "../../lib/researchBatchContext";
import {
  FOLLOWUP_BATCH_IMPORTED_EVENT,
  loadFollowUpBatch,
  type FollowUpBatchState,
} from "../../lib/followUpBatchStore";

const { Text, Paragraph } = Typography;

export type ResearchBatchImportVariant = "followup" | "research";

type Props = {
  variant?: ResearchBatchImportVariant;
  onImported?: (result: FollowUpBatchImportResult) => void;
};

export default function ResearchBatchImportPanel({
  variant = "research",
  onImported,
}: Props) {
  const { message } = App.useApp();
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [excelFile, setExcelFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [batch, setBatch] = useState<FollowUpBatchState | null>(() => loadFollowUpBatch());

  async function handleImport() {
    if (!zipFile || !excelFile) {
      message.warning("请同时选择预勾画 ZIP 与临床 Excel");
      return;
    }
    setLoading(true);
    try {
      const result = await importFollowUpBatch(zipFile, excelFile);
      setBatch(result);
      if (variant === "research") {
        activateResearchFromFollowUpBatch("research_upload");
      }
      onImported?.(result);
      message.success(
        `导入完成：${result.cases.length} 例临床，${result.matchedCount} 例已关联预勾画影像`,
      );
      if (result.warnings.length) message.warning(result.warnings[0]);
    } catch (e) {
      message.error(e instanceof Error ? e.message : "批量导入失败");
    } finally {
      setLoading(false);
    }
  }

  const title =
    variant === "followup"
      ? "批量导入 · 预勾画影像 + 临床记录"
      : "批量导入科研数据（ZIP + Excel）";

  const hint =
    variant === "followup"
      ? "导入后可在下方队列查看，并通过表格右上角进入科研分析。"
      : "也可在患者数据库多选后批量进入；导入后下方直接展开三个分析模块。";

  return (
    <div className="pmp-card pmp-research-batch-import" style={{ padding: 16, marginBottom: 16 }}>
      <div className="pmp-panel-title" style={{ marginBottom: 8 }}>
        <CloudUploadOutlined style={{ marginRight: 6, color: "#1677ff" }} />
        {title}
      </div>
      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 12 }}>
        上传含 <Text code>.nii.gz</Text> 的 ZIP 与临床 Excel（含「就诊号」列）。
        预勾画：<Text code>roi_就诊号-… .nii.gz</Text>；可选 CT 原图：<Text code>ct_就诊号… .nii.gz</Text>（预览叠加显示）。
        病理分级：<Tag>1</Tag> 高级别，<Tag>0</Tag> 低级别。{hint}
      </Paragraph>

      <Row gutter={[12, 12]}>
        <Col xs={24} sm={12}>
          <Upload accept=".zip" showUploadList={false} beforeUpload={(f) => { setZipFile(f); return false; }}>
            <Button block icon={<CloudUploadOutlined />}>
              {zipFile ? zipFile.name : "选择预勾画 ZIP"}
            </Button>
          </Upload>
        </Col>
        <Col xs={24} sm={12}>
          <Upload
            accept=".xls,.xlsx,.csv"
            showUploadList={false}
            beforeUpload={(f) => { setExcelFile(f); return false; }}
          >
            <Button block icon={<FileExcelOutlined />}>
              {excelFile ? excelFile.name : "选择临床 Excel"}
            </Button>
          </Upload>
        </Col>
      </Row>

      <Button type="primary" block loading={loading} style={{ marginTop: 12 }} onClick={() => void handleImport()}>
        导入
      </Button>

      {batch ? (
        <Space wrap style={{ marginTop: 12 }}>
          <Tag color="blue">{batch.zipFileName}</Tag>
          <Tag color="green">{batch.excelFileName}</Tag>
          <Tag>{batch.cases.length} 例</Tag>
          <Tag color="cyan">已关联 {batch.matchedCount}</Tag>
        </Space>
      ) : null}
    </div>
  );
}

export { FOLLOWUP_BATCH_IMPORTED_EVENT };
