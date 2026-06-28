TEF B1 App v1.0 Supabase 登录版

1. 先在 Supabase 运行 supabase_setup.sql
路径：Supabase Dashboard → SQL Editor → New query → 粘贴全部 → Run

2. 创建测试用户
路径：Authentication → Users → Add user
邮箱：你自己的邮箱，例如 test@example.com
密码：自己设置
建议关闭“Confirm email”相关要求，或手动把用户设为已确认。

3. 给用户开通权限
路径：Table Editor → user_access → Insert row
user_id：复制刚创建用户的 id
plan：30天冲刺版
expires_at：例如 2026-07-28 23:59:59+08
status：active
device_limit：1

4. 上传网页
把整个 tef_v1_supabase_app 文件夹上传到 Vercel。
Vercel 部署后，用户访问 index.html 登录。

5. 重要安全说明
assets/supabase-config.js 里只能放 publishable key。
不要把 sb_secret_... 或 service_role key 放进网页。

6. 换绑设备
路径：Table Editor → user_devices
找到对应 user_id，把旧设备的 is_active 改成 false，用户下次登录会绑定新设备。
