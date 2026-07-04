import { App, Button, Empty, Select, Space, Spin, Switch, Table, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import type { ClinicalAnalyzeResult } from "../../../api/platform";
import { runClinicalAnalysis } from "../../../lib/clinicalDataset/analyzeApi";
import type { ClinicalDataset } from "../../../lib/clinicalDataset/types";

const { Text, Paragraph } = Typography;

const METHODS = [
  { key: "multi_reg", label: "多元回归分析", analysis: "multi_reg" as const },
  { key: "logistic", label: "逻辑回归", analysis: "logistic" as const },
  { key: "survival", label: "生存率分析", analysis: "survival" as const },
  { key: "cox", label: "Cox 比例风险回归", analysis: "cox" as const },
];

type Props = {
  dataset: ClinicalDataset;
};

export default function ClinicalDatasetAdvancedStatsTab({ dataset }: Props) {
  const { message } = App.useApp();
  const [method, setMethod] = useState("multi_reg");
  const [dependent, setDependent] = useState<string>();
  const [independents, setIndependents] = useState<string[]>([]);
  const [timeVar, setTimeVar] = useState<string>();
  const [eventVar, setEventVar] = useState<string>();
  const [splitVar, setSplitVar] = useState<string>();
  const [univariate, setUnivariate] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ClinicalAnalyzeResult | null>(null);

  const current = METHODS.find((m) => m.key === method)!;

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

  const catOptions = dataset.variables
    .filter((v) => (v.type === "categorical" || v.type === "text") && !v.skipped)
    .map((v) => ({ value: v.name, label: v.name }));

  async function handleRun() {
    if (method === "multi_reg" && !dependent) {
      message.warning("请选择因变量");
      return;
    }
    if (method === "logistic" && (!dependent || !independents.length)) {
      message.warning("逻辑回归需选择结局变量和自变量");
      return;
    }
    if ((method === "survival" || method === "cox") && (!timeVar || !eventVar)) {
      message.warning("生存分析需选择时间变量和事件变量");
      return;
    }
    if (method === "cox" && !independents.length) {
      message.warning("Cox 回归需选择协变量");
      return;
    }

    setLoading(true);
    try {
      const vars = univariate && independents.length === 0 ? allVarOptions.map((o) => o.value).slice(0, 5) : independents;
      const res = await runClinicalAnalysis(dataset, current.analysis, {
        dependent,
        independents: vars.filter((v) => v !== dependent),
        outcome_var: method === "logistic" ? dependent : eventVar,
        time_var: timeVar,
        event_var: eventVar,
        split_var: splitVar,
      });
      setResult(res);
      message.success(res.summary || "分析完成");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "分析失败");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  const kmCurves = (result?.extra?.curves as { group: string; points: { time: number; survival: number }[] }[]) ?? [];

  return (
    <div className="pmp-clinical-stats-layout">
      <div className="pmp-clinical-stats-tools">
        {METHODS.map((m) => (
          <button
            key={m.key}
            type="button"
            className={`pmp-clinical-tool-card${method === m.key ? " pmp-clinical-tool-card--active" : ""}`}
            onClick={() => {
              setMethod(m.key);
              setResult(null);
            }}
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
          {(method === "multi_reg" || method === "logistic") && (
            <>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {method === "logistic" ? "结局变量（二分类）" : "因变量（数值型）"}
                </Text>
                <Select
                  style={{ width: "100%", marginTop: 4 }}
                  placeholder="请选择"
                  value={dependent}
                  onChange={setDependent}
                  options={method === "logistic" ? catOptions : numericOptions}
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
            </>
          )}
          {(method === "survival" || method === "cox") && (
            <>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  时间变量
                </Text>
                <Select style={{ width: "100%", marginTop: 4 }} value={timeVar} onChange={setTimeVar} options={numericOptions} />
              </div>
              <div style={{ marginBottom: 12 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  事件变量（0/1 或 是/否）
                </Text>
                <Select style={{ width: "100%", marginTop: 4 }} value={eventVar} onChange={setEventVar} options={catOptions} />
              </div>
              {method === "survival" && (
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    分组（可选）
                  </Text>
                  <Select allowClear style={{ width: "100%", marginTop: 4 }} value={splitVar} onChange={setSplitVar} options={catOptions} />
                </div>
              )}
              {method === "cox" && (
                <div style={{ marginBottom: 12 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    协变量
                  </Text>
                  <Select mode="multiple" style={{ width: "100%", marginTop: 4 }} value={independents} onChange={setIndependents} options={allVarOptions} />
                </div>
              )}
            </>
          )}
          <Space style={{ marginBottom: 8, width: "100%", justifyContent: "space-between" }}>
            <Text style={{ fontSize: 12 }}>单因素分析</Text>
            <Switch size="small" checked={univariate} onChange={setUnivariate} />
          </Space>
          <Button type="primary" block loading={loading} onClick={handleRun}>
            开始分析
          </Button>
        </div>

        <div className="pmp-card pmp-clinical-stats-main">
          <Spin spinning={loading}>
            {!result ? (
              <Empty description="配置变量后点击「开始分析」" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            ) : method === "survival" ? (
              <Space direction="vertical" style={{ width: "100%" }}>
                <Paragraph style={{ fontSize: 12 }}>{result.summary}</Paragraph>
                {result.extra.logrank_p ? <Tag>Log-rank P = {String(result.extra.logrank_p)}</Tag> : null}
                {kmCurves.map((c) => (
                  <div key={c.group}>
                    <Text strong>{c.group}</Text>
                    <div className="pmp-km-chart">
                      {c.points.map((p, i) => (
                        <div key={i} className="pmp-km-dot" style={{ left: `${Math.min(p.time, 120)}%`, bottom: `${p.survival * 100}%` }} />
                      ))}
                    </div>
                  </div>
                ))}
              </Space>
            ) : (
              <>
                <Paragraph type="secondary" style={{ fontSize: 12 }}>
                  {result.summary}
                  {result.extra.r_squared != null ? ` · R²=${result.extra.r_squared}` : ""}
                  {result.extra.concordance != null ? ` · C-index=${result.extra.concordance}` : ""}
                  {result.extra.accuracy != null ? ` · 准确率=${result.extra.accuracy}` : ""}
                </Paragraph>
                <Table
                  size="small"
                  pagination={false}
                  rowKey="factor"
                  dataSource={result.rows as Record<string, unknown>[]}
                  columns={[
                    { title: "因素", dataIndex: "factor" },
                    { title: "系数/HR", render: (_, r) => r.coef ?? r.hr ?? r.odds_ratio ?? "—" },
                    { title: "标准误", dataIndex: "se" },
                    { title: "P 值", dataIndex: "pValue" },
                    { title: "显著性", dataIndex: "sig" },
                  ]}
                />
              </>
            )}
          </Spin>
        </div>
      </div>
    </div>
  );
}
