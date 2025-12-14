Name: Cloudflare Mail Cleaner
OneSentenceGoal: 帮个人黑盒测试者把 Cloudflare Email Routing 转发来的注册/验证邮件集中到一个小工具里，用干净可读的界面和 API 快速查看、搜索、删除。
TargetUser: 经常用自有域名邮箱注册测试网站的个人 QA/自动化测试者。

Scenarios:
  - [S1] 绑定 Cloudflare 域名的路由地址，把转发邮件自动落到本工具的收件箱。
  - [S2] 在界面按收件地址/主题/正文关键词搜索并查看已清洗的邮件内容。
  - [S3] 通过 API 获取某收件地址的最新 N 封邮件正文（已去掉 MIME 边界等噪音），用于自动化脚本验证。
  - [S4] 在界面或 API 删除单封或批量邮件，保持收件箱干净。

Scope:
  WillDo:
    - 接收 Cloudflare Email Routing 转发的邮件并存储（保留期默认 30 天），自动忽略附件和多媒体内容。
    - 对邮件做 MIME/多部件清洗，提供可读的纯文本/主 HTML 视图。
    - 全文搜索 From/To/Subject/Body，支持过滤收件地址。
    - 提供简单的单用户界面：列表、详情、删除。
    - 提供 API：列出最新 N 封、按 ID 获取详情、删除；API 需带简单密钥保护。
  WillNotDo:
    - 不保存任何附件或多媒体（图片/音频/视频等）。
    - 不提供发送/回复邮件或自带 SMTP。
    - 不做多租户/团队协作或复杂权限。
    - 不做高级反垃圾、病毒扫描。

Constraints:
  - Users: 1（最多少量个人账户）。
  - QPS: ≤5 请求/秒。
  - Infra/Simplify: 单节点部署（容器或轻量服务器），使用单机轻量数据库，依赖 Cloudflare 作为唯一 MX/路由入口。

SuccessCriteria:
  - 从 Cloudflare 转发到本工具的可用延迟 ≤5 秒。
  - 搜索在 2 秒内返回正确结果（按收件地址/关键词）。
  - 90% 以上的常见注册/验证邮件被清洗成可读正文，无明显 MIME 边界/附件噪音。
  - 自动化脚本可用 API 在 1 分钟内获取并删除最新验证码邮件。
