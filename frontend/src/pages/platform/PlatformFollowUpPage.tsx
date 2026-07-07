import { ReloadOutlined, TeamOutlined, ExperimentOutlined } from "@ant-design/icons";
import { App, Button, Card, Table, Tag, Typography } from "antd";
import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { cohortQuery, type PetCtInterviewRecord } from "../../api/client";
import FollowUpBatchImportPanel from "../../components/platform/FollowUpBatchImportPanel";
import { FOLLOWUP_PHENOTYPE_TAG, listFollowUpQueue, type FollowUpEntry } from "../../lib/followUpQueue";
import { activateResearchFromFollowUpBatch } from "../../lib/researchBatchContext";
import {
  FOLLOWUP_BATCH_IMPORTED_EVENT,
  loadFollowUpBatch,
  type FollowUpBatchState,
} from "../../lib/followUpBatchStore";

const { Title, Paragraph } = Typography;

export default function PlatformFollowUpPage() {
  const { message } = App.useApp();
  const nav = useNavigate();
  const [queue, setQueue] = useState<FollowUpEntry[]>([]);
  const [dbRecords, setDbRecords] = useState<PetCtInterviewRecord[]>([]);
  const [loadingDb, setLoadingDb] = useState(false);
  const [batch, setBatch] = useState<FollowUpBatchState | null>(() => loadFollowUpBatch());

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
    function onBatchImported(e: Event) {
      setBatch((e as CustomEvent<FollowUpBatchState>).detail ?? loadFollowUpBatch());
    }
    window.addEventListener(FOLLOWUP_BATCH_IMPORTED_EVENT, onBatchImported);
    return () => window.removeEventListener(FOLLOWUP_BATCH_IMPORTED_EVENT, onBatchImported);
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
        支持三种导入：仅临床 Excel、仅预勾画 ZIP、或两者同时上传（推荐，按就诊号自动关联）。
        单例患者仍可在「智能分析」完成后加入随访队列。
      </Paragraph>

      <FollowUpBatchImportPanel onImported={setBatch} />

      {batch ? (
        <Card
          title={`批量导入队列 · ${batch.matchedCount}/${batch.cases.length} 已关联影像`}
          size="small"
          style={{ marginBottom: 16 }}
          extra={
            <Button
              type="primary"
              size="small"
              icon={<ExperimentOutlined />}
              onClick={() => {
                const ctx = activateResearchFromFollowUpBatch("follow_up_batch");
                if (!ctx) {
                  message.warning("请先完成导入");
                  return;
                }
                nav("/knowledge");
              }}
            >
              进入科研分析
            </Button>
          }
        >
          <Table
            size="small"
            rowKey="visitId"
            pagination={{ pageSize: 10, showSizeChanger: true }}
            dataSource={batch.cases}
            scroll={{ x: 960 }}
            columns={[
              { title: "就诊号", dataIndex: "visitId", width: 120, fixed: "left" },
              { title: "姓名", dataIndex: "name", width: 88 },
              { title: "性别", dataIndex: "gender", width: 56 },
              { title: "年龄", dataIndex: "age", width: 72 },
              {
                title: "病理分级",
                dataIndex: "gradeLabel",
                width: 88,
                render: (v: string) => <Tag color={gradeColor(v)}>{v}</Tag>,
              },
              {
                title: "PCI",
                width: 56,
                render: (_: unknown, r) => (r.pciScore != null ? r.pciScore : "—"),
              },
              {
                title: "预勾画",
                width: 88,
                render: (_: unknown, r) =>
                  r.niiVolumeId ? <Tag color="cyan">已关联</Tag> : <Tag>未匹配</Tag>,
              },
              {
                title: "NIfTI",
                dataIndex: "niiFileName",
                ellipsis: true,
                render: (v: string | null) => v || "—",
              },
            ]}
          />
        </Card>
      ) : null}

      <Card
        title="本机随访队列（单例入队）"
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
            暂无单例随访病例。请先在 <Link to="/analysis">智能分析</Link> 完成分析并入队。
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
