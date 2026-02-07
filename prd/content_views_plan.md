# Mailbox：HTML / Clean 视图优化计划

更新时间：2026-02-07

## 1. 背景与现状

Mailbox 是一个单用户的邮件接收器：通过 Cloudflare Email Routing 将邮件投递到 Cloudflare Worker（`mailbox`），解析后写入 D1，并提供 Web UI + API 查看与搜索。

当前数据模型（D1 `messages`）核心字段：
- `body_html`：解析出的 HTML 正文（后端会做 sanitize）
- `body_text`：解析出的纯文本正文；当 `text/plain` 缺失时，会从 HTML 里抽取

当前 UI 提供两种详情视图：
- **HTML**：渲染 `body_html`（`dangerouslySetInnerHTML`），强调“还原邮件原貌”
- **Clean**：渲染 `body_text`，强调“可读性与信息提取”

### 已完成的改动（当前版本）

1) **HTML/Clean 视图切换**
- 详情弹窗增加 `Clean / HTML` 切换（HTML 无内容时禁用）。

2) **后端 extractText 改进（对新入库邮件更有效）**
- 先将常见 HTML 结构（`<br>`, `</p>`, `</div>`, `</li>` 等）映射为换行，再剥离标签，并做实体解码与空白归一。

3) **Clean 视图段落化渲染（对历史数据也更有效）**
- 前端把 `body_text` 按双换行拆段落，列表块识别为 `<ul>/<li>`，避免纯 `<pre>` 导致的“糊成一坨”。

> 注：这些改动显著提升了“最小可用”的可读性，但还未达到“社区口碑最佳”的清洗效果，尤其在营销邮件/表格布局邮件上。

## 2. 问题陈述（为什么还需要进一步优化）

### 2.1 HTML 视图问题

1) **样式污染与可读性不稳定**
- 邮件 HTML 通常包含大量 inline style / table 布局；即使 sanitize 后仍会带来字体、颜色、间距的“自带风格”，与 Mailbox UI 不一致。

2) **安全与隐私风险（主要是资源加载）**
- 邮件里常包含追踪像素、外链图片、外链字体、点击追踪链接等。
- 即便 sanitize 允许标签，依旧需要明确策略：是否允许加载外链图片？是否重写链接？

3) **排版适配问题**
- 表格宽度溢出、长链接撑破布局、暗黑模式下背景/文字对比不足等。

### 2.2 Clean 视图问题

1) **仅剥标签的抽取效果有限**
- 许多邮件没有高质量 `text/plain`，而 HTML 又以表格布局为主；简单的“结构→换行”规则难以稳定产出段落分明文本。

2) **噪音过多**
- 退订、社媒、页脚、法律免责声明、导航、重复 CTA 等会占据大量篇幅。

3) **目标场景需要“更聚焦的信息”**
- 本项目主要用于批量账号注册/验证/通知收集：用户往往只关心验证码、验证链接、一次性登录链接或关键提示。

## 3. 优化目标（可验收）

### 3.1 HTML 视图目标

1) **安全默认**
- 默认不加载任何外部资源（至少图片、字体、脚本等）。

2) **不污染 UI / 不破版**
- 邮件 HTML 必须被隔离（样式范围受控），在深色主题下可读。
- 表格/图片/长链接不应溢出弹窗。

3) **保留必要信息**
- 保留正文结构（段落、列表、链接、图片占位/可选加载）。

### 3.2 Clean 视图目标

1) **段落与换行自然**
- 对“典型注册/验证邮件”应能形成 3~10 段清晰文本；列表呈现为条目。

2) **噪音明显减少**
- 默认隐藏或弱化退订/社媒/页脚等（可选“显示全部”）。

3) **关键信息更突出**
- 可选：高亮/提取 OTP（6 位码等）与验证链接。

## 4. 方案总览（推荐技术路线）

### 4.1 总体思路

将“清洗/整理”明确拆为两条独立链路：
- **HTML 视图链路**：以“安全+隔离+可读”为目标（不追求 100% 原貌）
- **Clean 视图链路**：以“可读文本+噪音抑制+信息提取”为目标

并把清洗结果落库（可回填历史数据），避免每次打开详情都在前端/后端重复计算。

### 4.2 Clean 视图：引入社区成熟的 HTML→Text

