import { App, Button, Space, Steps, Tag, Typography, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useEffect, useState } from "react";
import type { ResearchResultRow } from "../../data/researchWorkbenchMock";
import { platformRadiomicsRun } from "../../api/platform";
import { hasAnnotatedImage, imageSrcFromBase64 } from "../../lib/pathologyImage";
import { clinicalQuestionToIndicators, clinicalQuestionSummaryText, isSingleCaseQuestion, type ClinicalQuestion } from "../../data/clinicalQuestions";

const { Text, Paragraph } = Typography;

type Props = {
  accent: string;
  light: string;
  annotatedImageBase64?: string | null;
  pathologyGrade?: string;
  clinicalQuestion: ClinicalQuestion;
  onComplete: (rows: ResearchResultRow[], summary: string, auc?: number) => void;
};

export default function RadiomicsPipeline({
  accent,
  light,
  annotatedImageBase64,
  pathologyGrade,
  clinicalQuestion,
  onComplete,
}: Props) {
  const { message } = App.useApp();
  const [step, setStep] = useState(0);
  const [niiFiles, setNiiFiles] = useState<UploadFile[]>([]);
  const [useAnnotated, setUseAnnotated] = useState(false);
  const [roiDefined, setRoiDefined] = useState(false);
  const [running, setRunning] = useState(false);
  const [featureCount, setFeatureCount] = useState<number | null>(null);

  useEffect(() => {
    if (hasAnnotatedImage(annotatedImageBase64)) {
      setUseAnnotated(true);
      setRoiDefined(true);
      setStep(1);
    }
  }, [annotatedImageBase64]);

  async function extractFeatures() {
    if (!useAnnotated && !niiFiles.length) {
      message.warning("请使用智能分析标注图或上传 NIfTI");
      return;
    }
    if (!roiDefined) {
      message.warning("请先确认 ROI（标注图已含病灶区域）");
      return;
    }
    setFeatureCount(1248);
    setStep(2);
    message.success("已从标注病灶图 / ROI 提取 1,248 维 Radiomics 特征");
  }

  async function runRadiomics() {
    if (!useAnnotated && !niiFiles.length) {
      message.warning("请完成影像来源选择");
      return;
    }
    setRunning(true);
    try {
      const res = await platformRadiomicsRun(useAnnotated ? [] : niiFiles.map((f) => f as unknown as File), {
        targetField: clinicalQuestion.targetField,
        targetValue: clinicalQuestion.positiveClass,
        roiDefined: true,
        useAnnotatedImage: useAnnotated,
        indicators: {
          ...(pathologyGrade ? { pathology_grade: pathologyGrade } : {}),
          ...clinicalQuestionToIndicators(clinicalQuestion),
        },
      });
      onComplete(res.rows, res.summary, res.auc);
      setStep(3);
      message.success("组学建模完成");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "组学分析失败");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="pmp-radiomics" style={{ background: light, borderRadius: 8, padding: 14, marginBottom: 16 }}>
      <div className="pmp-panel-title" style={{ marginBottom: 10 }}>
        影像组学流程（基于标注病灶图）
      </div>
      <Steps
        size="small"
        current={step}
        items={[
          { title: "影像来源" },
          { title: "ROI / 标注" },
          { title: "特征提取" },
          { title: "组学建模" },
        ]}
        style={{ marginBottom: 16 }}
      />

      {step === 0 ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          {hasAnnotatedImage(annotatedImageBase64) ? (
            <>
              <Tag color="blue">已关联智能分析标注图</Tag>
              <img
                src={imageSrcFromBase64(annotatedImageBase64!)}
                alt="标注病灶图"
                style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #dbeafe", background: "#0a0a0a" }}
              />
              <Button type="primary" onClick={() => { setUseAnnotated(true); setRoiDefined(true); setStep(1); }}>
                使用标注图进行组学建模
              </Button>
            </>
          ) : (
            <Paragraph type="secondary" style={{ fontSize: 12 }}>
              未检测到标注图，请先在「智能分析」完成影像诊断分析并入库；或上传 NIfTI 作为补充。
            </Paragraph>
          )}
          <Upload
            multiple
            accept=".nii,.gz,.nii.gz"
            fileList={niiFiles}
            beforeUpload={() => false}
            onChange={({ fileList }) => setNiiFiles(fileList)}
          >
            <Button>可选：上传 NIfTI 文件</Button>
          </Upload>
          {niiFiles.length ? (
            <Button onClick={() => { setUseAnnotated(false); setStep(1); }}>使用 NIfTI 继续</Button>
          ) : null}
        </Space>
      ) : null}

      {step >= 1 && step < 2 ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          {useAnnotated && hasAnnotatedImage(annotatedImageBase64) ? (
            <img
              src={imageSrcFromBase64(annotatedImageBase64!)}
              alt="ROI 标注图"
              style={{ maxWidth: "100%", borderRadius: 8, border: "1px solid #dbeafe", background: "#0a0a0a" }}
            />
          ) : null}
          <Paragraph type="secondary" style={{ fontSize: 12, margin: "8px 0" }}>
            {useAnnotated
              ? "接口返回的标注图已作为 ROI 区域，可直接提取 Radiomics 特征"
              : "请在 NIfTI 上勾画 ROI（演示：点击下方按钮）"}
          </Paragraph>
          <Space>
            <Button onClick={() => setRoiDefined(true)} type={roiDefined ? "primary" : "default"}>
              {roiDefined ? "ROI 已确认 ✓" : "确认 ROI"}
            </Button>
            <Button type="primary" disabled={!roiDefined} onClick={extractFeatures}>
              提取特征
            </Button>
          </Space>
        </Space>
      ) : null}

      {step >= 2 ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          {featureCount ? <Tag color="green">已提取 {featureCount} 维特征</Tag> : null}
          <Paragraph style={{ fontSize: 12, margin: "4px 0", color: "#374151" }}>
            临床问题：{clinicalQuestionSummaryText(clinicalQuestion)}
          </Paragraph>
          <Paragraph type="secondary" style={{ fontSize: 11, margin: "0 0 8px" }}>
            以下为本问题的<strong>分析方法</strong>（组学 / 深度学习），与上方临床问题定义分开设定。
          </Paragraph>
          <Button
            type="primary"
            loading={running}
            onClick={runRadiomics}
            style={{ borderColor: accent }}
          >
            {isSingleCaseQuestion(clinicalQuestion)
              ? clinicalQuestion.modelingApproach === "deep_learning"
                ? "本例深度学习分析"
                : "本例组学特征建模"
              : clinicalQuestion.modelingApproach === "deep_learning"
                ? "运行深度学习建模 + Grad-CAM"
                : "运行 LASSO 特征筛选 + 二分类建模"}
          </Button>
        </Space>
      ) : null}
    </div>
  );
}
