# 婚礼邀请函服务

在本目录运行 `npm ci`、`npm start`，默认访问 <http://localhost:3000/>。Node.js 版本需为 22 或以上，唯一 npm 运行依赖是 Express。服务提供邀请函、Redis 访问统计和公开祝福留言。

## 环境变量

启动时自动读取本目录 `.env`，进程中已有的变量优先。本地 Redis 凭证文件被 Git 忽略，权限为 `0600`；其他环境参考 `.env.example`。

| 变量 | 用途 |
| --- | --- |
| `PORT` | 默认 `3000` |
| `HOST` | 默认 `127.0.0.1`，部署时按反向代理配置 |
| `PUBLIC_ORIGIN` | 默认 `http://localhost:端口`；部署时填写实际站点源地址 |
| `NODE_ENV` | 生产设置为 `production`，同时配置 HTTPS 的 `PUBLIC_ORIGIN` |
| `UPSTASH_REDIS_REST_URL` | Upstash HTTPS REST 地址，仅服务端读取 |
| `UPSTASH_REDIS_REST_TOKEN` | Redis REST 读写凭证，仅服务端读取 |
| `WEDDING_REDIS_PREFIX` | 默认 `wedding-invitation`；不同婚礼或测试环境使用不同前缀 |

部署需由本服务提供页面，API 和邀请函保持同站。只部署静态文件可以浏览邀请函，但无法读取或保存共享祝福。Redis 未配置或不可用时，页面显示未连接；旅程仍可浏览。

## 数据接口

| 方法与路径 | 用途 |
| --- | --- |
| `GET /health` | 服务健康检查 |
| `POST /api/visits` | JSON `{ "visitId": "每次页面加载的唯一编号" }`，写入访问记录并返回统计 |
| `GET /api/stats` | 读取 `visits`、`visitors`、`blessings` 以及当前访客的 `blessed`、`messageSent` 状态 |
| `GET /api/blessings` | 返回 `{ messages: [{ name, message, createdAt }] }`，最近 50 条公开祝福，按新到旧排列 |
| `POST /api/blessings` | JSON `{ "name": "昵称（可选）", "message": "祝福文字" }`，原子保存文字和计数；兼容旧 `{}` 仅计数 |

访客以 HttpOnly Cookie 区分，Redis 只保存标识的 SHA-256 摘要。清除 Cookie 或更换浏览器会视为新访客。访问次数按页面加载计数，同一访问编号在 24 小时内重试不重复累计。Lua 脚本保证计数、留言去重在并发请求下保持一致。

统计使用 `{前缀}:stats`、`{前缀}:visitors`、`{前缀}:blessings`；单次访问的去重键 24 小时后过期。公开留言使用 `{前缀}:blessing-messages` 列表保留最近 100 条，接口读取最近 50 条；`{前缀}:blessing-authors` 保证每个浏览器只公开一条留言。曾只点过祝福的旧访客可以补写文字，不重复增加计数。接口只公开昵称、文字和服务端时间，不公开访客标识。

## 页面行为

公开页面没有婚礼资料编辑、上传和导出入口，资料统一修改根目录 `config.js`。`python3 scripts/build-standalone.py` 在项目根目录同步离线单文件。

首页、结尾和回执中的祝福共用同一保存接口。回执填写的文字保存成功后刷新弹幕并显示回执；失败保留内容并提示重试；空白输入的默认文案不写入。重复生成回执不会覆盖已公开留言。赴约信息仍需复制回执发给新人。

弹幕在首尾独立容器中展示，使用 `textContent` 写入，可暂停，离屏或页面隐藏时停止；减少动态效果设置下静止。完整留言可在结尾展开阅读。

服务只公开允许列表中的邀请函文件与 `assets/`，服务端文件、环境配置和本地数据不可通过网站读取。`npm test` 运行接口与配置回归测试，`npm run check` 检查语法。
