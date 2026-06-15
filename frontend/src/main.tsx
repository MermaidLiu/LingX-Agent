import { App as AntApp, ConfigProvider, theme } from "antd";
import zhCN from "antd/locale/zh_CN";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./styles/glass-theme.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ConfigProvider
      locale={zhCN}
      theme={{
        algorithm: theme.defaultAlgorithm,
        token: {
          colorPrimary: "#2a95c7",
          borderRadius: 10,
          borderRadiusLG: 16,
          colorBgContainer: "rgba(255,255,255,0.4)",
          colorBgElevated: "rgba(255,255,255,0.65)",
          colorBorder: "rgba(180, 220, 245, 0.85)",
          colorText: "#164a63",
          colorTextSecondary: "#3d6f8a",
          colorSplit: "rgba(180, 220, 245, 0.55)",
        },
        components: {
          Button: {
            primaryShadow: "0 4px 14px rgba(42, 149, 199, 0.28)",
          },
          Card: {
            colorBgContainer: "transparent",
            colorBorderSecondary: "rgba(255,255,255,0.5)",
          },
          Layout: {
            bodyBg: "transparent",
            headerBg: "transparent",
            headerHeight: 64,
          },
          Menu: {
            darkItemBg: "transparent",
          },
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  </React.StrictMode>
);
