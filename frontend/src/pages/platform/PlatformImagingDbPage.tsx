import { FileImageOutlined } from "@ant-design/icons";
import { Button, Descriptions, Drawer, Tabs, Typography } from "antd";
import { useMemo, useState } from "react";
import { DatabasePageShell, DbTitle, StatusTag } from "../../components/platform/DatabasePageShell";
import ImagingViewer from "../../components/platform/ImagingViewer";
import { MOCK_IMAGING_DB, type ImagingRecord } from "../../data/databaseMock";

const { Text, Paragraph } = Typography;

/** MR 与 MRI 统一筛选 */
function matchModality(row: ImagingRecord, filter: string) {
  if (filter === "MR") return row.modality === "MRI" || row.modality === "MR";
  return row.modality === filter;
}

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
            智能分析完成后自动入库 · 详情可调阅影像
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
        modalityLabel="模态"
        modalityOptions={[
          { value: "CT", label: "CT" },
          { value: "MR", label: "MR / MRI" },
          { value: "PET-CT", label: "PET-CT" },
          { value: "超声", label: "超声" },
        ]}
        modalityFilter={(row, m) => matchModality(row, m)}
        columns={[
          { title: "检查号", dataIndex: "id", width: 150 },
          { title: "患者", width: 100, render: (_, r) => r.patientName },
          { title: "模态", dataIndex: "modality", width: 88 },
          { title: "检查项目", dataIndex: "examItem", ellipsis: true },
          { title: "日期", dataIndex: "examDate", width: 100 },
          { title: "DICOM", dataIndex: "dicomCount", width: 72 },
          { title: "状态", width: 88, render: (_, r) => <StatusTag status={r.status} /> },
          {
            title: "操作",
            width: 88,
            fixed: "right",
            render: (_, r) => (
              <Button type="link" size="small" onClick={() => setDetail(r)}>
                详情 / 调阅
              </Button>
            ),
          },
        ]}
      />

      <Drawer
        title={detail ? `影像调阅 · ${detail.id}` : "影像详情"}
        open={!!detail}
        onClose={() => setDetail(null)}
        width={560}
      >
        {detail ? (
          <Tabs
            items={[
              {
                key: "viewer",
                label: "影像调阅",
                children: (
                  <ImagingViewer
                    modality={detail.modality}
                    bodyPart={detail.bodyPart}
                    dicomCount={detail.dicomCount}
                  />
                ),
              },
              {
                key: "report",
                label: "影像报告",
                children: (
                  <div>
                    <Descriptions column={1} size="small" bordered style={{ marginBottom: 16 }}>
                      <Descriptions.Item label="患者">
                        {detail.patientName}（{detail.patientId}）
                      </Descriptions.Item>
                      <Descriptions.Item label="模态">{detail.modality}</Descriptions.Item>
                      <Descriptions.Item label="部位">{detail.bodyPart}</Descriptions.Item>
                      <Descriptions.Item label="检查项目">{detail.examItem}</Descriptions.Item>
                      <Descriptions.Item label="检查日期">{detail.examDate}</Descriptions.Item>
                      <Descriptions.Item label="状态">
                        <StatusTag status={detail.status} />
                      </Descriptions.Item>
                    </Descriptions>
                    <Paragraph
                      style={{
                        whiteSpace: "pre-wrap",
                        fontSize: 13,
                        lineHeight: 1.85,
                        background: "#fafbfc",
                        padding: 12,
                        borderRadius: 8,
                        border: "1px solid #e8edf5",
                        margin: 0,
                      }}
                    >
                      {detail.reportText}
                    </Paragraph>
                    <Text type="secondary" style={{ display: "block", marginTop: 12, fontSize: 12 }}>
                      摘要：{detail.reportSummary}
                    </Text>
                  </div>
                ),
              },
            ]}
          />
        ) : null}
      </Drawer>
    </>
  );
}