推荐采用 `html-to-text`（社区广泛使用、专门针对 HTML 邮件转换优化）：
- 输入：`body_html`
- 输出：`body_text_clean`
- 关键能力：更稳定的段落处理、表格/列表的文本化、链接处理、折行策略

建议生成策略（决策明确）：
1) 首选 `postal-mime` 解析的 `text/plain`（如果长度足够且“不是乱码”）
2) 否则：对 sanitize 后的 HTML（或原始 HTML 的安全子集）使用 `html-to-text` 生成 `body_text_clean`
3) 对生成文本做 post-process：
   - 空白归一、最多两行空行
   - 移除重复 footer（可配置）
   - 可选 OTP/链接提取

### 4.3 HTML 视图：隔离与资源策略

建议策略（决策明确）：
1) **HTML sanitize 更严格**
- 继续使用 `sanitize-html`，但调整允许项：
  - 默认不允许 `style` 标签
  - 默认不允许 `img` 外链加载（可以改成占位符 + 点击后加载）
  - 允许基本排版标签（p/ul/ol/li/blockquote/a/strong/em/h1..h6/table 等）

2) **内容隔离**（二选一，推荐 A）
- A（推荐）：在 `.message-body` 内做 CSS reset + 限制最大宽度 + 强制换行策略
- B：使用 `<iframe sandbox>` 渲染 HTML（隔离更强，但交互/样式控制更复杂）

3) **链接处理**
- `target="_blank" rel="noreferrer noopener"`
- 可选：显示真实链接（去掉 tracking 参数）

## 5. 数据与 API 变更（建议）

> 目标：把“清洗结果”落库，支持历史回填。

### 5.1 D1 Schema 变更

建议在 `messages` 表新增：
- `body_text_clean TEXT`：clean 视图专用文本
- `body_html_sanitized TEXT`（可选）：显式存储 sanitize 结果，避免每次重新 sanitize

并将 FTS 索引字段扩展到 `body_text_clean`（或替换 `body_text`）：
- `messages_fts` 增加/改为索引 `body_text_clean`

### 5.2 API 变更

`GET /api/messages/:id` 返回增加字段：
- `body_text_clean?: string`

前端策略：
- Clean 默认优先用 `body_text_clean`，不存在则回退到 `body_text`

## 6. 回填与迁移（个人项目的最简步骤）

### 6.1 最简可行方案（推荐）

1) 增加新列（migration）
2) Worker 入库时写入 `body_text_clean`
3) 写一个一次性脚本：对历史记录批量回填 `body_text_clean`
4) （可选）重建 FTS

### 6.2 回填脚本策略（决策明确）

- 只处理满足条件的行：`body_text_clean IS NULL OR body_text_clean = ''`
- 以 `body_html` 为主生成 clean（没有 HTML 的就用 `body_text` 归一化）
- 每批处理 50~200 条，避免单次超时

## 7. 测试与验收

### 7.1 单元测试（worker）

新增测试用例覆盖：
- `extractText` / `html-to-text`：段落、列表、链接、表格
- sanitize：脚本标签、事件属性、危险 URL scheme 被移除

### 7.2 Web 侧验收

- HTML 视图：不破版（图片/表格/长链接），无外链资源自动加载
- Clean 视图：段落清晰，列表可读，验证码/链接更突出（如果实现）

## 8. 里程碑（按实现顺序）

### M1：HTML/Clean 体验收敛（低风险）
- [ ] 引入 `html-to-text`，生成 `body_text_clean`
- [ ] 前端 Clean 优先使用 `body_text_clean`

### M2：HTML 安全与隔离
- [ ] 收紧 sanitize allowlist（默认禁外链图片/样式标签）
- [ ] HTML 视图链接统一策略（noopener/noreferrer + 可选去追踪）

### M3：历史数据回填
- [ ] 一次性回填 `body_text_clean`
- [ ] （可选）FTS 重建/切换到 clean 字段

## 9. 风险与取舍

- “原貌还原”与“可读性/一致性”冲突：Mailbox 更偏工具，优先可读性。
- 邮件 HTML 非标准、表格布局重：仅规则很难完美，建议使用 `html-to-text` 作为核心能力。
- 外链资源加载涉及隐私：默认应禁止，提供可选开关。

