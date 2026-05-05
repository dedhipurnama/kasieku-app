/**
 * KASIEKU — AUTH MODULE
 * Mengelola login, register, logout, dan validasi session
 */

const Auth = (() => {

  function init() {
    // Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Login form
    Utils.el('login-form').addEventListener('submit', handleLogin);

    // Register form
    Utils.el('register-form').addEventListener('submit', handleRegister);

    // Password toggle
    document.querySelectorAll('.field-toggle').forEach(btn => {
      btn.addEventListener('click', () => {
        const input = Utils.el(btn.dataset.target);
        if (!input) return;
        const isPass = input.type === 'password';
        input.type = isPass ? 'text' : 'password';
        btn.querySelector('[data-lucide]').setAttribute('data-lucide', isPass ? 'eye-off' : 'eye');
        lucide.createIcons();
      });
    });
  }

  function switchTab(tab) {
    document.querySelectorAll('.auth-tab').forEach(t => {
      t.classList.toggle('active', t.dataset.tab === tab);
    });
    Utils.el('login-form').classList.toggle('hidden', tab !== 'login');
    Utils.el('register-form').classList.toggle('hidden', tab !== 'register');
  }

  async function handleLogin(e) {
    e.preventDefault();
    const btn = Utils.el('login-btn');
    const errorEl = Utils.el('login-error');
    errorEl.classList.add('hidden');

    const username = Utils.el('login-username').value.trim();
    const password = Utils.el('login-password').value;

    if (!username || !password) {
      showError('login-error', 'Username dan password wajib diisi');
      return;
    }

    setLoading(btn, true);
    const res = await API.login(username, password);
    setLoading(btn, false);

    if (res.success) {
      // Simpan session
      State.setSession({
        token:    res.data.token,
        userId:   res.data.userId,
        name:     res.data.name,
        username: res.data.username,
        email:    res.data.email,
        role:     res.data.role,
        storeId:  res.data.storeId,
        storeName: res.data.storeName,
      });

      Utils.toast(`Selamat datang, ${res.data.name}! 👋`, 'success');
      App.onLoginSuccess();
    } else {
      showError('login-error', res.message || 'Login gagal. Periksa username dan password.');
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    const btn = Utils.el('register-btn');
    const msgEl = Utils.el('register-message');
    msgEl.classList.add('hidden');
    msgEl.className = 'auth-message hidden';

    const name      = Utils.el('reg-name').value.trim();
    const username  = Utils.el('reg-username').value.trim();
    const email     = Utils.el('reg-email').value.trim();
    const password  = Utils.el('reg-password').value;
    const storeCode = Utils.el('reg-store-code').value.trim();

    if (!name || !username || !email || !password) {
      showAuthMsg('register-message', 'Semua field wajib wajib diisi', 'error');
      return;
    }

    if (password.length < 8) {
      showAuthMsg('register-message', 'Password minimal 8 karakter', 'error');
      return;
    }

    setLoading(btn, true);
    const res = await API.register({ name, username, email, password, storeCode });
    setLoading(btn, false);

    if (res.success) {
      showAuthMsg('register-message', '✅ Akun berhasil dibuat! Silakan login.', 'success');
      setTimeout(() => switchTab('login'), 1500);
      Utils.el('register-form').reset();
    } else {
      showAuthMsg('register-message', res.message || 'Registrasi gagal.', 'error');
    }
  }

  async function logout() {
    if (!Utils.confirm('Yakin ingin keluar?')) return;
    await API.logout();
    State.clearSession();
    App.showAuthScreen();
    Utils.toast('Anda telah keluar', 'info');
  }

  // Helpers

  function showError(id, msg) {
    const el = Utils.el(id);
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function showAuthMsg(id, msg, type) {
    const el = Utils.el(id);
    el.textContent = msg;
    el.className = `auth-message auth-message--${type}`;
    el.classList.remove('hidden');
  }

  function setLoading(btn, loading) {
    btn.disabled = loading;
    btn.style.position = loading ? 'relative' : '';
    const span = btn.querySelector('span');
    if (span) span.style.opacity = loading ? '0' : '1';
    if (loading) {
      btn.classList.add('loading');
    } else {
      btn.classList.remove('loading');
    }
  }

  return { init, logout };

})();
