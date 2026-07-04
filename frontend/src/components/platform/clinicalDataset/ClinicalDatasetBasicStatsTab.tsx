import { BarChartOutlined, LineChartOutlined, PieChartOutlined, RiseOutlined, SafetyCertificateOutlined } from "@ant-design/icons";
import { App, Button, Empty, Select, Space, Table, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { computeDescriptiveStats } from "../../../lib/clinicalDataset/statsCompute";
import type { ClinicalDataset } from "../../../lib/clinicalDataset/types";

const { Text } = Typography;

const TOOLS = [
  { key: "desc", label: "描述性统计", icon: <PieChartOutlined /> },
  { key: "sig", label: "显著性分析", icon: <BarChartOutlined /> },
  { key: "corr", label: "相关性分析", icon: <LineChartOutlined /> },
  { key: "roc", label: "ROC 曲线", icon: <RiseOutlined /> },
  { key: "consistency", label: "一致性检验", icon: <SafetyCertificateOutlined /> },
];

type Props = {
  dataset: ClinicalDataset;
};

export default function ClinicalDatasetBasicStatsTab({ dataset }: Props) {
  const { message } = App.useApp();
  const [tool, setTool] = useState("desc");
  const [selectedVars, setSelectedVars] = useState<string[]>([]);
  const [splitVar, setSplitVar] = useState<string | undefined>();
  const [ran, setRan] = useState(false);

  const varOptions = dataset.variables
    .filter((v) => !v.skipped && v.type !== "file")
    .map((v) => ({ value: v.name, label: v.name }));

  const catOptions = dataset.variables
    .filter((v) => v.type === "categorical" && !v.skipped)
    .map((v) => ({ value: v.name, label: v.name }));

  const descRows = useMemo(() => {
    if (!ran || tool !== "desc") return [];
    const all = computeDescriptiveStats(dataset);
    if (!selectedVars.length) return all;
    return all.filter((r) => selectedVars.includes(r.variable));
  }, [dataset, ran, tool, selectedVars]);

  return (
    <div className="pmp-clinical-stats-layout">
      <div className="pmp-clinical-stats-tools">
        {TOOLS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`pmp-clinical-tool-card${tool === t.key ? " pmp-clinical-tool-card--active" : ""}`}
            onClick={() => setTool(t.key)}
          >
            <span className="pmp-clinical-tool-icon">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      <div className="pmp-clinical-stats-body">
        <div className="pmp-card pmp-clinical-stats-sidebar">
          <div className="pmp-panel-title" style={{ fontSize: 13 }}>
            变量选择
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              变量
            </Text>
            <Select
              mode="multiple"
              allowClear
              style={{ width: "100%", marginTop: 4 }}
              placeholder="请选择"
              value={selectedVars}
              onChange={setSelectedVars}
              options={varOptions}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              拆分维度
            </Text>
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
              只可选择一个分类型变量
            </Text>
            <Select
              allowClear
              style={{ width: "100%", marginTop: 4 }}
              placeholder="请选择"
              value={splitVar}
              onChange={setSplitVar}
              options={catOptions}
            />
          </div>
          <Button
            type="primary"
            block
            onClick={() => {
              if (!selectedVars.length && tool === "desc") {
                message.warning("请至少选择一个变量");
                return;
              }
              setRan(true);
              message.success("分析完成");
            }}
          >
            开始分析
          </Button>
        </div>

        <div className="pmp-card pmp-clinical-stats-main">
          {!ran ? (
            <Empty description="请添加变量进行分析" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : tool === "desc" ? (
            <Table
              size="small"
              pagination={false}
              rowKey="variable"
              dataSource={descRows}
              columns={[
                { title: "变量", dataIndex: "variable" },
                { title: "类型", dataIndex: "type", width: 80 },
                { title: "均值", dataIndex: "mean", width: 72 },
                { title: "标准差", dataIndex: "sd", width: 72 },
                { title: "中位数", dataIndex: "median", width: 72 },
                { title: "分类分布", dataIndex: "categories", ellipsis: true },
                { title: "n", dataIndex: "n", width: 48 },
              ]}
            />
          ) : (
            <Empty
              description={`${TOOLS.find((t) => t.key === tool)?.label} · 基于当前数据集（演示）`}
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <Space>
                <Tag color="blue">n = {dataset.rows.length}</Tag>
                {splitVar ? <Tag>拆分：{splitVar}</Tag> : null}
              </Space>
            </Empty>
          )}
        </div>
      </div>
    </div>
  );
}
