import {
  ApartmentOutlined,
  BarChartOutlined,
  DatabaseOutlined,
  ExperimentOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  MessageOutlined,
  RobotOutlined,
  SettingOutlined,
  TeamOutlined,
} from "@ant-design/icons";
import { Badge, Input, Layout, Menu, Space, Typography } from "antd";
import { useMemo, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";

const { Sider, Header, Content } = Layout;

type MenuItem = {
  key: string;
  icon?: React.ReactNode;
  label: string;
  path?: string;
  children?: MenuItem[];
};

/** 流程：工作台 → 智能对话 → 智能分析 → 数据库 → 科研延伸 */
const MENU: MenuItem[] = [
  { key: "/workflow", icon: <ApartmentOutlined />, label: "工作台", path: "/workflow" },
  { key: "/", icon: <MessageOutlined />, label: "智能对话", path: "/" },
  {
    key: "analysis",
    icon: <ExperimentOutlined />,
    label: "智能分析",
    children: [
      { key: "/analysis/diagnosis", label: "诊断分析", path: "/analysis/diagnosis" },
      { key: "/analysis/treatment", label: "治疗建议", path: "/analysis/treatment" },
      { key: "/analysis/prognosis", label: "预后预测", path: "/analysis/prognosis" },
      { key: "/analysis/cohort", label: "队列分析", path: "/analysis/cohort" },
    ],
  },
  {
    key: "db",
    icon: <DatabaseOutlined />,
    label: "数据库",
    children: [
      { key: "/db/patients", label: "患者数据库", path: "/db/patients" },
      { key: "/db/imaging", label: "影像数据库", path: "/db/imaging" },
    ],
  },
  {
    key: "/knowledge",
    icon: <BarChartOutlined />,
    label: "科研延伸",
    path: "/knowledge",
  },
  { key: "/settings", icon: <SettingOutlined />, label: "系统设置", path: "/settings" },
];

function flattenPaths(items: MenuItem[]): string[] {
  return items.flatMap((it) => [it.path, ...(it.children ? flattenPaths(it.children) : [])].filter(Boolean) as string[]);
}

function selectedKey(pathname: string): string {
  const paths = flattenPaths(MENU).sort((a, b) => b.length - a.length);
  const hit = paths.find((p) => p === pathname || (p !== "/" && pathname.startsWith(p)));
  if (pathname.startsWith("/research")) return "/knowledge";
  return hit || (pathname === "/" ? "/" : "/workflow");
}

function openKeysFor(pathname: string): string[] {
  if (pathname.startsWith("/db")) return ["db"];
  if (pathname.startsWith("/analysis")) return ["analysis"];
  return [];
}

export default function PlatformLayout() {
  const nav = useNavigate();
  const loc = useLocation();
  const [collapsed, setCollapsed] = useState(false);

  const menuItems = useMemo(
    () =>
      MENU.map((item) => ({
        key: item.path || item.key,
        icon: item.icon,
        label: item.label,
        children: item.children?.map((c) => ({
          key: c.path!,
          label: c.label,
        })),
      })),
    [],
  );

  const pageTitle = useMemo(() => {
    const map: Record<string, string> = {
      "/": "智能对话",
      "/workflow": "PMP 智能平台 · 工作台",
      "/db/patients": "患者数据库",
      "/db/imaging": "影像数据库",
      "/knowledge": "科研延伸分析",
      "/analysis/diagnosis": "诊断分析",
      "/analysis/treatment": "治疗建议",
      "/analysis/prognosis": "预后预测",
      "/analysis/cohort": "队列分析",
      "/settings": "系统设置",
    };
    if (loc.pathname.startsWith("/research")) return "科研延伸分析";
    return map[loc.pathname] || "PMP 智能医疗平台";
  }, [loc.pathname]);

  return (
    <Layout className="pmp-layout">
      <Sider
        className="pmp-sidebar"
        width={220}
        collapsedWidth={64}
        collapsible
        collapsed={collapsed}
        trigger={null}
        theme="dark"
      >
        <div className="pmp-sidebar-logo">
          <div className="pmp-sidebar-logo-icon">P</div>
          {!collapsed ? <span>PMP 智能平台</span> : null}
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey(loc.pathname)]}
          defaultOpenKeys={openKeysFor(loc.pathname)}
          items={menuItems}
          onClick={({ key }) => {
            if (typeof key === "string" && key.startsWith("/")) nav(key);
          }}
          style={{ border: "none", padding: "8px 0" }}
        />
        <div style={{ position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center" }}>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "none",
              color: "#fff",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        </div>
      </Sider>
      <Layout>
        <Header className="pmp-header">
          <Space size={16}>
            <Typography.Text strong style={{ fontSize: 15 }}>
              {pageTitle}
            </Typography.Text>
            <span className="pmp-tag-blue">Beta</span>
          </Space>
          <Space size={20}>
            <Input.Search placeholder="搜索患者、病例、报告…" style={{ width: 320 }} allowClear />
            <Badge count={12} size="small">
              <RobotOutlined style={{ fontSize: 18, color: "#6b7280" }} />
            </Badge>
            <Badge dot>
              <TeamOutlined style={{ fontSize: 18, color: "#6b7280" }} />
            </Badge>
            <Space size={8}>
              <span style={{ fontSize: 13, color: "#374151" }}>张医生</span>
              <span style={{ fontSize: 12, color: "#9ca3af" }}>肿瘤内科</span>
            </Space>
          </Space>
        </Header>
        <Content className="pmp-content">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
