Title: Cloudflare Mail Cleaner – User Stories & Technical Stories
Sources: product_brief.md (S1–S4), tech_stack.md.

User Stories
- US1 (maps S1): 作为域名持有者/测试者，我把 Cloudflare Email Routing 指向本工具，让转发邮件自动进入收件箱，无需自建 SMTP。
- US2 (maps S2): 作为测试者，我在界面按收件地址/主题/正文关键词搜索，快速打开清洗后的正文，确认验证码/注册信息。
- US3 (maps S3): 作为自动化脚本调用者，我用 API 获取某收件地址的最新 N 封邮件正文（已去除 MIME 噪音），用于自动填入验证码后再删除。
- US4 (maps S4): 作为用户，我在界面或 API 删除单封/多封邮件，保持收件箱干净并减少无关内容干扰。

Technical Stories (aligned to tech_stack.md) — with acceptance criteria
- TS1 Ingestion: 在 Cloudflare Worker email 入口使用 postal-mime v2.6.x 解析 message.raw，取 text/html，丢弃附件/多媒体，写入 D1（messages + messages_fts）。AC: 单封解析+入库 CPU < 50ms，遇超限/解析错误返回 4xx/5xx 并不写库。
- TS2 Search/List API: 在 fetch 入口实现 GET /messages（FTS5 搜索 + 收件人过滤），返回分页列表与 preview。AC: 搜索在 2s 内返回；默认 limit 20，max 100；对 q 为空时仅按收件人过滤。
- TS3 Latest API: 实现 GET /messages/latest?to=&n=，按 received_at 倒序返回指定收件地址前 N 封。AC: n 默认 5，最大 20；响应 < 1s。
- TS4 Detail API: 实现 GET /messages/{id}，返回元数据与 body_text/body_html（已 sanitize）。AC: 返回至少一种正文；HTML 需移除脚本/事件。
- TS5 Delete APIs: 实现 DELETE /messages/{id} 与 POST /messages/batch-delete，确保同步删除 FTS 索引。AC: 单次 batch 最大 100 条；成功返回删除计数。
- TS6 Auth: 所有 fetch API 使用单一 Bearer token 校验（env 配置），未通过返回 401。AC: 未带或错误 token 必须拒绝；不记录敏感 token。
- TS7 HTML 安全与限额: 清洗 HTML（移除脚本/事件），设置 postal-mime maxNestingDepth 与 maxHeadersSize，超限/异常日志后丢弃。AC: 遇超限/无正文时不入库且记录原因；size guard >10MB 直接丢弃。
