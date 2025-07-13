# WJKC Auto Check-in Action 🚀

这是一个基于 GitHub Actions 的自动化脚本，用于每日自动在**网际快车 (wjkc.lol)** 网站执行签到任务，以获取每日奖励。

[![WJKC Check-in](https://github.com/ZZ0YY/wjkc-checkin/actions/workflows/checkin.yml/badge.svg)](https://github.com/ZZ0YY/wjkc-checkin/actions/workflows/checkin.yml)

> **免责声明**: 本项目仅用于学习和技术研究，旨在自动化处理日常重复任务。请在遵守目标网站用户协议的前提下使用。因使用本项目而导致的任何问题（包括但不限于账号封禁），项目作者概不负责。

---

## ✨ 功能特点

- **全自动化**：一次配置，每日自动执行，无需人工干预。
- **多账号支持**：支持通过配置同时为多个账号进行签到。
- **安全可靠**：使用 GitHub Secrets 存储敏感信息（如 Token），确保您的凭证安全，不会在代码中暴露。
- **实时通知**：支持通过 PushPlus 等多种渠道发送签到结果通知，让您随时掌握签到状态。
- **简单易用**：只需少量配置，即可快速部署和运行。
- **免费运行**：充分利用 GitHub Actions 提供的免费计算资源。

---

## 🔧 使用指南

### 准备工作

1.  **一个 GitHub 账号**。
2.  **获取网际快车 Token**：这是最关键的一步。
    -   在浏览器中登录你的**网际快车**账号。
    -   按 `F12` 打开开发者工具，切换到 **“网络 (Network)”** 标签页。
    -   刷新页面，随便点击一个请求。
    -   在右侧的 **“请求标头 (Request Headers)”** 中找到 `Cookie` 字段。
    -   Cookie 的内容类似：`...; token=c5a8f720-5ff0-11f0-b40b-497ac476035e; ...`
    -   复制 `token=` 后面的那一段长字符串，例如 `c5a8f720-5ff0-11f0-b40b-497ac476035e`。**这串字符就是你的 Token**。

### 部署步骤

#### 1. Fork 或克隆本项目

-   点击本仓库右上角的 **Fork** 按钮，将此项目复刻到你自己的 GitHub 账号下。
-   **强烈建议**：进入你 Fork 后的仓库，点击 `Settings`，将仓库的可见性设置为 **私有 (Private)**，以最大限度地保护你的配置信息。

#### 2. 添加仓库 Secrets

进入你 Fork 后的仓库，依次点击 `Settings` -> `Secrets and variables` -> `Actions`，然后点击 `New repository secret` 按钮，添加以下 Secrets：

-   **`WJKC_TOKEN` (必需)**
    -   **Name**: `WJKC_TOKEN`
    -   **Value**: 粘贴你准备工作中获取的 Token。
    -   如果你有**多个账号**，每个账号的 Token **占一行**。
      ```
      c5a8f720-5ff0-11f0-b40b-497ac476035e
      xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
      yyyyyyyy-yyyy-yyyy-yyyy-yyyyyyyyyyyy
      ```

-   **`NOTIFY` (可选，推荐配置)**
    -   **Name**: `NOTIFY`
    -   **Value**: 你的通知渠道配置，用于接收签到结果。
    -   **PushPlus 示例**:
      ```
      pushplus:你的PushPlus_Token
      ```
    -   你可以不配置此项，签到结果会直接显示在每次 Action 的运行日志中。

#### 3. 启用并运行 Action

1.  进入你的仓库，点击上方的 **`Actions`** 标签页。
2.  如果出现提示，请点击 **`I understand my workflows, go ahead and enable them`** 按钮来启用 Action。
3.  在左侧的工作流列表中，点击 **`WJKC Daily Check-in`**。
4.  你可以等待它在预设的时间（默认为每天北京时间凌晨 2:00）自动运行，也可以点击右侧的 **`Run workflow`** 按钮来手动触发一次，以测试配置是否正确。

---

## ⚙️ 自定义配置

### 修改运行时间

默认情况下，脚本会在每天的北京时间凌晨 2:00 运行。如果你想修改它，可以编辑 `.github/workflows/checkin.yml` 文件。

找到 `schedule` 部分的 `cron` 表达式：

```yaml
on:
  schedule:
    # 格式为：分 时 日 月 周
    # 默认：UTC 18:00 (北京时间 +8，即 02:00)
    - cron: '0 18 * * *'
