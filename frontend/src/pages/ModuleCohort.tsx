import { App, Button, Form, Input, InputNumber, Switch, Typography } from "antd";
import { useState } from "react";
import { Link } from "react-router-dom";
import { cohortQuery, followupCompare, saveCase } from "../api/client";
import { demoRecord } from "../data/demoRecord";

export default function ModuleCohort() {
  const { message } = App.useApp();
  const [result, setResult] = useState<unknown>(null);

  return (
    <div>
      <Typography.Title level={4} className="glass-page-title">
        随访队列
      </Typography.Title>
      <Typography.Paragraph type="secondary">
        工作台第 4 步：按病种、科室、年龄等筛选随访队列；对比多次检查记录，与诊断结果及治疗路径衔接。
      </Typography.Paragraph>
      <Button
        type="default"
        style={{ marginBottom: 16 }}
        onClick={async () => {
          try {
            await saveCase(demoRecord);
            message.success("演示病例已写入（便于队列与对比）");
          } catch {
            message.error("入库失败");
          }
        }}
      >
        将演示病例写入数据库
      </Button>
      <Form
        layout="vertical"
        initialValues={{ disease_code: "FUO", limit: 50 }}
        onFinish={async (v) => {
          try {
            const data = await cohortQuery({
              disease_code: v.disease_code || undefined,
              department_contains: v.department_contains || undefined,
              min_age: v.min_age ?? undefined,
              max_age: v.max_age ?? undefined,
              gender: v.gender || undefined,
              has_pet_lesion_suv: v.has_pet_lesion_suv || undefined,
              limit: v.limit ?? 50,
              skip: 0,
            });
            setResult(data);
          } catch {
            message.error("队列查询失败");
          }
        }}
        style={{ maxWidth: 480 }}
      >
        <Form.Item label="病种编码" name="disease_code">
          <Input placeholder="如 FUO、RHEUM_IMMU" />
        </Form.Item>
        <Form.Item label="科室包含" name="department_contains">
          <Input placeholder="如 风湿" />
        </Form.Item>
        <Form.Item label="最小年龄" name="min_age">
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="最大年龄" name="max_age">
          <InputNumber style={{ width: "100%" }} />
        </Form.Item>
        <Form.Item label="性别" name="gender">
          <Input placeholder="男 / 女" />
        </Form.Item>
        <Form.Item label="仅病灶含 SUV" name="has_pet_lesion_suv" valuePropName="checked">
          <Switch />
        </Form.Item>
        <Form.Item label="条数上限" name="limit">
          <InputNumber min={1} max={500} style={{ width: "100%" }} />
        </Form.Item>
        <Button type="primary" htmlType="submit">
          查询队列
        </Button>
      </Form>
      <Typography.Title level={5} style={{ marginTop: 32 }}>
        多次 PET-CT 对比
      </Typography.Title>
      <Form
        layout="inline"
        onFinish={async (v) => {
          try {
            const data = await followupCompare(v.baseline, v.followup);
            setResult(data);
          } catch {
            message.error("对比失败");
          }
        }}
      >
        <Form.Item name="baseline" rules={[{ required: true }]} initialValue={demoRecord.patient_base_info.exam_id}>
          <Input placeholder="基线 exam_id" style={{ width: 200 }} />
        </Form.Item>
        <Form.Item name="followup" rules={[{ required: true }]}>
          <Input placeholder="随访 exam_id" style={{ width: 200 }} />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit">
            对比
          </Button>
        </Form.Item>
      </Form>
      {result ? (
        <pre className="glass-codeblock" style={{ marginTop: 16, padding: 12, fontSize: 12, maxHeight: 400, overflow: "auto" }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}
      <Typography.Paragraph style={{ marginTop: 24 }}>
        下一步 →{" "}
        <Link to="/knowledge" className="glass-link">
          知识积累
        </Link>
      </Typography.Paragraph>
    </div>
  );
}
