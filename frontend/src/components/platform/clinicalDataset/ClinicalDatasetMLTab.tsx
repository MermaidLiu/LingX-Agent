import { App, Button, Checkbox, Empty, Space, Steps, Tag, Typography } from "antd";
import { useState } from "react";
import type { ClinicalDataset } from "../../../lib/clinicalDataset/types";

const { Text, Title } = Typography;

const ML_STEPS = [
  { title: "基础配置", desc: "基本信息 · 训练/测试集" },
  { title: "特征处理", desc: "清洗 · 标准化 · 筛选" },
  { title: "模型配置", desc: "模型选择" },
];

const RADIOMICS_CATEGORIES = [
  "一阶特征",
  "形态特征",
  "GLCM 特征",
  "GLSZM 特征",
  "GLRLM 特征",
  "GLDM 特征",
];

const PREPROCESS = ["原始", "小波转换", "LoG", "Square", "SquareRoot", "Logarithm", "Exponential", "Gradient", "LBP2D", "LBP3D"];

type Props = {
  dataset: ClinicalDataset;
};

export default function ClinicalDatasetMLTab({ dataset }: Props) {
  const { message } = App.useApp();
  const [step, setStep] = useState(0);
  const [selectedClinical, setSelectedClinical] = useState<string[]>(
    dataset.variables.filter((v) => v.type !== "file" && !v.skipped).slice(0, 4).map((v) => v.name),
  );
  const [selectedRadiomics, setSelectedRadiomics] = useState<string[]>([]);
  const [preprocess, setPreprocess] = useState<string[]>(["原始"]);
  const [ran, setRan] = useState(false);

  const clinicalOptions = dataset.variables.filter((v) => v.type !== "file" && !v.skipped);

  return (
    <div className="pmp-clinical-ml">
      <div className="pmp-clinical-ml-header">
        <Space>
          <Tag color="blue">数据集：{dataset.name}</Tag>
          <Tag>n = {dataset.rows.length}</Tag>
        </Space>
        <Button size="small" onClick={() => setStep(0)}>
          返回配置
        </Button>
      </div>

      <div className="pmp-clinical-ml-grid">
        <div className="pmp-card pmp-clinical-ml-sidebar">
          <Text type="secondary" style={{ fontSize: 12 }}>
            未命名的任务
          </Text>
          <Steps
            direction="vertical"
            size="small"
            current={step}
            style={{ marginTop: 12 }}
            items={ML_STEPS.map((s, i) => ({ title: s.title, description: s.desc, onClick: () => setStep(i) }))}
          />
          <Button
            type="primary"
            block
            style={{ marginTop: 16 }}
            onClick={() => {
              setRan(true);
              message.success("模型训练完成（演示）");
            }}
          >
            运行
          </Button>
        </div>

        <div className="pmp-card pmp-clinical-ml-main">
          {step === 0 ? (
            <>
              <Title level={5} style={{ marginTop: 0 }}>
                基础配置
              </Title>
              <Text type="secondary" style={{ fontSize: 12, display: "block", marginBottom: 12 }}>
                自变量（临床字段，来自导入数据集）
              </Text>
              <Space wrap style={{ marginBottom: 16 }}>
                {clinicalOptions.map((v) => (
                  <Tag.CheckableTag
                    key={v.id}
                    checked={selectedClinical.includes(v.name)}
                    onChange={(checked) => {
                      setSelectedClinical((prev) =>
                        checked ? [...prev, v.name] : prev.filter((x) => x !== v.name),
                      );
                    }}
                  >
                    {v.name}
                  </Tag.CheckableTag>
                ))}
              </Space>
              <Button size="small" type="link" onClick={() => setSelectedClinical(clinicalOptions.map((v) => v.name))}>
                全选
              </Button>
            </>
          ) : step === 1 ? (
            <>
              <Title level={5} style={{ marginTop: 0 }}>
                组学特征
              </Title>
              <Text type="secondary" style={{ fontSize: 12 }}>
                当前纳入 0 个组学特征 · 基于 10 种影像预处理
              </Text>
              <div style={{ margin: "12px 0" }}>
                <Checkbox.Group
                  options={PREPROCESS}
                  value={preprocess}
                  onChange={(v) => setPreprocess(v as string[])}
                />
              </div>
              <Space direction="vertical" style={{ width: "100%" }}>
                {RADIOMICS_CATEGORIES.map((cat) => (
                  <Checkbox
                    key={cat}
                    checked={selectedRadiomics.includes(cat)}
                    onChange={(e) => {
                      setSelectedRadiomics((prev) =>
                        e.target.checked ? [...prev, cat] : prev.filter((x) => x !== cat),
                      );
                    }}
                  >
                    {cat}
                  </Checkbox>
                ))}
              </Space>
            </>
          ) : (
            <>
              <Title level={5} style={{ marginTop: 0 }}>
                模型选择
              </Title>
              <Space wrap>
                {["Logistic 回归", "随机森林", "XGBoost", "SVM", "深度学习 CNN"].map((m) => (
                  <Tag key={m} color="processing">
                    {m}
                  </Tag>
                ))}
              </Space>
            </>
          )}

          {ran ? (
            <div className="pmp-clinical-ml-result" style={{ marginTop: 20 }}>
              <Tag color="green">AUC 0.82</Tag>
              <Tag color="blue">准确率 78.5%</Tag>
              <Tag>已选临床变量 {selectedClinical.length} 个</Tag>
              <Tag>组学特征 {selectedRadiomics.length} 类</Tag>
            </div>
          ) : null}
        </div>

        <div className="pmp-card pmp-clinical-ml-result-panel">
          <Text type="secondary">训练结果</Text>
          {!ran ? (
            <Empty description="运行后查看结果" image={Empty.PRESENTED_IMAGE_SIMPLE} style={{ marginTop: 24 }} />
          ) : (
            <Space direction="vertical" style={{ marginTop: 12, width: "100%" }}>
              <Text>训练集 n = {Math.floor(dataset.rows.length * 0.7)}</Text>
              <Text>测试集 n = {Math.ceil(dataset.rows.length * 0.3)}</Text>
              <Text strong>最佳模型：随机森林</Text>
            </Space>
          )}
        </div>
      </div>
    </div>
  );
}
