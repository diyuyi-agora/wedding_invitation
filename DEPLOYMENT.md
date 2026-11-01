# 线上部署

本项目默认部署服务器为 `ubuntu@42.192.38.33`，服务器 IP 入口为 <http://42.192.38.33/wedding/>，现有域名入口为 <https://hanhandi.cn/wedding/>。登录凭证单独保管，不放入仓库。

现有 Compose 项目位于 `/home/ubuntu/code/compose.yaml`，项目名 `hanhandi`，服务名 `wedding`。部署时仅更新该服务，继续绑定 `127.0.0.1:5001:5000`。Nginx 经已有 OpenResty 路由将 `/wedding/` 转发到 `127.0.0.1:5001/`，移除路径前缀。前端 API 地址相对当前邀请函目录解析，兼容该路由和站点根目录。

边缘 Nginx 的 wedding 路由应设置 `X-Forwarded-Proto $scheme`，由 OpenResty 继续传给 Node。应用信任直接连接的本地代理；HTTPS 请求使用 Secure 访客 Cookie，HTTP IP 入口使用普通 HttpOnly Cookie，以保证访客识别和重复提交去重。

代码按 Git 提交归档到 `/home/ubuntu/code/wedding/releases/<commit>/`，以该目录为 Docker 构建上下文。使用根目录 `Dockerfile`，镜像标签为 `hanhandi-wedding:<commit>`。配置示例：

Dockerfile 默认使用 Node.js 24 Alpine。可通过构建参数 `NODE_IMAGE` 指定镜像源；当前服务器已缓存 `docker.1panel.live/library/node:24-alpine`，可直接复用。

```yaml
wedding:
  image: hanhandi-wedding:<commit>
  build: ./wedding/releases/<commit>
  env_file:
    - ./wedding.env
  environment:
    NODE_ENV: production
    HOST: 0.0.0.0
    PORT: "5000"
    PUBLIC_ORIGIN: https://hanhandi.cn
  ports:
    - "127.0.0.1:5001:5000"
  healthcheck:
    test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:5000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
    interval: 30s
    timeout: 5s
    retries: 3
    start_period: 5s
```

Redis 环境变量从本机被忽略的 `server/.env` 安全传送到服务器 `/home/ubuntu/code/wedding.env`，文件权限为 `0600`，由 Compose 在启动时注入。该文件放在镜像构建上下文之外；Dockerfile 只复制明确列出的公开文件和服务端代码，`.dockerignore` 同时排除环境文件。真实地址、Token 和 SSH 凭证均不写入 Git、镜像或部署日志。

在 `/home/ubuntu/code` 运行 `sudo docker compose build wedding` 和 `sudo docker compose up -d --no-deps wedding`。部署前保存原 Compose、wedding 文件和镜像标签到独立备份目录，以便恢复原服务。

部署后检查容器健康状态、公开入口、`/wedding/api/stats` 和 `/wedding/api/blessings`。需要验证写入时，先使用独立 Redis 前缀运行短期测试容器；验证访问去重、祝福保存与读取后清理该测试前缀。正式服务继续使用原 Redis 前缀，保留已有真实数据。
