/* ═══════════════════════════════════════════════
   TRANSACTIONS MODULE
═══════════════════════════════════════════════ */
const Transactions = (() => {

  async function init() {
    Utils.el('trx-date-filter').value = Utils.todayISO();
    await load();
    Utils.el('trx-date-filter').addEventListener('change', load);
    Utils.el('export-trx-btn').addEventListener('click', exportCSV);
  }

  async function load() {
    const date = Utils.el('trx-date-filter').value;
    Utils.el('transactions-tbody').innerHTML = `<tr><td colspan="8" class="loading-cell"><div class="spinner"></div></td></tr>`;
    const res = await API.getTransactions({ date });
    if (res.success) render(res.data || []);
    else Utils.el('transactions-tbody').innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--danger);padding:32px">${res.message}</td></tr>`;
  }

  const METHOD_ICONS = { cash:'💵', debit:'💳', qris:'📱', transfer:'🏦' };

  function render(transactions) {
    if (!transactions.length) {
      Utils.el('transactions-tbody').innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px">Tidak ada transaksi pada tanggal ini</td></tr>`;
      return;
    }
    Utils.el('transactions-tbody').innerHTML = transactions.map(t => `
      <tr>
        <td style="font-family:monospace;font-size:12px;font-weight:600">${t.receiptNo}</td>
        <td>${Utils.formatDateTime(t.timestamp)}</td>
        <td>${t.cashierName}</td>
        <td>${t.customer?.name || '<span class="text-muted">Umum</span>'}</td>
        <td>${t.items?.length || 0} item</td>
        <td style="font-weight:700;color:var(--accent-2)">${Utils.formatRupiah(t.total)}</td>
        <td>${METHOD_ICONS[t.paymentMethod]||''} ${(t.paymentMethod||'').toUpperCase()}</td>
        <td>
          <button class="btn btn--ghost btn--sm" onclick="Transactions.detail('${t.id}')">
            <i data-lucide="eye"></i> Detail
          </button>
        </td>
      </tr>`).join('');
    lucide.createIcons();
  }

  async function detail(id) {
    const res = await API.getTransactionDetail(id);
    if (!res.success) { Utils.toast('Gagal memuat detail', 'error'); return; }
    Receipt.show(res.data, State.getSettings());
    // Hide print/share/done btn actions, just show close
    Utils.el('done-receipt-btn').textContent = 'Tutup';
  }

  function exportCSV() {
    Utils.toast('Export transaksi sedang disiapkan...', 'info');
  }

  return { init, load, detail };
})();

