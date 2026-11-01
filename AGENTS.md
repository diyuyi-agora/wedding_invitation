# 项目发布约定

- 本项目每个完整修改批次结束后，默认使用个人 skill `commit-push-deploy` 完成验证、commit、push、服务器部署及线上验收；用户明确说跳过某一步时遵从本次指令。
- 从当前技能列表或 `$CODEX_HOME/skills`（未设置时 `~/.codex/skills`）读取 `commit-push-deploy/SKILL.md`。部署参数见 `.codex/deploy.json`，运维背景见 `DEPLOYMENT.md`。
- 默认服务器为 `ubuntu@42.192.38.33`；服务器操作通过 SSH 进行。只更新 `hanhandi` Compose 中的 `wedding` 服务，保留其他服务和现有 Redis 数据。
- 发布完成必须能在服务器执行 `cd /home/ubuntu/code && ./compose-manager.py` 查看目标服务；自动验收使用 `list` 和 `ps hanhandi wedding`。
- SSH 凭证、Redis 实际配置、服务器环境文件和数据库不得提交 Git 或放入镜像。提交只包含本任务文件，既有无关修改不混入。
