import { App, Button, Input, Select, Slider, Space, Steps, Tag, Typography, Upload } from "antd";
import type { UploadFile } from "antd/es/upload/interface";
import { useState } from "react";
import type { ResearchResultRow } from "../../data/researchWorkbenchMock";
import { platformRadiomicsRun } from "../../api/platform";

const { Text, Paragraph } = Typography;

type Props = {
  accent: string;
  light: string;
  onComplete: (rows: ResearchResultRow[], summary: string, auc?: number) => void;
};

export default function RadiomicsPipeline({ accent, light, onComplete }: Props) {
  const { message } = App.useApp();
  const [step, setStep] = useState(0);
  const [niiFiles, setNiiFiles] = useState<UploadFile[]>([]);
  const [sliceIdx, setSliceIdx] = useState(42);
  const [roiDefined, setRoiDefined] = useState(false);
  const [targetField, setTargetField] = useState("病理分级");
  const [targetValue, setTargetValue] = useState("高级别");
  const [running, setRunning] = useState(false);
  const [featureCount, setFeatureCount] = useState<number | null>(null);

  async function extractFeatures() {
    if (!niiFiles.length) {
      message.warning("请先上传 NIfTI 影像");
      return;
    }
    if (!roiDefined) {
      message.warning("请先在影像上勾画 ROI");
      return;
    }
    setFeatureCount(1248);
    setStep(2);
    message.success("已从 ROI 提取 1,248 维 Radiomics 特征");
  }

  async function runRadiomics() {
    if (!niiFiles.length || !roiDefined) {
      message.warning("请完成影像上传与 ROI 勾画");
      return;
    }
    setRunning(true);
    try {
      const res = await platformRadiomicsRun(
        niiFiles.map((f) => f as unknown as File),
        { targetField, targetValue, roiDefined: true },
      );
      onComplete(res.rows, res.summary, res.auc);
      setStep(3);
      message.success("组学分析完成");
    } catch (e) {
      message.error(e instanceof Error ? e.message : "组学分析失败");
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="pmp-radiomics" style={{ background: light, borderRadius: 8, padding: 14, marginBottom: 16 }}>
      <div className="pmp-panel-title" style={{ marginBottom: 10 }}>
        影像组学流程
      </div>
      <Steps
        size="small"
        current={step}
        items={[
          { title: "上传影像" },
          { title: "勾画 ROI" },
          { title: "特征提取" },
          { title: "组学分析" },
        ]}
        style={{ marginBottom: 16 }}
      />

      {step === 0 ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            上传 .nii / .nii.gz 格式影像（可多文件）
          </Text>
          <Upload
            multiple
            accept=".nii,.gz,.nii.gz"
            fileList={niiFiles}
            beforeUpload={(file) => {
              setNiiFiles((prev) => [...prev, file as UploadFile]);
              return false;
            }}
            onRemove={(f) => setNiiFiles((prev) => prev.filter((x) => x.uid !== f.uid))}
          >
            <Button>选择 NIfTI 文件</Button>
          </Upload>
          <Button type="primary" disabled={!niiFiles.length} onClick={() => setStep(1)}>
            下一步：勾画 ROI
          </Button>
        </Space>
      ) : null}

      {step >= 1 && step < 2 ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          <div className="pmp-radiomics-viewer">
            <div className="pmp-radiomics-viewer-placeholder">
              <Text type="secondary">轴位切片预览 · {niiFiles[0]?.name ?? "—"}</Text>
              <Slider min={1} max={120} value={sliceIdx} onChange={setSliceIdx} style={{ marginTop: 12 }} />
              <Tag color="blue">Slice {sliceIdx}</Tag>
            </div>
          </div>
          <Paragraph type="secondary" style={{ fontSize: 12, margin: "8px 0" }}>
            在影像上框选病灶区域作为 ROI（演示：点击下方按钮模拟勾画完成）
          </Paragraph>
          <Space>
            <Button onClick={() => setRoiDefined(true)} type={roiDefined ? "primary" : "default"}>
              {roiDefined ? "ROI 已勾画 ✓" : "模拟勾画 ROI"}
            </Button>
            <Button type="primary" disabled={!roiDefined} onClick={extractFeatures}>
              提取 ROI 特征
            </Button>
          </Space>
        </Space>
      ) : null}

      {step >= 2 ? (
        <Space direction="vertical" style={{ width: "100%" }}>
          {featureCount ? (
            <Tag color="green">已提取 {featureCount} 维特征（纹理 + 形态 + 小波）</Tag>
          ) : null}
          <Text type="secondary" style={{ fontSize: 12 }}>
            二分类结局（如病理分级）
          </Text>
          <Space wrap>
            <Select
              style={{ width: 140 }}
              value={targetField}
              onChange={setTargetField}
              options={[
                { value: "病理分级", label: "病理分级" },
                { value: "基因分型", label: "基因分型" },
                { value: "疗效反应", label: "疗效反应" },
              ]}
            />
            <Select
              style={{ width: 120 }}
              value={targetValue}
              onChange={setTargetValue}
              options={[
                { value: "高级别", label: "高级别" },
                { value: "低级别", label: "低级别" },
                { value: "阳性", label: "阳性" },
                { value: "阴性", label: "阴性" },
              ]}
            />
          </Space>
          <Input.TextArea
            rows={2}
            placeholder="纳入/排除标准、LASSO 参数等（可选）"
            style={{ marginTop: 4 }}
          />
          <Button type="primary" loading={running} onClick={runRadiomics} style={{ borderColor: accent }}>
            运行 LASSO 特征筛选 + 二分类建模
          </Button>
        </Space>
      ) : null}
    </div>
  );
}