/* ═══════════════════════════════════════════════
   REPORTS MODULE
═══════════════════════════════════════════════ */
const Reports = (() => {

  let _salesChart = null;
  let _paymentChart = null;

  async function init() {
    Utils.el('report-period').addEventListener('change', load);
    Utils.el('export-report-btn').addEventListener('click', () => Utils.toast('Fitur export PDF tersedia di versi Pro', 'info'));
    await load();
  }

  async function load() {
    const period = Utils.el('report-period').value;
    const res = await API.getReport(period);
    if (!res.success) { Utils.toast('Gagal memuat laporan: ' + res.message, 'error'); return; }
    renderStats(res.data);
    renderSalesChart(res.data.dailySales || []);
    renderTopProducts(res.data.topProducts || []);
    renderPaymentChart(res.data.paymentMethods || {});
  }

  function renderStats(data) {
    Utils.setText('report-revenue', Utils.formatRupiah(data.totalRevenue || 0));
    Utils.setText('report-trx-count', data.totalTransactions || 0);
    Utils.setText('report-avg', Utils.formatRupiah(data.avgTransaction || 0));
    Utils.setText('report-items', data.totalItemsSold || 0);
  }

  function renderSalesChart(dailySales) {
    const canvas = Utils.el('sales-canvas');
    if (!canvas) return;
    if (_salesChart) _salesChart.destroy();

    // Simple SVG chart (no external lib dependency)
    const parent = canvas.parentElement;
    parent.innerHTML = '';

    if (!dailySales.length) {
      parent.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px">Tidak ada data</p>';
      return;
    }

    const maxVal = Math.max(...dailySales.map(d => d.revenue), 1);
    const w = parent.offsetWidth || 600;
    const h = 220;
    const padL = 60, padR = 20, padT = 20, padB = 40;
    const chartW = w - padL - padR;
    const chartH = h - padT - padB;
    const barW = Math.max(8, (chartW / dailySales.length) - 4);

    let svg = `<svg width="100%" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#7c3aed"/>
          <stop offset="100%" stop-color="#06b6d4"/>
        </linearGradient>
      </defs>`;

    // Y axis labels
    for (let i = 0; i <= 4; i++) {
      const y = padT + chartH - (chartH * i / 4);
      const val = (maxVal * i / 4);
      svg += `<text x="${padL - 6}" y="${y + 4}" text-anchor="end" font-size="10" fill="#5a5a7a">${val >= 1000000 ? (val/1000000).toFixed(1)+'jt' : val >= 1000 ? (val/1000).toFixed(0)+'k' : val}</text>
              <line x1="${padL}" y1="${y}" x2="${w - padR}" y2="${y}" stroke="#1e1e28" stroke-width="1"/>`;
    }

    dailySales.forEach((d, i) => {
      const barH = Math.max(2, (d.revenue / maxVal) * chartH);
      const x = padL + (i / dailySales.length) * chartW + ((chartW / dailySales.length) - barW) / 2;
      const y = padT + chartH - barH;
      svg += `<rect x="${x}" y="${y}" width="${barW}" height="${barH}" rx="3" fill="url(#barGrad)" opacity="0.85"/>
              <text x="${x + barW/2}" y="${h - padB + 14}" text-anchor="middle" font-size="9" fill="#5a5a7a">${d.label || ''}</text>`;
    });

    svg += '</svg>';
    parent.innerHTML = svg;
  }

  function renderTopProducts(products) {
    const list = Utils.el('top-products-list');
    if (!products.length) { list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px">Tidak ada data</p>'; return; }
    const max = products[0].qty || 1;
    list.innerHTML = products.slice(0, 8).map((p, i) => `
      <div class="rank-item">
        <span class="rank-num">${i+1}</span>
        <div class="rank-info">
          <div class="rank-name">${p.name}</div>
          <div class="rank-sub">${p.qty} terjual · ${Utils.formatRupiah(p.revenue)}</div>
        </div>
        <div class="rank-bar-wrap">
          <div class="rank-bar" style="width:${Math.round((p.qty/max)*100)}%"></div>
        </div>
      </div>`).join('');
  }

  function renderPaymentChart(methods) {
    const parent = Utils.el('payment-methods-chart');
    if (!parent) return;
    const entries = Object.entries(methods).filter(([,v]) => v > 0);
    if (!entries.length) { parent.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:40px">Tidak ada data</p>'; return; }

    const total = entries.reduce((s,[,v]) => s+v, 0);
    const colors = CONFIG.CHART_COLORS;
    let cumulAngle = -Math.PI / 2;
    const cx = 80, cy = 80, r = 65;

    let paths = '';
    let legend = '<div style="font-size:12px;margin-left:12px">';

    entries.forEach(([method, val], i) => {
      const angle = (val / total) * 2 * Math.PI;
      const x1 = cx + r * Math.cos(cumulAngle);
      const y1 = cy + r * Math.sin(cumulAngle);
      const x2 = cx + r * Math.cos(cumulAngle + angle);
      const y2 = cy + r * Math.sin(cumulAngle + angle);
      const large = angle > Math.PI ? 1 : 0;
      paths += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z" fill="${colors[i % colors.length]}" opacity="0.85"/>`;
      legend += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
        <div style="width:10px;height:10px;border-radius:2px;background:${colors[i%colors.length]}"></div>
        <span style="color:var(--text-secondary)">${method.toUpperCase()}: ${Math.round(val/total*100)}%</span>
      </div>`;
      cumulAngle += angle;
    });
    legend += '</div>';

    parent.innerHTML = `<div style="display:flex;align-items:center">
      <svg width="160" height="160" viewBox="0 0 160 160">${paths}
        <circle cx="${cx}" cy="${cy}" r="30" fill="var(--bg-surface)"/>
        <text x="${cx}" y="${cy+4}" text-anchor="middle" font-size="10" fill="var(--text-muted)">Total</text>
      </svg>${legend}</div>`;
  }

  return { init, load };
})();

/* ═══════════════════════════════════════════════
   CUSTOMERS MODULE
═══════════════════════════════════════════════ */
const Customers = (() => {

  let _customers = [];

  async function init() {
    await load();
    Utils.el('add-customer-btn').addEventListener('click', () => openForm());
    Utils.el('save-customer-btn').addEventListener('click', handleSave);
    document.querySelectorAll('[data-modal="modal-customer"]').forEach(b =>
      b.addEventListener('click', () => Utils.hideModal('modal-customer')));
  }

  async function load() {
    Utils.el('customers-tbody').innerHTML = `<tr><td colspan="7" class="loading-cell"><div class="spinner"></div></td></tr>`;
    const res = await API.getCustomers();
    if (res.success) {
      _customers = res.data || [];
      State.setCustomers(_customers);
      render(_customers);
    }
  }

  function render(customers) {
    if (!customers.length) {
      Utils.el('customers-tbody').innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">Belum ada pelanggan</td></tr>`;
      return;
    }
    const settings = State.getSettings();
    Utils.el('customers-tbody').innerHTML = customers.map(c => {
      const lvl = Utils.loyaltyLevel(c.points||0, settings);
      return `<tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--accent-grad);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${Utils.initials(c.name)}</div>
            <div>
              <div style="font-weight:600;color:var(--text-primary)">${c.name}</div>
              ${c.dob ? `<div style="font-size:11px;color:var(--text-muted)">🎂 ${Utils.formatDate(c.dob)}</div>` : ''}
            </div>
          </div>
        </td>
        <td>${c.phone}</td>
        <td>${c.email||'—'}</td>
        <td style="color:var(--warning);font-weight:600">⭐ ${c.points||0}</td>
        <td style="font-weight:600;color:var(--accent-2)">${Utils.formatRupiah(c.totalSpend||0)}</td>
        <td><span class="badge ${lvl.class}">${lvl.label}</span></td>
        <td>
          <div class="action-btns">
            <button class="btn btn--ghost btn--sm" onclick="Customers.edit('${c.id}')"><i data-lucide="pencil"></i></button>
            <button class="btn btn--danger btn--sm" onclick="Customers.delete('${c.id}')"><i data-lucide="trash-2"></i></button>
          </div>
        </td>
      </tr>`;
    }).join('');
    lucide.createIcons();
  }

  function openForm(customer = null) {
    Utils.el('customer-form').reset();
    Utils.el('cf-id').value = '';
    Utils.el('customer-modal-title').textContent = customer ? 'Edit Pelanggan' : 'Tambah Pelanggan';
    if (customer) {
      Utils.el('cf-id').value = customer.id;
      Utils.el('cf-name').value = customer.name||'';
      Utils.el('cf-phone').value = customer.phone||'';
      Utils.el('cf-email').value = customer.email||'';
      Utils.el('cf-dob').value = customer.dob||'';
      Utils.el('cf-address').value = customer.address||'';
    }
    Utils.showModal('modal-customer');
  }

  async function handleSave() {
    const id    = Utils.el('cf-id').value;
    const name  = Utils.el('cf-name').value.trim();
    const phone = Utils.el('cf-phone').value.trim();
    if (!name || !phone) { Utils.toast('Nama dan nomor HP wajib diisi', 'warning'); return; }

    const session = State.getSession();
    const customer = {
      id:       id || Utils.generateId('CST-'),
      name, phone,
      email:    Utils.el('cf-email').value.trim(),
      dob:      Utils.el('cf-dob').value,
      address:  Utils.el('cf-address').value.trim(),
      points:   id ? undefined : 0,
      totalSpend: id ? undefined : 0,
      storeId:  session.storeId,
      createdAt: id ? undefined : Utils.nowISO(),
      updatedAt: Utils.nowISO(),
    };

    const btn = Utils.el('save-customer-btn');
    btn.disabled = true;
    const res = await API.saveCustomer(customer);
    btn.disabled = false;

    if (res.success) {
      Utils.toast(id ? 'Pelanggan diperbarui' : 'Pelanggan ditambahkan', 'success');
      Utils.hideModal('modal-customer');
      await load();
    } else {
      Utils.toast('Gagal: ' + res.message, 'error');
    }
  }

  async function deleteCustomer(id) {
    if (!Utils.confirm('Hapus pelanggan ini?')) return;
    const res = await API.deleteCustomer(id);
    if (res.success) { Utils.toast('Pelanggan dihapus', 'success'); await load(); }
    else Utils.toast('Gagal: ' + res.message, 'error');
  }

  return {
    init, load,
    edit: (id) => openForm(_customers.find(c => c.id === id)),
    delete: deleteCustomer,
  };
})();

/* ═══════════════════════════════════════════════
   USERS MODULE
═══════════════════════════════════════════════ */
const Users = (() => {

  let _users = [];

  async function init() {
    if (!State.isManagerOrAdmin()) return;
    await load();
    if (State.isAdmin()) {
      Utils.el('add-user-btn').addEventListener('click', () => openForm());
    }
    Utils.el('save-user-btn').addEventListener('click', handleSave);
    document.querySelectorAll('[data-modal="modal-user"]').forEach(b =>
      b.addEventListener('click', () => Utils.hideModal('modal-user')));
  }

  async function load() {
    Utils.el('users-tbody').innerHTML = `<tr><td colspan="7" class="loading-cell"><div class="spinner"></div></td></tr>`;
    const res = await API.getUsers();
    if (res.success) { _users = res.data||[]; State.setUsers(_users); render(_users); }
  }

  function render(users) {
    if (!users.length) {
      Utils.el('users-tbody').innerHTML = `<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px">Tidak ada user</td></tr>`;
      return;
    }
    const myId = State.getSession().userId;
    Utils.el('users-tbody').innerHTML = users.map(u => `
      <tr>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <div style="width:32px;height:32px;border-radius:50%;background:var(--accent-grad);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:13px">${Utils.initials(u.name)}</div>
            <span style="font-weight:600;color:var(--text-primary)">${u.name} ${u.id===myId?'<span style="font-size:11px;color:var(--accent-2)">(Saya)</span>':''}</span>
          </div>
        </td>
        <td style="font-family:monospace">@${u.username}</td>
        <td>${u.email||'—'}</td>
        <td>${Utils.roleBadge(u.role)}</td>
        <td>${u.isActive ? '<span class="badge badge--success">Aktif</span>' : '<span class="badge badge--danger">Nonaktif</span>'}</td>
        <td>${u.lastLogin ? Utils.formatDateTime(u.lastLogin) : '—'}</td>
        <td>
          <div class="action-btns">
            ${State.isAdmin() && u.id !== myId ? `
              <button class="btn btn--ghost btn--sm" onclick="Users.edit('${u.id}')"><i data-lucide="pencil"></i></button>
              <button class="btn btn--danger btn--sm" onclick="Users.delete('${u.id}')"><i data-lucide="trash-2"></i></button>
            ` : '—'}
          </div>
        </td>
      </tr>`).join('');
    lucide.createIcons();
  }

  function openForm(user = null) {
    Utils.el('user-form').reset();
    Utils.el('uf-id').value = '';
    Utils.el('user-modal-title').textContent = user ? 'Edit User' : 'Tambah User';
    Utils.el('uf-password-group').style.display = user ? 'none' : 'block';
    if (user) {
      Utils.el('uf-id').value = user.id;
      Utils.el('uf-name').value = user.name||'';
      Utils.el('uf-username').value = user.username||'';
      Utils.el('uf-email').value = user.email||'';
      Utils.el('uf-role').value = user.role||'kasir';
    }
    Utils.showModal('modal-user');
  }

  async function handleSave() {
    const id = Utils.el('uf-id').value;
    const name = Utils.el('uf-name').value.trim();
    const username = Utils.el('uf-username').value.trim();
    const email = Utils.el('uf-email').value.trim();
    const password = Utils.el('uf-password').value;
    const role = Utils.el('uf-role').value;

    if (!name || !username || !email) { Utils.toast('Nama, username, email wajib diisi', 'warning'); return; }
    if (!id && !password) { Utils.toast('Password wajib diisi untuk user baru', 'warning'); return; }
    if (!id && password.length < 8) { Utils.toast('Password minimal 8 karakter', 'warning'); return; }

    const session = State.getSession();
    const user = { id: id||Utils.generateId('USR-'), name, username, email, role, storeId: session.storeId };
    if (!id) user.password = password;

    const btn = Utils.el('save-user-btn');
    btn.disabled = true;
    const res = await API.saveUser(user);
    btn.disabled = false;

    if (res.success) {
      Utils.toast(id ? 'User diperbarui' : 'User berhasil ditambahkan', 'success');
      Utils.hideModal('modal-user');
      await load();
    } else {
      Utils.toast('Gagal: ' + res.message, 'error');
    }
  }

  async function deleteUser(id) {
    if (!Utils.confirm('Hapus user ini?')) return;
    const res = await API.deleteUser(id);
    if (res.success) { Utils.toast('User dihapus', 'success'); await load(); }
    else Utils.toast('Gagal: ' + res.message, 'error');
  }

  return {
    init, load,
    edit: (id) => openForm(_users.find(u => u.id === id)),
    delete: deleteUser,
  };
})();

/* ═══════════════════════════════════════════════
   SETTINGS MODULE
═══════════════════════════════════════════════ */
const Settings = (() => {

  async function init() {
    await load();
    Utils.el('store-settings-form').addEventListener('submit', handleSaveStore);
    Utils.el('save-loyalty-btn').addEventListener('click', handleSaveLoyalty);
  }

  async function load() {
    const res = await API.getSettings();
    if (res.success) {
      const s = res.data || {};
      State.setSettings(s);
      Utils.el('s-store-name').value    = s.storeName||'';
      Utils.el('s-store-address').value = s.storeAddress||'';
      Utils.el('s-store-phone').value   = s.storePhone||'';
      Utils.el('s-receipt-footer').value= s.receiptFooter||'Terima kasih telah berbelanja!';
      Utils.el('s-loyalty-rate').value  = s.loyaltyRate || CONFIG.LOYALTY_POINTS_PER_1K;
      Utils.el('s-point-value').value   = s.pointValue  || CONFIG.LOYALTY_POINT_VALUE;
      Utils.el('s-silver-threshold').value = s.silverThreshold || 500;
      Utils.el('s-gold-threshold').value   = s.goldThreshold   || 2000;
    }
  }

  async function handleSaveStore(e) {
    e.preventDefault();
    const settings = {
      ...State.getSettings(),
      storeName:     Utils.el('s-store-name').value.trim(),
      storeAddress:  Utils.el('s-store-address').value.trim(),
      storePhone:    Utils.el('s-store-phone').value.trim(),
      receiptFooter: Utils.el('s-receipt-footer').value.trim(),
    };
    const res = await API.saveSettings(settings);
    if (res.success) { Utils.toast('Pengaturan toko disimpan', 'success'); State.setSettings(settings); }
    else Utils.toast('Gagal: ' + res.message, 'error');
  }

  async function handleSaveLoyalty() {
    const settings = {
      ...State.getSettings(),
      loyaltyRate:      parseFloat(Utils.el('s-loyalty-rate').value)||1,
      pointValue:       parseFloat(Utils.el('s-point-value').value)||10,
      silverThreshold:  parseInt(Utils.el('s-silver-threshold').value)||500,
      goldThreshold:    parseInt(Utils.el('s-gold-threshold').value)||2000,
    };
    const res = await API.saveSettings(settings);
    if (res.success) { Utils.toast('Pengaturan loyalitas disimpan', 'success'); State.setSettings(settings); }
    else Utils.toast('Gagal: ' + res.message, 'error');
  }

  return { init };
})();

/* ═══════════════════════════════════════════════
   BARCODE SCANNER MODULE
═══════════════════════════════════════════════ */
const Scanner = (() => {

  let _stream = null;
  let _mode = 'pos'; // 'pos' atau 'product'

  async function open(mode = 'pos') {
    _mode = mode;
    Utils.showModal('modal-scanner');
    Utils.el('manual-barcode').value = '';

    try {
      _stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const video = Utils.el('scanner-video');
      video.srcObject = _stream;
      video.play();
      startDetection(video);
    } catch (err) {
      console.warn('Camera not available:', err);
    }

    // Manual input
    Utils.el('manual-barcode-btn').onclick = () => {
      const val = Utils.el('manual-barcode').value.trim();
      if (val) handleDetected(val);
    };
    Utils.el('manual-barcode').addEventListener('keydown', e => {
      if (e.key === 'Enter') {
        const val = Utils.el('manual-barcode').value.trim();
        if (val) handleDetected(val);
      }
    });

    // Close = stop camera
    document.querySelector('[data-modal="modal-scanner"]').onclick = () => {
      stop();
      Utils.hideModal('modal-scanner');
    };
  }

  // Deteksi barcode menggunakan BarcodeDetector API (Chrome/Android)
  function startDetection(video) {
    if (!('BarcodeDetector' in window)) return; // Fallback ke manual
    const detector = new BarcodeDetector({ formats: ['ean_13','ean_8','code_128','code_39','qr_code'] });
    let scanning = true;

    const detect = async () => {
      if (!scanning || video.readyState < 2) { requestAnimationFrame(detect); return; }
      try {
        const codes = await detector.detect(video);
        if (codes.length > 0) {
          scanning = false;
          handleDetected(codes[0].rawValue);
        } else {
          requestAnimationFrame(detect);
        }
      } catch {
        requestAnimationFrame(detect);
      }
    };
    detect();
  }

  function handleDetected(barcode) {
    stop();
    Utils.hideModal('modal-scanner');
    if (_mode === 'pos') {
      POS.addToCartByBarcode(barcode);
    } else {
      // Mode pencarian produk
      Utils.el('product-search').value = barcode;
      Utils.el('product-search').dispatchEvent(new Event('input'));
    }
  }

  function stop() {
    if (_stream) {
      _stream.getTracks().forEach(t => t.stop());
      _stream = null;
    }
  }

  return { open };
})();
