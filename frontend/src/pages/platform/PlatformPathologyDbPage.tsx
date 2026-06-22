import { CloudUploadOutlined, ExperimentOutlined } from "@ant-design/icons";
import { App, Button, Descriptions, Drawer, Space, Tag, Typography } from "antd";
import { useMemo, useState } from "react";
import { DatabasePageShell, DbTitle, GradeTag, StatusTag } from "../../components/platform/DatabasePageShell";
import { MOCK_PATHOLOGY_DB, type PathologyRecord } from "../../data/databaseMock";

const { Text, Paragraph } = Typography;

export default function PlatformPathologyDbPage() {
  const { message } = App.useApp();
  const [detail, setDetail] = useState<PathologyRecord | null>(null);

  const stats = useMemo(() => {
    const high = MOCK_PATHOLOGY_DB.filter((r) => r.gradeLabel === "高级别").length;
    const low = MOCK_PATHOLOGY_DB.filter((r) => r.gradeLabel === "低级别").length;
    const pmp = MOCK_PATHOLOGY_DB.filter((r) => r.pmpSubtype && r.pmpSubtype !== "—").length;
    return [
      { title: "病理报告", value: MOCK_PATHOLOGY_DB.length, suffix: "份" },
      { title: "高级别", value: high, suffix: "例", color: "#cf1322" },
      { title: "低级别", value: low, suffix: "例", color: "#3f8600" },
      { title: "PMP 分型", value: pmp, suffix: "例", color: "#1677ff" },
    ];
  }, []);

  return (
    <>
      <DatabasePageShell<PathologyRecord>
        title={
          <DbTitle level={4} style={{ margin: 0 }}>
            <ExperimentOutlined style={{ marginRight: 8, color: "#1677ff" }} />
            病理数据库
          </DbTitle>
        }
        extra={
          <Button type="primary" icon={<CloudUploadOutlined />} onClick={() => message.info("上传病理切片（演示）")}>
            上传切片
          </Button>
        }
        stats={stats}
        data={MOCK_PATHOLOGY_DB}
        rowKey={(r) => r.id}
        filterPlaceholder="搜索患者 / 病理号 / DPAM·PMCA"
        filterFn={(row, kw) =>
          !kw ||
          row.id.toLowerCase().includes(kw) ||
          row.patientName.toLowerCase().includes(kw) ||
          row.sampleSite.toLowerCase().includes(kw) ||
          row.pmpSubtype.toLowerCase().includes(kw) ||
          row.summary.toLowerCase().includes(kw)
        }
        modalityOptions={[
          { value: "高级别", label: "高级别" },
          { value: "低级别", label: "低级别" },
        ]}
        modalityFilter={(row, m) => row.gradeLabel === m}
        columns={[
          { title: "病理号", dataIndex: "id", width: 150 },
          { title: "患者", width: 88, render: (_, r) => r.patientName },
          { title: "取材部位", dataIndex: "sampleSite", width: 100 },
          { title: "染色", dataIndex: "stainType", width: 100 },
          { title: "分级", width: 88, render: (_, r) => <GradeTag label={r.gradeLabel} /> },
          { title: "WHO", dataIndex: "whoGrade", width: 56 },
          {
            title: "PMP 分型",
            width: 88,
            render: (_, r) =>
              r.pmpSubtype && r.pmpSubtype !== "—" ? (
                <Tag color={r.pmpSubtype === "PMCA" ? "red" : "green"}>{r.pmpSubtype}</Tag>
              ) : (
                "—"
              ),
          },
          { title: "Ki-67", dataIndex: "ki67", width: 72 },
          { title: "切片数", dataIndex: "slideCount", width: 72 },
          { title: "日期", dataIndex: "reportDate", width: 100 },
          { title: "状态", width: 88, render: (_, r) => <StatusTag status={r.status} /> },
          {
            title: "操作",
            width: 72,
            fixed: "right",
            render: (_, r) => (
              <Button type="link" size="small" onClick={() => setDetail(r)}>
                详情
              </Button>
            ),
          },
        ]}
      />

      <Drawer title="病理详情" open={!!detail} onClose={() => setDetail(null)} width={520}>
        {detail ? (
          <>
            <Space wrap style={{ marginBottom: 16 }}>
              {["HE", "Ki-67", "P53"].map((s) => (
                <div key={s} className="pmp-data-thumb" style={{ width: 80, height: 80 }}>
                  <span style={{ fontSize: 22 }}>🔬</span>
                  {s}
                </div>
              ))}
            </Space>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="病理号">{detail.id}</Descriptions.Item>
              <Descriptions.Item label="患者">{detail.patientName}</Descriptions.Item>
              <Descriptions.Item label="取材">{detail.sampleSite}</Descriptions.Item>
              <Descriptions.Item label="病理分级">
                <GradeTag label={detail.gradeLabel} /> WHO {detail.whoGrade}
              </Descriptions.Item>
              <Descriptions.Item label="免疫组化">
                Ki-67 {detail.ki67} · P53 {detail.p53}
              </Descriptions.Item>
              {detail.pmpSubtype !== "—" ? (
                <Descriptions.Item label="PMP 依据">
                  {detail.pmpSubtype === "DPAM" || detail.pmpSubtype === "LAMN"
                    ? "[低级别] 扩散性腹膜腺瘤病 / 低级别粘液性表型"
                    : "[高级别] 腹膜粘液癌表型"}
                </Descriptions.Item>
              ) : null}
              <Descriptions.Item label="诊断摘要">{detail.summary}</Descriptions.Item>
              <Descriptions.Item label="签发">{detail.pathologist} · {detail.reportDate}</Descriptions.Item>
            </Descriptions>
            <Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
              支持 WS I 全切片浏览与 AI 辅助分级（演示）。
            </Paragraph>
          </>
        ) : null}
      </Drawer>
    </>
  );
}
