import { LineChartOutlined } from "@ant-design/icons";
import { App, Button, Col, Progress, Row, Select, Space, Table, Tabs, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import {
  MOCK_CORRELATIONS,
  MOCK_PROGNOSIS_MODEL,
  MOCK_PROGNOSIS_MODEL_METRICS,
  MOCK_SUBGROUP_FOREST,
  MOCK_SURVIVAL_SUMMARY,
} from "../../data/platformMock";

const { Title, Text, Paragraph } = Typography;

/** 简易 KM 曲线 SVG（两条生存曲线） */
function KmCurveChart() {
  const high = "M 30 160 L 50 155 L 70 148 L 90 138 L 110 125 L 130 108 L 150 95 L 170 88 L 190 82";
  const low = "M 30 160 L 50 158 L 70 155 L 90 150 L 110 145 L 130 138 L 150 128 L 170 118 L 190 108";
  return (
    <svg viewBox="0 0 220 180" style={{ width: "100%", maxWidth: 480, height: 220 }}>
      <line x1="30" y1="165" x2="200" y2="165" stroke="#e8edf5" />
      <line x1="30" y1="165" x2="30" y2="20" stroke="#e8edf5" />
      <path d={low} fill="none" stroke="#3f8600" strokeWidth="2.5" />
      <path d={high} fill="none" stroke="#cf1322" strokeWidth="2.5" />
      <text x="110" y="178" textAnchor="middle" fontSize="9" fill="#6b7280">
        时间（月）
      </text>
      <text x="12" y="90" textAnchor="middle" fontSize="9" fill="#6b7280" transform="rotate(-90 12 90)">
        生存率
      </text>
      <circle cx="175" cy="88" r="3" fill="#cf1322" />
      <text x="182" y="92" fontSize="8" fill="#cf1322">
        高级别
      </text>
      <circle cx="175" cy="108" r="3" fill="#3f8600" />
      <text x="182" y="112" fontSize="8" fill="#3f8600">
        低级别
      </text>
    </svg>
  );
}

/** 森林图：HR 及 95% CI */
function ForestPlot({ rows }: { rows: typeof MOCK_SUBGROUP_FOREST }) {
  const maxHr = 9;
  return (
    <div style={{ overflowX: "auto" }}>
      {rows.map((row) => {
        const left = Math.max(0, (row.ciLow / maxHr) * 100);
        const width = Math.min(100, ((row.ciHigh - row.ciLow) / maxHr) * 100);
        const point = Math.min(100, (row.hr / maxHr) * 100);
        return (
          <div
            key={row.subgroup}
            style={{
              display: "grid",
              gridTemplateColumns: "140px 1fr 100px 72px",
              gap: 12,
              alignItems: "center",
              marginBottom: 10,
              fontSize: 12,
            }}
          >
            <Text ellipsis title={row.subgroup}>
              {row.subgroup}
            </Text>
            <div style={{ position: "relative", height: 20, background: "#f8fafc", borderRadius: 4 }}>
              <div
                style={{
                  position: "absolute",
                  left: `${left}%`,
                  width: `${Math.max(width, 2)}%`,
                  top: 8,
                  height: 4,
                  background: "#91caff",
                  borderRadius: 2,
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${point}%`,
                  top: 4,
                  width: 10,
                  height: 10,
                  marginLeft: -5,
                  borderRadius: "50%",
                  background: row.sig ? "#1677ff" : "#9ca3af",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: `${(1 / maxHr) * 100}%`,
                  top: 0,
                  bottom: 0,
                  width: 1,
                  background: "#d1d5db",
                }}
              />
            </div>
            <Text type="secondary">
              {row.hr.toFixed(2)} ({row.ciLow.toFixed(2)}–{row.ciHigh.toFixed(2)})
            </Text>
            <Tag color={row.sig ? "blue" : "default"}>{row.pValue}</Tag>
          </div>
        );
      })}
      <Text type="secondary" style={{ fontSize: 11 }}>
        虚线：HR = 1.0 · 越靠右风险越高
      </Text>
    </div>
  );
}

function SurvivalTab() {
  const [stratify, setStratify] = useState<"grade" | "pmp">("grade");

  const rows = useMemo(() => {
    if (stratify === "pmp") {
      return MOCK_SURVIVAL_SUMMARY.filter((r) => r.group === "DPAM" || r.group === "PMCA");
    }
    return MOCK_SURVIVAL_SUMMARY.filter((r) => r.group === "高级别" || r.group === "低级别");
  }, [stratify]);

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Text type="secondary">分层变量：</Text>
        <Select
          value={stratify}
          style={{ width: 160 }}
          onChange={setStratify}
          options={[
            { value: "grade", label: "病理分级" },
            { value: "pmp", label: "PMP 分型" },
          ]}
        />
        <Tag>Log-rank p &lt; 0.001</Tag>
      </Space>
      <Row gutter={16}>
        <Col xs={24} lg={14}>
          <div className="pmp-card" style={{ padding: 16, marginBottom: 16, background: "#fafbfc" }}>
            <div className="pmp-panel-title">Kaplan-Meier 总生存（OS）</div>
            <KmCurveChart />
          </div>
        </Col>
        <Col xs={24} lg={10}>
          <Table
            size="small"
            pagination={false}
            rowKey="group"
            dataSource={rows}
            columns={[
              {
                title: "分组",
                dataIndex: "group",
                render: (v: string, r) => <Tag color={r.color === "#cf1322" ? "red" : r.color === "#3f8600" ? "green" : "blue"}>{v}</Tag>,
              },
              { title: "n", dataIndex: "n", width: 48 },
              { title: "事件", dataIndex: "events", width: 56 },
              { title: "中位 OS", dataIndex: "medianOs" },
              { title: "3 年 OS", dataIndex: "os3y", width: 72 },
            ]}
          />
        </Col>
      </Row>
      <Paragraph type="secondary" style={{ fontSize: 12, marginBottom: 0 }}>
        数据来源：PMP 专病库 n=128 · 高级别与 PMCA 组生存显著差于低级别/DPAM（演示）
      </Paragraph>
    </div>
  );
}

function SubgroupTab() {
  const [outcome, setOutcome] = useState("os");

  return (
    <div>
      <Space style={{ marginBottom: 16 }}>
        <Text type="secondary">结局：</Text>
        <Select
          value={outcome}
          style={{ width: 120 }}
          onChange={setOutcome}
          options={[
            { value: "os", label: "总生存 OS" },
            { value: "pfs", label: "无进展 PFS" },
          ]}
        />
        <Text type="secondary">暴露：病理分级（高级别 vs 低级别）</Text>
      </Space>
      <div className="pmp-panel-title">亚组森林图 · HR（95% CI）</div>
      <ForestPlot rows={MOCK_SUBGROUP_FOREST} />
    </div>
  );
}

function PrognosisModelTab() {
  const m = MOCK_PROGNOSIS_MODEL_METRICS;

  return (
    <div>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <div className="pmp-card" style={{ padding: 12, textAlign: "center" }}>
            <Text type="secondary">C-index</Text>
            <div style={{ fontSize: 22, fontWeight: 600, color: "#1677ff" }}>{m.cIndex}</div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="pmp-card" style={{ padding: 12, textAlign: "center" }}>
            <Text type="secondary">AUC</Text>
            <div style={{ fontSize: 22, fontWeight: 600 }}>{m.auc}</div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="pmp-card" style={{ padding: 12, textAlign: "center" }}>
            <Text type="secondary">样本 / 事件</Text>
            <div style={{ fontSize: 18, fontWeight: 600 }}>
              {m.samples} / {m.events}
            </div>
          </div>
        </Col>
        <Col xs={12} sm={6}>
          <div className="pmp-card" style={{ padding: 12 }}>
            <Text type="secondary">模型拟合</Text>
            <Progress percent={Math.round(m.cIndex * 100)} size="small" strokeColor="#1677ff" />
          </div>
        </Col>
      </Row>
      <div className="pmp-panel-title">Cox 多因素回归</div>
      <Table
        size="small"
        pagination={false}
        rowKey="factor"
        dataSource={MOCK_PROGNOSIS_MODEL}
        columns={[
          { title: "因素", dataIndex: "factor" },
          { title: "系数 β", dataIndex: "coef", render: (v: number) => v.toFixed(2) },
          { title: "HR", dataIndex: "hr" },
          { title: "95% CI", dataIndex: "ci" },
          { title: "P 值", dataIndex: "pValue" },
          { title: "显著性", dataIndex: "sig" },
        ]}
      />
      <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
        风险评分公式（演示）：{m.formula}
      </Paragraph>
    </div>
  );
}

export default function PlatformKnowledgePage() {
  const { message } = App.useApp();

  return (
    <div className="pmp-section">
      <Title level={4} style={{ marginBottom: 16 }}>
        <LineChartOutlined style={{ marginRight: 8, color: "#1677ff" }} />
        知识延伸分析
      </Title>
      <div className="pmp-card" style={{ padding: 16 }}>
        <Tabs
          items={[
            {
              key: "corr",
              label: "相关性分析",
              children: (
                <Table
                  size="small"
                  pagination={false}
                  rowKey="factor"
                  dataSource={MOCK_CORRELATIONS}
                  columns={[
                    { title: "因素", dataIndex: "factor" },
                    { title: "相关系数 r", dataIndex: "r", render: (v: number) => v.toFixed(2) },
                    { title: "P 值", dataIndex: "p", render: (v: number) => v.toFixed(3) },
                    { title: "显著性", dataIndex: "sig" },
                  ]}
                />
              ),
            },
            {
              key: "survival",
              label: "生存分析",
              children: <SurvivalTab />,
            },
            {
              key: "subgroup",
              label: "亚组分析",
              children: <SubgroupTab />,
            },
            {
              key: "model",
              label: "预后模型",
              children: <PrognosisModelTab />,
            },
          ]}
        />
        <div style={{ marginTop: 12, textAlign: "right" }}>
          <Button type="link" onClick={() => message.info("可导出至科研工具 · 统计分析（演示）")}>
            导出至统计分析 →
          </Button>
        </div>
      </div>
    </div>
  );
}
