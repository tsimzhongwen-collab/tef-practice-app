# TEF/TCF 法语刷题系统

这是一个用于 TEF/TCF 法语备考的网页刷题系统，包含登录、账号有效期检查、设备绑定、动态水印、阅读/语法/听力模块和本地错题功能。

## 项目类型

当前项目是纯静态 HTML/CSS/JavaScript 项目，不是 Vite、React 或 Next.js 项目。

主要入口：

- `index.html`：登录页
- `app.html`：刷题系统主页
- `modules/`：各刷题模块页面
- `assets/auth.js`：Supabase 登录、权限和设备绑定逻辑
- `assets/supabase-config.js`：由环境变量生成的 Supabase 前端配置，不应提交真实密钥

## 本地运行

1. 复制环境变量示例文件：

```bash
cp .env.example .env.local
```

2. 在 `.env.local` 中填写 Supabase 前端配置：

```bash
SUPABASE_URL=你的 Supabase Project URL
SUPABASE_PUBLISHABLE_KEY=你的 Supabase publishable/anon key
```

3. 生成前端配置文件：

```bash
npm run build
```

4. 启动本地静态服务器：

```bash
npm start
```

然后打开：

```text
http://localhost:4173
```

## GitHub 提交注意事项

不要提交真实密钥。以下文件会被 `.gitignore` 排除：

- `.env`
- `.env.local`
- `assets/supabase-config.js`
- `node_modules/`
- `.vercel/`

仓库里只提交 `.env.example`，里面只保留变量名。

## Vercel 测试部署

保护现有正式项目优先：请先在 Vercel 新建一个测试项目连接 GitHub 仓库，不要直接替换原来的正式 Vercel 项目。

测试项目建议配置：

- Framework Preset：Other
- Build Command：`npm run build`
- Output Directory：`.` 或留空
- Install Command：`npm install` 或留空

在 Vercel 测试项目的 Environment Variables 中填写：

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

测试项目确认登录、题库、错题、设备绑定和到期检查都正常后，再考虑把正式 Vercel 项目切换为 GitHub 自动部署。

## Supabase 安全提醒

前端只能使用 publishable/anon key。不要把以下内容放进任何 HTML、JS、JSON 或 GitHub 仓库：

- Supabase `service_role` key
- 数据库密码
- 数据库连接串
- 后端私密 token
