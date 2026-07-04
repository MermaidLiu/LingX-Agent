import { App, Button, Empty, Select, Space, Switch, Table, Typography } from "antd";
import { useMemo, useState } from "react";
import type { ClinicalDataset } from "../../../lib/clinicalDataset/types";

const { Text } = Typography;

const METHODS = [
  { key: "multi_reg", label: "多元回归分析" },
  { key: "logistic", label: "逻辑回归" },
  { key: "survival", label: "生存率分析" },
  { key: "cox", label: "Cox 比例风险回归" },
  { key: "markov", label: "马尔可夫链 CTMC" },
  { key: "arimax", label: "ARIMAX 时间序列分析" },
];

type Props = {
  dataset: ClinicalDataset;
};

export default function ClinicalDatasetAdvancedStatsTab({ dataset }: Props) {
  const { message } = App.useApp();
  const [method, setMethod] = useState("multi_reg");
  const [dependent, setDependent] = useState<string>();
  const [independents, setIndependents] = useState<string[]>([]);
  const [univariate, setUnivariate] = useState(true);
  const [pThreshold, setPThreshold] = useState("0.10");
  const [screenMethod, setScreenMethod] = useState("stepwise");
  const [ran, setRan] = useState(false);

  const numericOptions = useMemo(
    () =>
      dataset.variables
        .filter((v) => v.type === "numerical" && !v.skipped)
        .map((v) => ({ value: v.name, label: v.name })),
    [dataset.variables],
  );

  const allVarOptions = useMemo(
    () =>
      dataset.variables
        .filter((v) => !v.skipped && v.type !== "file")
        .map((v) => ({ value: v.name, label: `${v.name} (${v.type === "numerical" ? "数值" : "分类"})` })),
    [dataset.variables],
  );

  const mockResults = useMemo(() => {
    if (!ran || !dependent) return [];
    return independents.slice(0, 5).map((name, i) => ({
      factor: name,
      coef: (0.3 + i * 0.15).toFixed(3),
      se: (0.08 + i * 0.02).toFixed(3),
      pValue: i === 0 ? "0.012" : "0.084",
      sig: i === 0 ? "★" : "ns",
    }));
  }, [ran, dependent, independents]);

  return (
    <div className="pmp-clinical-stats-layout">
      <div className="pmp-clinical-stats-tools">
        {METHODS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`pmp-clinical-tool-card${method === m.key ? " pmp-clinical-tool-card--active" : ""}`}
            onClick={() => setMethod(m.key)}
          >
            {m.label}
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
              因变量
            </Text>
            <Text type="secondary" style={{ fontSize: 11, display: "block" }}>
              只可选择一个数值型变量
            </Text>
            <Select
              style={{ width: "100%", marginTop: 4 }}
              placeholder="请选择"
              value={dependent}
              onChange={setDependent}
              options={numericOptions}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              自变量
            </Text>
            <Select
              mode="multiple"
              style={{ width: "100%", marginTop: 4 }}
              placeholder="请选择"
              value={independents}
              onChange={setIndependents}
              options={allVarOptions}
            />
          </div>
          <div style={{ marginBottom: 8 }}>
            <Text type="secondary" style={{ fontSize: 12 }}>
              更多设置
            </Text>
            <Space style={{ marginTop: 6, width: "100%", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 12 }}>单因素分析</Text>
              <Switch size="small" checked={univariate} onChange={setUnivariate} />
            </Space>
            <Select
              size="small"
              style={{ width: "100%", marginTop: 6 }}
              value={pThreshold}
              onChange={setPThreshold}
              options={[
                { value: "0.05", label: "P < 0.05" },
                { value: "0.10", label: "P < 0.10" },
              ]}
            />
            <Select
              size="small"
              style={{ width: "100%", marginTop: 6 }}
              value={screenMethod}
              onChange={setScreenMethod}
              options={[
                { value: "stepwise", label: "逐步回归法" },
                { value: "lasso", label: "LASSO" },
              ]}
            />
          </div>
          <Button
            type="primary"
            block
            onClick={() => {
              if (!dependent) {
                message.warning("请选择因变量");
                return;
              }
              setRan(true);
              message.success(`${METHODS.find((m) => m.key === method)?.label} 完成`);
            }}
          >
            开始分析
          </Button>
        </div>

        <div className="pmp-card pmp-clinical-stats-main">
          {!ran ? (
            <Empty description="请添加变量进行分析" image={Empty.PRESENTED_IMAGE_SIMPLE} />
          ) : (
            <Table
              size="small"
              pagination={false}
              rowKey="factor"
              dataSource={mockResults}
              columns={[
                { title: "因素", dataIndex: "factor" },
                { title: "系数", dataIndex: "coef" },
                { title: "标准误", dataIndex: "se" },
                { title: "P 值", dataIndex: "pValue" },
                { title: "显著性", dataIndex: "sig" },
              ]}
            />
          )}
        </div>
      </div>
    </div>
  );
}
