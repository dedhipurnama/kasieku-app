/**
 * KASIEKU — APP ORCHESTRATOR
 * Inisialisasi aplikasi, routing halaman, navigasi
 */

const App = (() => {

  const PAGE_TITLES = {
    pos:          'Kasir (POS)',
    products:     'Produk & Inventori',
    transactions: 'Riwayat Transaksi',
    reports:      'Laporan Penjualan',
    customers:    'Pelanggan & Loyalitas',
    users:        'Manajemen User',
    settings:     'Pengaturan Toko',
  };

  // Halaman yang sudah di-init
  const _initialized = new Set();

  // ── Bootstrap ──────────────────────────────────

  async function bootstrap() {
    // Tampilkan splash 2 detik
    await delay(2000);

    // Cek session
    if (State.isLoggedIn()) {
      // Validasi ke server
      const res = await API.validateSession();
      if (res.success) {
        // Perbarui data session dari server
        State.setSession({ ...State.getSession(), ...res.data });
        await onLoginSuccess();
      } else {
        State.clearSession();
        showAuthScreen();
      }
    } else {
      showAuthScreen();
    }

    hideSplash();
  }

  function hideSplash() {
    const splash = Utils.el('splash-screen');
    splash.classList.add('fade-out');
    setTimeout(() => splash.classList.add('hidden'), 500);
  }

  // ── Auth Flow ──────────────────────────────────

  function showAuthScreen() {
    Utils.el('app').classList.add('hidden');
    Utils.el('auth-screen').classList.remove('hidden');
    Auth.init();
    lucide.createIcons();
  }

  async function onLoginSuccess() {
    Utils.el('auth-screen').classList.add('hidden');
    Utils.el('app').classList.remove('hidden');

    await initShell();
    await navigateTo('pos');
    lucide.createIcons();
  }

  // ── Shell Init ─────────────────────────────────

  async function initShell() {
    const session = State.getSession();

    // Update sidebar user info
    Utils.setText('sidebar-name', session.name || 'User');
    Utils.setText('sidebar-role', capitalizeRole(session.role));
    Utils.setText('sidebar-store', session.storeName || 'Toko Saya');
    Utils.setText('sidebar-avatar', Utils.initials(session.name));

    // Tampilkan/sembunyikan elemen admin-only
    const isAdmin = State.isAdmin();
    const isManager = State.isManagerOrAdmin();
    document.querySelectorAll('.admin-only').forEach(el => {
      el.style.display = isManager ? '' : 'none';
    });

    // Load settings untuk seluruh app
    const settingsRes = await API.getSettings();
    if (settingsRes.success) {
      State.setSettings(settingsRes.data || {});
      // Update topbar store name (opsional)
    }

    // Topbar clock
    startClock();

    // Navigation
    bindNavigation();

    // Logout
    Utils.el('logout-btn').addEventListener('click', Auth.logout);

    // Modal close on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) {
          backdrop.classList.add('hidden');
        }
      });
    });
  }

  // ── Navigation ─────────────────────────────────

  function bindNavigation() {
    // Sidebar nav links
    document.querySelectorAll('.nav-item[data-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        navigateTo(link.dataset.page);
        closeSidebar();
      });
    });

    // Mobile menu toggle
    Utils.el('menu-btn').addEventListener('click', toggleSidebar);
    Utils.el('sidebar-close').addEventListener('click', closeSidebar);
    Utils.el('sidebar-overlay').addEventListener('click', closeSidebar);
  }

  async function navigateTo(page) {
    // Cek permission
    if ((page === 'users' || page === 'settings') && !State.isManagerOrAdmin()) {
      Utils.toast('Akses ditolak', 'error');
      return;
    }

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(link => {
      link.classList.toggle('active', link.dataset.page === page);
    });

    // Update page title
    Utils.setText('page-title', PAGE_TITLES[page] || page);

    // Hide all pages, show target
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const pageEl = Utils.el(`page-${page}`);
    if (pageEl) pageEl.classList.add('active');

    State.setCurrentPage(page);

    // Init page module (sekali saja)
    if (!_initialized.has(page)) {
      _initialized.add(page);
      await initPage(page);
    } else {
      // Refresh data on re-visit untuk beberapa halaman
      await refreshPage(page);
    }

    lucide.createIcons();
  }

  async function initPage(page) {
    switch (page) {
      case 'pos':          await POS.init();          break;
      case 'products':     await Products.init();     break;
      case 'transactions': await Transactions.init(); break;
      case 'reports':      await Reports.init();      break;
      case 'customers':    await Customers.init();    break;
      case 'users':        await Users.init();        break;
      case 'settings':     await Settings.init();     break;
    }
  }

  async function refreshPage(page) {
    switch (page) {
      case 'transactions': await Transactions.load(); break;
      case 'reports':      await Reports.load();      break;
      case 'customers':    await Customers.load();    break;
      case 'users':        await Users.load();        break;
    }
  }

  // ── Sidebar Mobile ─────────────────────────────

  function toggleSidebar() {
    Utils.el('sidebar').classList.toggle('open');
    Utils.el('sidebar-overlay').classList.toggle('open');
  }

  function closeSidebar() {
    Utils.el('sidebar').classList.remove('open');
    Utils.el('sidebar-overlay').classList.remove('open');
  }

  // ── Clock ──────────────────────────────────────

  function startClock() {
    const update = () => {
      const now = new Date();
      const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      const clockEl = Utils.el('topbar-clock');
      if (clockEl) clockEl.textContent = timeStr;
    };
    update();
    setInterval(update, 1000);
  }

  // ── Helpers ────────────────────────────────────

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function capitalizeRole(role) {
    const map = { admin: 'Administrator', manager: 'Manager', kasir: 'Kasir' };
    return map[role] || role;
  }

  // ── PWA Service Worker ─────────────────────────

  function registerSW() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('sw.js').then(reg => {
        console.log('[SW] Registered:', reg.scope);
      }).catch(err => {
        console.warn('[SW] Registration failed:', err);
      });
    }
  }

  // ── Keyboard Shortcuts ─────────────────────────

  function bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      // F1 = POS
      if (e.key === 'F1') { e.preventDefault(); navigateTo('pos'); }
      // F2 = Products
      if (e.key === 'F2') { e.preventDefault(); navigateTo('products'); }
      // F3 = Barcode scan
      if (e.key === 'F3') { e.preventDefault(); Scanner.open('pos'); }
      // ESC = close modals
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => m.classList.add('hidden'));
      }
    });
  }

  // ── Entry Point ────────────────────────────────

  document.addEventListener('DOMContentLoaded', () => {
    registerSW();
    bindShortcuts();
    bootstrap();
  });

  return { onLoginSuccess, showAuthScreen };

})();
