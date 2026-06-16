import { App, Button, Descriptions, Space, Table, Tag, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import {
  exportTrainingData,
  getTrainingStatus,
  runTraining,
  type TrainingExportResult,
  type TrainingRunResult,
  type TrainingStatus,
} from "../api/client";

const { Paragraph, Text } = Typography;

export default function IngestionTrainingPanel() {
  const { message } = App.useApp();
  const [status, setStatus] = useState<TrainingStatus | null>(null);
  const [exportResult, setExportResult] = useState<TrainingExportResult | null>(null);
  const [trainResult, setTrainResult] = useState<TrainingRunResult | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingExport, setLoadingExport] = useState(false);
  const [loadingTrain, setLoadingTrain] = useState(false);

  const refreshStatus = useCallback(async () => {
    setLoadingStatus(true);
    try {
      const s = await getTrainingStatus();
      setStatus(s);
    } catch {
      message.error("获取训练状态失败");
    } finally {
      setLoadingStatus(false);
    }
  }, [message]);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  async function onExport() {
    setLoadingExport(true);
    try {
      const res = await exportTrainingData();
      setExportResult(res);
      message.success(`已导出 ${res.total_rows} 条训练样本`);
      void refreshStatus();
    } catch (e: unknown) {
      const detail =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      message.error(detail || "导出失败，请先入库病例");
    } finally {
      setLoadingExport(false);
    }
  }

  async function onTrain() {
    setLoadingTrain(true);
    try {
      const res = await runTraining();
      setTrainResult(res);
      message.success(`训练完成，准确率 ${(res.accuracy * 100).toFixed(1)}%`);
      void refreshStatus();
    } catch (e: unknown) {
      const detail =
        e && typeof e === "object" && "response" in e
          ? (e as { response?: { data?: { detail?: string } } }).response?.data?.detail
          : undefined;
      message.error(detail || "训练失败");
    } finally {
      setLoadingTrain(false);
    }
  }

  return (
    <div>
      <Paragraph type="secondary">
        从已入库病例导出特征与标签（高级别 / 低级别），训练 RandomForest 分类模型。
        训练完成后，第 2 步「诊断结果」将优先使用模型预测。建议各等级约 80 例样本。
      </Paragraph>

      <Descriptions bordered size="small" column={2} style={{ marginBottom: 16 }}>
        <Descriptions.Item label="库内病例数">{status?.db_case_count ?? "—"}</Descriptions.Item>
        <Descriptions.Item label="训练 CSV">
          {status?.csv_exists ? <Tag color="green">已生成</Tag> : <Tag>未导出</Tag>}
        </Descriptions.Item>
        <Descriptions.Item label="模型文件">
          {status?.model_exists ? <Tag color="blue">已训练</Tag> : <Tag>未训练</Tag>}
        </Descriptions.Item>
        <Descriptions.Item label="上次准确率">
          {status?.last_training?.accuracy != null
            ? `${(Number(status.last_training.accuracy) * 100).toFixed(1)}%`
            : "—"}
        </Descriptions.Item>
      </Descriptions>

      <Space wrap style={{ marginBottom: 16 }}>
        <Button onClick={() => void refreshStatus()} loading={loadingStatus}>
          刷新状态
        </Button>
        <Button type="primary" onClick={() => void onExport()} loading={loadingExport}>
          导出训练数据
        </Button>
        <Button type="primary" onClick={() => void onTrain()} loading={loadingTrain}>
          开始训练
        </Button>
        <Button
          disabled={!status?.csv_exists}
          onClick={() => {
            window.open("/api/v1/modules/training/download-csv", "_blank");
          }}
        >
          下载 CSV
        </Button>
      </Space>

      {exportResult ? (
        <div style={{ marginBottom: 20 }}>
          <Text strong>导出摘要：</Text>
          <Paragraph style={{ marginBottom: 8 }}>
            共 {exportResult.total_rows} 条 · 高级别 {exportResult.high_grade_count} · 低级别{" "}
            {exportResult.low_grade_count}
          </Paragraph>
          <Table
            size="small"
            rowKey="exam_id"
            pagination={false}
            dataSource={exportResult.preview}
            scroll={{ x: 800 }}
            columns={[
              { title: "检查号", dataIndex: "exam_id", width: 120 },
              { title: "临床诊断", dataIndex: "clinical_diagnosis", ellipsis: true },
              { title: "年龄", dataIndex: "age", width: 60 },
              { title: "SUVmax", dataIndex: "suv_max", width: 72 },
              {
                title: "标签",
                dataIndex: "grade_label",
                width: 88,
                render: (v: string) => (
                  <Tag color={v === "高级别" ? "red" : "green"}>{v}</Tag>
                ),
              },
            ]}
          />
        </div>
      ) : null}

      {trainResult ? (
        <Descriptions bordered size="small" column={1} title="训练结果">
          <Descriptions.Item label="样本数">{trainResult.samples}</Descriptions.Item>
          <Descriptions.Item label="高级别 / 低级别">
            {trainResult.high_grade_count} / {trainResult.low_grade_count}
          </Descriptions.Item>
          <Descriptions.Item label="测试集准确率">
            {(trainResult.accuracy * 100).toFixed(1)}%
          </Descriptions.Item>
          <Descriptions.Item label="模型路径">{trainResult.model_path}</Descriptions.Item>
          <Descriptions.Item label="特征">
            {trainResult.feature_cols?.join("、")}
          </Descriptions.Item>
        </Descriptions>
      ) : null}

      <Paragraph type="secondary" style={{ marginTop: 16, marginBottom: 0 }}>
        命令行等价操作（在 backend 目录）：
        <br />
        <Text code>python -m ml.train_pathology export</Text>
        {" · "}
        <Text code>python -m ml.train_pathology train</Text>
      </Paragraph>
    </div>
  );
}
