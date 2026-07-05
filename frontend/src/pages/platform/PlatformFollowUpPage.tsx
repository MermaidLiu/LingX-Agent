import { ReloadOutlined, TeamOutlined } from "@ant-design/icons";
import { App, Button, Card, Table, Tag, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { cohortQuery, type PetCtInterviewRecord } from "../../api/client";
import { FOLLOWUP_PHENOTYPE_TAG, listFollowUpQueue, type FollowUpEntry } from "../../lib/followUpQueue";

const { Title, Paragraph } = Typography;

export default function PlatformFollowUpPage() {
  const { message } = App.useApp();
  const [queue, setQueue] = useState<FollowUpEntry[]>([]);
  const [dbRecords, setDbRecords] = useState<PetCtInterviewRecord[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);

  const refreshQueue = useCallback(() => {
    setQueue(listFollowUpQueue());
  }, []);

  const loadDbFollowUp = useCallback(async () => {
    setLoadingDb(true);
    try {
      const data = await cohortQuery({
        phenotype_tag: FOLLOWUP_PHENOTYPE_TAG,
        limit: 100,
        skip: 0,
      });
      setDbRecords(data.records || []);
    } catch {
      message.error("数据库随访队列查询失败");
    } finally {
      setLoadingDb(false);
    }
  }, [message]);

  useEffect(() => {
    refreshQueue();
    void loadDbFollowUp();
  }, [refreshQueue, loadDbFollowUp]);

  const gradeColor = (label: string) =>
    label === "高级别" ? "red" : label === "低级别" ? "green" : "default";

  return (
    <div className="pmp-section">
      <Title level={4}>
        <TeamOutlined style={{ marginRight: 8, color: "#1677ff" }} />
        随访队列
      </Title>
      <Paragraph type="secondary">
        在「智能分析」完成影像报告与治疗建议后，点击「加入随访队列」的病例会出现在此处，并同步至患者数据库。
      </Paragraph>

      <Card
        title="本机随访队列"
        size="small"
        style={{ marginBottom: 16 }}
        extra={
          <Button
            size="small"
            icon={<ReloadOutlined />}
            onClick={() => {
              refreshQueue();
              void loadDbFollowUp();
            }}
          >
            刷新
          </Button>
        }
      >
        {queue.length === 0 ? (
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            暂无随访病例。请先在 <Link to="/analysis">智能分析</Link> 完成分析并入队。
          </Paragraph>
        ) : (
          <Table
            size="small"
            rowKey="exam_id"
            pagination={false}
            dataSource={queue}
            scroll={{ x: 900 }}
            columns={[
              { title: "检查号", dataIndex: "exam_id", width: 140 },
              { title: "临床诊断", dataIndex: "clinical_diagnosis", ellipsis: true },
              { title: "科室", dataIndex: "department", width: 120 },
              { title: "年龄", dataIndex: "age", width: 60 },
              {
                title: "分级",
                dataIndex: "grade_label",
                width: 88,
                render: (v: string) => <Tag color={gradeColor(v)}>{v}</Tag>,
              },
              {
                title: "入队时间",
                dataIndex: "enrolled_at",
                width: 180,
                render: (v: string) => (v ? new Date(v).toLocaleString() : "—"),
              },
            ]}
          />
        )}
      </Card>

      <Card title="数据库随访队列（服务端）" size="small" loading={loadingDb}>
        {dbRecords.length === 0 ? (
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            服务端暂无带「随访队列」标签的病例。
          </Paragraph>
        ) : (
          <Table
            size="small"
            rowKey={(r) => r.patient_base_info.exam_id}
            pagination={{ pageSize: 10 }}
            dataSource={dbRecords}
            scroll={{ x: 900 }}
            columns={[
              {
                title: "检查号",
                width: 140,
                render: (_: unknown, r: PetCtInterviewRecord) => r.patient_base_info.exam_id,
              },
              {
                title: "姓名",
                width: 100,
                render: (_: unknown, r: PetCtInterviewRecord) => r.patient_base_info.name,
              },
              {
                title: "临床诊断",
                ellipsis: true,
                render: (_: unknown, r: PetCtInterviewRecord) => r.interview_info.clinical_diagnosis,
              },
              {
                title: "科室",
                width: 120,
                render: (_: unknown, r: PetCtInterviewRecord) => r.patient_base_info.department,
              },
              {
                title: "病理分级",
                width: 88,
                render: (_: unknown, r: PetCtInterviewRecord) => (
                  <Tag color={gradeColor(r.research_extensions.pathology_grade || "")}>
                    {r.research_extensions.pathology_grade || "—"}
                  </Tag>
                ),
              },
            ]}
          />
        )}
      </Card>
    </div>
  );
}
