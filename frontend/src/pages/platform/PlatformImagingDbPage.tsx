import { FileImageOutlined } from "@ant-design/icons";
import { Button, Descriptions, Drawer, Typography } from "antd";
import { useMemo, useState } from "react";
import { DatabasePageShell, DbTitle, StatusTag } from "../../components/platform/DatabasePageShell";
import { MOCK_IMAGING_DB, type ImagingRecord } from "../../data/databaseMock";

const { Text } = Typography;

export default function PlatformImagingDbPage() {
  const [detail, setDetail] = useState<ImagingRecord | null>(null);

  const stats = useMemo(() => {
    return [
      { title: "影像总数", value: MOCK_IMAGING_DB.length, suffix: "例" },
      { title: "DICOM 总量", value: MOCK_IMAGING_DB.reduce((s, r) => s + r.dicomCount, 0), suffix: "张" },
    ];
  }, []);

  return (
    <>
      <DatabasePageShell<ImagingRecord>
        title={
          <DbTitle level={4} style={{ margin: 0 }}>
            <FileImageOutlined style={{ marginRight: 8, color: "#1677ff" }} />
            影像数据库
          </DbTitle>
        }
        extra={
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            智能分析完成后自动入库
          </Typography.Text>
        }
        stats={stats}
        data={MOCK_IMAGING_DB}
        rowKey={(r) => r.id}
        filterPlaceholder="搜索患者 / 检查号 / 报告摘要"
        filterFn={(row, kw) =>
          !kw ||
          row.id.toLowerCase().includes(kw) ||
          row.patientName.toLowerCase().includes(kw) ||
          row.patientId.toLowerCase().includes(kw) ||
          row.reportSummary.toLowerCase().includes(kw) ||
          row.examItem.toLowerCase().includes(kw)
        }
        modalityOptions={[
          { value: "PET-CT", label: "PET-CT" },
          { value: "CT", label: "CT" },
          { value: "MRI", label: "MRI" },
          { value: "超声", label: "超声" },
        ]}
        modalityFilter={(row, m) => row.modality === m}
        columns={[
          { title: "检查号", dataIndex: "id", width: 150 },
          { title: "患者", width: 100, render: (_, r) => r.patientName },
          { title: "模态", dataIndex: "modality", width: 88 },
          { title: "检查项目", dataIndex: "examItem", ellipsis: true },
          { title: "日期", dataIndex: "examDate", width: 100 },
          {
            title: "SUVmax",
            width: 80,
            render: (_, r) => (r.suvMax != null ? r.suvMax.toFixed(1) : "—"),
          },
          { title: "MTV", width: 72, render: (_, r) => (r.mtv != null ? r.mtv.toFixed(1) : "—") },
          { title: "病灶", dataIndex: "lesionCount", width: 60 },
          { title: "DICOM", dataIndex: "dicomCount", width: 72 },
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

      <Drawer title="影像详情" open={!!detail} onClose={() => setDetail(null)} width={480}>
        {detail ? (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 16 }}>
              {["轴位", "冠状", "PET 融合"].map((v) => (
                <div key={v} className="pmp-data-thumb" style={{ width: "100%", height: 88 }}>
                  <span style={{ fontSize: 24 }}>🩻</span>
                  {v}
                </div>
              ))}
            </div>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="检查号">{detail.id}</Descriptions.Item>
              <Descriptions.Item label="患者">{detail.patientName}（{detail.patientId}）</Descriptions.Item>
              <Descriptions.Item label="模态">{detail.modality}</Descriptions.Item>
              <Descriptions.Item label="部位">{detail.bodyPart}</Descriptions.Item>
              <Descriptions.Item label="检查项目">{detail.examItem}</Descriptions.Item>
              <Descriptions.Item label="SUVmax">{detail.suvMax ?? "—"}</Descriptions.Item>
              <Descriptions.Item label="MTV / TLG">
                {detail.mtv ?? "—"} / {detail.tlg ?? "—"}
              </Descriptions.Item>
              <Descriptions.Item label="报告摘要">{detail.reportSummary}</Descriptions.Item>
            </Descriptions>
            {!detail.hasPet ? (
              <Text type="secondary" style={{ display: "block", marginTop: 12, fontSize: 12 }}>
                若未上传含 PET 的 DICOM，则不会显示 SUV 等代谢指标。
              </Text>
            ) : null}
          </>
        ) : null}
      </Drawer>
    </>
  );
}
