/*
  TEF v1.0 Supabase 登录版
  功能：邮箱密码登录、账号有效期、一账号一设备、动态水印所需 session。
*/
(function(){
  const SESSION_KEY = 'tef_v1_sb_session';
  const DEVICE_KEY = 'tef_v1_device_id';
  const cfg = window.TEF_SUPABASE_CONFIG;
  if(!cfg || !cfg.url || !cfg.publishableKey){
    console.error('缺少 Supabase 配置。请检查 assets/supabase-config.js');
  }

  const supabase = window.supabase.createClient(cfg.url, cfg.publishableKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  function uuid(){
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'dev-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function safeStorage(){
    try { const k='__tef_test__'; localStorage.setItem(k,'1'); localStorage.removeItem(k); return true; }
    catch(e){ return false; }
  }
  function getDeviceId(){
    if(!safeStorage()) throw new Error('浏览器禁止了本地存储 localStorage。请不要用无痕模式/微信内置浏览器，改用 Safari、Chrome 或 Edge 打开。');
    let id = localStorage.getItem(DEVICE_KEY);
    if(!id){ id = uuid(); localStorage.setItem(DEVICE_KEY, id); }
    return id;
  }
  function deviceName(){
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const lang = navigator.language || '';
    return `${platform}｜${lang}｜${ua.slice(0,120)}`;
  }
  function fmtUserEmail(user){ return user?.email || user?.user_metadata?.email || ''; }
  function isExpired(access){ return new Date(access.expires_at).getTime() < Date.now(); }

  async function fetchAccess(userId){
    const { data, error } = await supabase
      .from('user_access')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('expires_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if(error) throw error;
    if(!data) return {ok:false, reason:'账号没有开通权限。请先在 Supabase 的 user_access 表给该用户设置有效期。'};
    if(isExpired(data)) return {ok:false, reason:'账号已到期，请联系续费。'};
    return {ok:true, access:data};
  }

  async function fetchProfile(user){
    let { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();
    if(error) throw error;
    if(!data){
      const email = fmtUserEmail(user);
      const up = { id:user.id, email, nickname: email ? email.split('@')[0] : '用户' };
      const res = await supabase.from('profiles').upsert(up).select('*').single();
      if(res.error) throw res.error;
      data = res.data;
    }
    return data;
  }

  async function bindOrCheckDevice(userId, access){
    const current = getDeviceId();
    const limit = Number(access.device_limit || 1);
    const { data: devices, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('first_seen_at', { ascending: true });
    if(error) throw error;

    const same = (devices || []).find(d => d.device_id === current);
    if(same){
      const { error: upErr } = await supabase
        .from('user_devices')
        .update({ last_seen_at: new Date().toISOString(), device_name: deviceName() })
        .eq('id', same.id);
      if(upErr) throw upErr;
      return {ok:true, firstBind:false, deviceId:current};
    }
    if((devices || []).length >= limit){
      return {ok:false, reason:'账号已绑定其他设备。请联系管理员换绑。'};
    }
    const { error: insErr } = await supabase.from('user_devices').insert({
      user_id:userId,
      device_id:current,
      device_name:deviceName(),
      is_active:true
    });
    if(insErr) throw insErr;
    return {ok:true, firstBind:true, deviceId:current};
  }

  function makeSession(user, profile, access, deviceId){
    return {
      userId: user.id,
      username: user.id,
      email: fmtUserEmail(user),
      nickname: profile?.nickname || fmtUserEmail(user) || '用户',
      phoneMasked: profile?.phone || fmtUserEmail(user) || '已登录用户',
      expiresAt: access.expires_at,
      plan: access.plan || '已开通',
      deviceId,
      loginAt: new Date().toISOString()
    };
  }

  async function hydrateSession(){
    const { data, error } = await supabase.auth.getUser();
    if(error || !data?.user) return {ok:false, reason:'未登录。'};
    const user = data.user;
    const accessRes = await fetchAccess(user.id);
    if(!accessRes.ok) return accessRes;
    const device = await bindOrCheckDevice(user.id, accessRes.access);
    if(!device.ok) return device;
    const profile = await fetchProfile(user);
    const session = makeSession(user, profile, accessRes.access, device.deviceId);
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return {ok:true, session, firstBind:device.firstBind};
  }

  async function login(email, password){
    email = String(email || '').trim();
    password = String(password || '').trim();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if(error) return {ok:false, reason:'账号或密码错误，或该邮箱尚未创建用户。'};
    try { return await hydrateSession(); }
    catch(e){ return {ok:false, reason:e.message || String(e)}; }
  }

  async function validateSession(){
    try { return await hydrateSession(); }
    catch(e){ return {ok:false, reason:e.message || String(e)}; }
  }

  async function logout(){
    localStorage.removeItem(SESSION_KEY);
    await supabase.auth.signOut();
  }

  async function resetThisBrowserBinding(){
    const { data } = await supabase.auth.getUser();
    const user = data?.user;
    if(!user) return {ok:false, reason:'未登录，无法重置云端设备。'};
    const current = getDeviceId();
    const { error } = await supabase
      .from('user_devices')
      .update({ is_active:false })
      .eq('user_id', user.id)
      .eq('device_id', current);
    if(error) return {ok:false, reason:error.message};
    return {ok:true};
  }

  window.TEF_AUTH = { login, logout, validateSession, getDeviceId, resetThisBrowserBinding, supabase };
})();
