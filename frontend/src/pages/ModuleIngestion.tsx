import { InboxOutlined } from "@ant-design/icons";
import { App, Alert, Button, Col, Divider, Input, Row, Spin, Statistic, Switch, Table, Tag, Typography, Upload } from "antd";
import axios from "axios";
import { useState } from "react";
import { Link } from "react-router-dom";
import type { BatchIngestItem, PathologyBatchCohortResult } from "../api/client";
import { batchIngest, pathologyBatchCohort } from "../api/client";

const { Paragraph, Text } = Typography;

export default function ModuleIngestion() {
  const { message } = App.useApp();
  const [persist, setPersist] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<BatchIngestItem[]>([]);
  const [clinicalDiagnosis, setClinicalDiagnosis] = useState("发热待查 · 待病理进一步明确");
  const [cohort, setCohort] = useState<PathologyBatchCohortResult | null>(null);

  return (
    <div>
      <Typography.Title level={4} className="glass-page-title">
        病历输入
      </Typography.Title>
      <Paragraph type="secondary">
        工作台第 1 步：批量上传 DICOM（.dcm / ZIP），录入临床诊断，完成结构化解析与入库；上传后自动统计高/低级别队列分布。
      </Paragraph>
      <Alert
        type="warning"
        showIcon
        closable
        message="上传依赖本机后端 API（默认 8000 端口）"
        description="请先在 PMP Agent 的 backend 目录执行：uvicorn app.main:app --reload --host 127.0.0.1 --port 8000。"
        style={{ marginBottom: 16 }}
      />

      <Typography.Title level={5} style={{ marginTop: 0 }}>
        临床诊断
      </Typography.Title>
      <Input.TextArea
        rows={2}
        value={clinicalDiagnosis}
        onChange={(e) => setClinicalDiagnosis(e.target.value)}
        placeholder="输入临床诊断，如：卵巢高级别浆液性癌待排、肺腺癌等"
        style={{ maxWidth: 640, marginBottom: 16 }}
      />

      <Typography.Title level={5}>DICOM / 病历文件上传</Typography.Title>
      <div style={{ marginBottom: 16, display: "flex", alignItems: "center", gap: 12 }}>
        <span>解析后直接入库</span>
        <Switch checked={persist} onChange={setPersist} />
      </div>
      <Spin spinning={loading} tip="正在解析并请求后端…">
        <Upload.Dragger
          multiple
          disabled={loading}
          accept="image/*,.json,application/json,.pdf,application/pdf,.dcm,application/dicom,.zip,application/zip,application/x-zip-compressed"
          showUploadList
          beforeUpload={async (file, fileList) => {
            const last = fileList[fileList.length - 1];
            if (!last || last.uid !== file.uid) return false;
            setLoading(true);
            try {
              const files = fileList.map((f) => (("originFileObj" in f && f.originFileObj) || f) as File);
              const [data, cohortRes] = await Promise.all([
                batchIngest(files, persist),
                pathologyBatchCohort(files).catch(() => null),
              ]);
              setRows(data);
              if (cohortRes && cohortRes.total > 0) setCohort(cohortRes);
              const failed = data.filter((r) => !r.ok).length;
              if (failed) {
                message.warning(`已处理 ${data.length} 个文件，其中 ${failed} 个失败`);
              } else {
                message.success(`已处理 ${data.length} 个文件，临床诊断已关联`);
              }
            } catch (e: unknown) {
              let hint = "请确认后端已启动（127.0.0.1:8000）。";
              if (axios.isAxiosError(e)) {
                if (e.code === "ECONNABORTED" || e.message.includes("timeout")) hint = "请求超时。";
                else if (e.code === "ERR_NETWORK" || e.message.includes("ETIMEDOUT")) {
                  hint = "无法连接后端，请先启动 uvicorn。";
                }
              }
              message.error(`批量解析失败：${hint}`);
            } finally {
              setLoading(false);
            }
            return false;
          }}
        >
          <p className="ant-upload-drag-icon">
            <InboxOutlined />
          </p>
          <p className="ant-upload-text">拖拽 DICOM / ZIP / JSON 到此处</p>
          <p className="ant-upload-hint">
            优先上传 .dcm 或含 .dcm 的 ZIP；约 160 例可平衡为高级别 ~80、低级别 ~80。
          </p>
        </Upload.Dragger>
      </Spin>

      {cohort && cohort.total > 0 ? (
        <div style={{ marginTop: 24 }}>
          <Divider />
          <Typography.Title level={5}>队列诊断分布</Typography.Title>
          <Row gutter={16}>
            <Col span={6}>
              <Statistic title="总计" value={cohort.total} />
            </Col>
            <Col span={6}>
              <Statistic title="高级别" value={cohort.high_grade_count} valueStyle={{ color: "#cf1322" }} />
            </Col>
            <Col span={6}>
              <Statistic title="低级别" value={cohort.low_grade_count} valueStyle={{ color: "#3f8600" }} />
            </Col>
            <Col span={6}>
              <Statistic title="未明确" value={cohort.unknown_count} />
            </Col>
          </Row>
          <Paragraph style={{ marginTop: 12 }}>{cohort.summary}</Paragraph>
          <Text type="secondary">{cohort.target_distribution_note}</Text>
        </div>
      ) : null}

      <Button type="link" disabled={loading} style={{ marginTop: 12 }} onClick={() => { setRows([]); setCohort(null); }}>
        清空结果
      </Button>
      <Table
        style={{ marginTop: 16 }}
        size="small"
        rowKey={(r) => r.filename}
        dataSource={rows}
        pagination={false}
        columns={[
          { title: "文件", dataIndex: "filename" },
          { title: "状态", dataIndex: "ok", render: (v: boolean) => (v ? <Tag color="green">成功</Tag> : <Tag color="red">失败</Tag>) },
          { title: "说明", dataIndex: "detail" },
        ]}
      />
      <Paragraph style={{ marginTop: 24 }}>
        下一步 →{" "}
        <Link to="/pathology" className="glass-link">
          诊断结果
        </Link>
      </Paragraph>
    </div>
  );
}
