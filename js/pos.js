/**
 * KASIEKU — POS MODULE
 * Logic utama kasir: grid produk, keranjang, checkout, struk
 */

const POS = (() => {

  let _allProducts = [];
  let _currentCategory = 'all';
  let _searchQuery = '';

  // ── Init ──────────────────────────────────────

  async function init() {
    await loadProducts();
    bindEvents();
    renderCart();
  }

  function bindEvents() {
    // Search
    const searchInput = Utils.el('pos-search');
    searchInput.addEventListener('input', Utils.debounce((e) => {
      _searchQuery = e.target.value.toLowerCase();
      renderProductGrid();
    }, 250));

    // Category filter
    Utils.el('pos-categories').addEventListener('click', (e) => {
      const pill = e.target.closest('.category-pill');
      if (!pill) return;
      _currentCategory = pill.dataset.cat;
      document.querySelectorAll('.category-pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      renderProductGrid();
    });

    // Discount input
    Utils.el('discount-pct').addEventListener('input', (e) => {
      let val = parseFloat(e.target.value) || 0;
      val = Math.max(0, Math.min(100, val));
      State.getCart().discountPct = val;
      updateCartTotals();
    });

    // Payment method buttons
    document.querySelectorAll('.payment-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        State.getCart().paymentMethod = btn.dataset.method;
        togglePaymentPanel(btn.dataset.method);
      });
    });

    // Cash input
    Utils.el('cash-received').addEventListener('input', updateChangeDisplay);

    // Quick cash buttons
    document.querySelectorAll('.quick-cash-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const amount = btn.dataset.amount;
        const total = State.getCartTotals().total;
        if (amount === 'exact') {
          Utils.el('cash-received').value = total;
        } else {
          Utils.el('cash-received').value = parseInt(amount);
        }
        updateChangeDisplay();
      });
    });

    // Select customer
    Utils.el('select-customer-btn').addEventListener('click', () => {
      CustomerSelector.open();
    });

    // Checkout
    Utils.el('checkout-btn').addEventListener('click', handleCheckout);

    // Barcode scan dari topbar
    Utils.el('barcode-scan-btn').addEventListener('click', () => {
      if (State.getCurrentPage() === 'pos') Scanner.open('pos');
    });
  }

  // ── Products ──────────────────────────────────

  async function loadProducts() {
    const grid = Utils.el('pos-product-grid');
    grid.innerHTML = `<div class="loading-state"><div class="spinner"></div><span>Memuat produk...</span></div>`;

    const res = await API.getProducts();
    if (res.success) {
      _allProducts = res.data || [];
      State.setProducts(_allProducts);
      renderCategories();
      renderProductGrid();
    } else {
      grid.innerHTML = `<div class="loading-state"><span style="color:var(--danger)">Gagal memuat produk.<br>${res.message}</span></div>`;
    }
  }

  function renderCategories() {
    const cats = State.getCategories();
    const container = Utils.el('pos-categories');
    container.innerHTML = `<button class="category-pill active" data-cat="all">Semua</button>`;
    cats.forEach(cat => {
      const btn = document.createElement('button');
      btn.className = 'category-pill';
      btn.dataset.cat = cat;
      btn.textContent = cat;
      container.appendChild(btn);
    });
  }

  // Emoji berdasarkan kategori produk
  const CATEGORY_EMOJIS = {
    makanan: '🍱', minuman: '🥤', snack: '🍿', buah: '🍎',
    sayur: '🥦', daging: '🥩', susu: '🥛', bakery: '🍞',
    elektronik: '📱', fashion: '👔', default: '📦',
  };

  function getCategoryEmoji(category) {
    const key = (category || '').toLowerCase();
    for (const [k, v] of Object.entries(CATEGORY_EMOJIS)) {
      if (key.includes(k)) return v;
    }
    return CATEGORY_EMOJIS.default;
  }

  function renderProductGrid() {
    const grid = Utils.el('pos-product-grid');

    let products = _allProducts;

    // Filter kategori
    if (_currentCategory !== 'all') {
      products = products.filter(p => p.category === _currentCategory);
    }

    // Filter search
    if (_searchQuery) {
      products = products.filter(p =>
        p.name.toLowerCase().includes(_searchQuery) ||
        (p.barcode || '').toLowerCase().includes(_searchQuery) ||
        (p.category || '').toLowerCase().includes(_searchQuery)
      );
    }

    if (products.length === 0) {
      grid.innerHTML = `
        <div class="loading-state">
          <span style="font-size:32px">🔍</span>
          <span>Produk tidak ditemukan</span>
        </div>`;
      return;
    }

    grid.innerHTML = products.map(p => {
      const emoji = getCategoryEmoji(p.category);
      const isOut = p.stock <= 0;
      const isLow = p.stock > 0 && p.stock <= (p.minStock || 5);
      const stockClass = isOut ? 'out' : isLow ? 'low' : '';
      const stockLabel = isOut ? 'Habis' : isLow ? `Sisa ${p.stock}` : `Stok: ${p.stock}`;

      return `
        <div class="product-card ${isOut ? 'out-of-stock' : ''}"
             onclick="POS.addToCart('${p.id}')"
             data-product-id="${p.id}">
          <span class="product-card__emoji">${emoji}</span>
          <div class="product-card__name">${p.name}</div>
          <div class="product-card__price">${Utils.formatRupiah(p.price)}</div>
          <div class="product-card__stock ${stockClass}">${stockLabel}</div>
        </div>`;
    }).join('');
  }

  // ── Cart ──────────────────────────────────────

  function addToCart(productId) {
    const product = _allProducts.find(p => p.id === productId);
    if (!product) return;
    const ok = State.addToCart(product);
    if (ok) {
      renderCart();
      // Animasi feedback
      const card = document.querySelector(`[data-product-id="${productId}"]`);
      if (card) {
        card.style.transform = 'scale(0.93)';
        setTimeout(() => card.style.transform = '', 150);
      }
    }
  }

  function renderCart() {
    const container = Utils.el('cart-items');
    const items = State.getCart().items;

    if (items.length === 0) {
      container.innerHTML = `
        <div class="cart-empty">
          <i data-lucide="shopping-cart" class="cart-empty__icon"></i>
          <p>Keranjang kosong</p>
          <span>Pilih produk untuk memulai transaksi</span>
        </div>`;
      lucide.createIcons();
      updateCartTotals();
      Utils.el('checkout-btn').disabled = true;
      return;
    }

    container.innerHTML = items.map(item => `
      <div class="cart-item" data-id="${item.productId}">
        <div class="cart-item__info">
          <div class="cart-item__name">${item.name}</div>
          <div class="cart-item__price">${Utils.formatRupiah(item.price)} / pcs</div>
          <div class="cart-item__controls">
            <button class="qty-btn" onclick="POS.changeQty('${item.productId}', -1)">−</button>
            <span class="qty-num">${item.qty}</span>
            <button class="qty-btn" onclick="POS.changeQty('${item.productId}', 1)">+</button>
            <button class="remove-item-btn" onclick="POS.removeItem('${item.productId}')">
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        </div>
        <div class="cart-item__subtotal">${Utils.formatRupiah(item.subtotal)}</div>
      </div>`).join('');

    lucide.createIcons();
    updateCartTotals();
    Utils.el('checkout-btn').disabled = false;
  }

  function changeQty(productId, delta) {
    State.updateCartQty(productId, delta);
    renderCart();
  }

  function removeItem(productId) {
    State.removeFromCart(productId);
    renderCart();
  }

  function updateCartTotals() {
    const { subtotal, discountAmt, loyaltyDiscount, total } = State.getCartTotals();
    Utils.setText('cart-subtotal', Utils.formatRupiah(subtotal));
    Utils.setText('cart-total', Utils.formatRupiah(total));

    const discountRow = Utils.el('discount-row');
    if (discountAmt > 0) {
      discountRow.style.display = 'flex';
      Utils.setText('cart-discount', `- ${Utils.formatRupiah(discountAmt)}`);
    } else {
      discountRow.style.display = 'none';
    }

    const loyaltyRow = Utils.el('loyalty-row');
    if (loyaltyDiscount > 0) {
      loyaltyRow.style.display = 'flex';
      Utils.setText('cart-loyalty', `- ${Utils.formatRupiah(loyaltyDiscount)}`);
    } else {
      loyaltyRow.style.display = 'none';
    }

    // Update QRIS amount
    Utils.setText('qris-amount-label', Utils.formatRupiah(total));
    updateChangeDisplay();
  }

  // ── Payment Panels ─────────────────────────────

  function togglePaymentPanel(method) {
    Utils.el('cash-panel').style.display = method === 'cash' ? 'block' : 'none';
    const qrisPanel = Utils.el('qris-panel');
    if (method === 'qris') {
      qrisPanel.classList.remove('hidden');
    } else {
      qrisPanel.classList.add('hidden');
    }
  }

  function updateChangeDisplay() {
    const cashInput = Utils.el('cash-received');
    const cash = parseFloat(cashInput.value) || 0;
    const { total } = State.getCartTotals();
    const changeEl = Utils.el('change-display');
    const changeAmtEl = Utils.el('change-amount');

    if (cash > 0) {
      changeEl.style.display = 'flex';
      const change = cash - total;
      changeAmtEl.textContent = Utils.formatRupiah(Math.max(0, change));
      changeAmtEl.style.color = change >= 0 ? 'var(--success)' : 'var(--danger)';
    } else {
      changeEl.style.display = 'none';
    }
  }

  // ── Checkout ──────────────────────────────────

  async function handleCheckout() {
    const cart = State.getCart();
    const { total, subtotal, discountAmt, loyaltyDiscount, maxPointsUsable, pointsEarned } = State.getCartTotals();

    if (cart.items.length === 0) {
      Utils.toast('Keranjang kosong!', 'warning');
      return;
    }

    // Validasi cash
    if (cart.paymentMethod === 'cash') {
      const cash = parseFloat(Utils.el('cash-received').value) || 0;
      if (cash < total) {
        Utils.toast('Uang yang diterima kurang!', 'error');
        return;
      }
      cart.cashReceived = cash;
    }

    const session = State.getSession();
    const receiptNo = Utils.generateReceiptNo();
    const now = Utils.nowISO();

    const transaction = {
      id:            Utils.generateId('TRX-'),
      receiptNo,
      timestamp:     now,
      cashierId:     session.userId,
      cashierName:   session.name,
      storeId:       session.storeId,
      customer:      cart.customer,
      items:         cart.items.map(i => ({
                       productId: i.productId,
                       name: i.name,
                       price: i.price,
                       qty: i.qty,
                       subtotal: i.subtotal,
                     })),
      subtotal,
      discountPct:   cart.discountPct,
      discountAmt,
      loyaltyDiscount,
      pointsUsed:    maxPointsUsable,
      pointsEarned,
      total,
      paymentMethod: cart.paymentMethod,
      cashReceived:  cart.cashReceived,
      change:        Math.max(0, (cart.cashReceived || total) - total),
    };

    // Disable tombol
    const btn = Utils.el('checkout-btn');
    btn.disabled = true;
    btn.innerHTML = '<div class="spinner" style="width:20px;height:20px;border-width:2px"></div>';

    // Simpan ke GAS
    const res = await API.saveTransaction(transaction);

    if (!res.success) {
      Utils.toast('Gagal menyimpan transaksi: ' + res.message, 'error');
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="check-circle"></i><span>Proses Pembayaran</span>';
      lucide.createIcons();
      return;
    }

    // Update poin pelanggan
    if (cart.customer && cart.customer.id) {
      if (maxPointsUsable > 0) {
        await API.updateCustomerPoints(cart.customer.id, maxPointsUsable, 'subtract');
      }
      if (pointsEarned > 0) {
        await API.updateCustomerPoints(cart.customer.id, pointsEarned, 'add');
      }
    }

    // Tampilkan struk
    Receipt.show(transaction, State.getSettings());

    // Reset
    State.clearCart();
    renderCart();
    Utils.el('discount-pct').value = '';
    Utils.el('cash-received').value = '';
    Utils.el('change-display').style.display = 'none';
    Utils.el('cart-customer-name').textContent = 'Pelanggan Umum';
    document.querySelectorAll('.payment-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-method="cash"]').classList.add('active');
    togglePaymentPanel('cash');
    btn.innerHTML = '<i data-lucide="check-circle"></i><span>Proses Pembayaran</span>';
    lucide.createIcons();

    // Refresh produk (update stok)
    await loadProducts();
  }

  // Expose untuk dipanggil dari scanner
  function addToCartByBarcode(barcode) {
    const product = _allProducts.find(p => p.barcode === barcode);
    if (product) {
      addToCart(product.id);
      Utils.toast(`${product.name} ditambahkan`, 'success', 1500);
    } else {
      Utils.toast(`Barcode ${barcode} tidak ditemukan`, 'warning');
    }
  }

  return { init, addToCart, changeQty, removeItem, addToCartByBarcode, loadProducts };

})();

// ═══════════════════════════════════════════════════════
// RECEIPT MODULE
// ═══════════════════════════════════════════════════════

const Receipt = (() => {

  function show(transaction, settings = {}) {
    const content = generate(transaction, settings);
    Utils.el('receipt-content').innerHTML = content;
    Utils.showModal('modal-receipt');

    // Tombol cetak
    Utils.el('print-receipt-btn').onclick = () => print(transaction, settings);
    Utils.el('share-receipt-btn').onclick = () => share(transaction);
    Utils.el('done-receipt-btn').onclick = () => {
      Utils.hideModal('modal-receipt');
    };
  }

  function generate(t, settings) {
    const storeName = settings.storeName || 'KASIEKU';
    const storeAddress = settings.storeAddress || '';
    const storePhone = settings.storePhone || '';
    const footer = settings.receiptFooter || 'Terima kasih telah berbelanja!';
    const sep = '─'.repeat(32);

    let html = `
      <div class="receipt-store-name">${storeName}</div>
      ${storeAddress ? `<div class="receipt-center" style="font-size:11px;color:var(--text-muted)">${storeAddress}</div>` : ''}
      ${storePhone ? `<div class="receipt-center" style="font-size:11px;color:var(--text-muted)">📞 ${storePhone}</div>` : ''}
      <div class="receipt-divider"></div>
      <div class="receipt-row">
        <span>No. Nota</span>
        <span style="font-weight:600">${t.receiptNo}</span>
      </div>
      <div class="receipt-row">
        <span>Tanggal</span>
        <span>${Utils.formatDateTime(t.timestamp)}</span>
      </div>
      <div class="receipt-row">
        <span>Kasir</span>
        <span>${t.cashierName}</span>
      </div>
      ${t.customer ? `<div class="receipt-row"><span>Pelanggan</span><span>${t.customer.name}</span></div>` : ''}
      <div class="receipt-divider"></div>`;

    // Items
    t.items.forEach(item => {
      html += `
        <div class="receipt-row">
          <span>${item.name}</span>
          <span>${Utils.formatRupiah(item.subtotal)}</span>
        </div>
        <div style="font-size:11px;color:var(--text-muted);margin-left:4px;margin-bottom:4px">
          ${item.qty} × ${Utils.formatRupiah(item.price)}
        </div>`;
    });

    html += `<div class="receipt-divider"></div>`;

    html += `
      <div class="receipt-row">
        <span>Subtotal</span>
        <span>${Utils.formatRupiah(t.subtotal)}</span>
      </div>`;

    if (t.discountAmt > 0) {
      html += `
        <div class="receipt-row" style="color:var(--success)">
          <span>Diskon (${t.discountPct}%)</span>
          <span>- ${Utils.formatRupiah(t.discountAmt)}</span>
        </div>`;
    }

    if (t.loyaltyDiscount > 0) {
      html += `
        <div class="receipt-row" style="color:var(--warning)">
          <span>Poin Loyalitas</span>
          <span>- ${Utils.formatRupiah(t.loyaltyDiscount)}</span>
        </div>`;
    }

    html += `
      <div class="receipt-divider"></div>
      <div class="receipt-total-row">
        <span>TOTAL</span>
        <span>${Utils.formatRupiah(t.total)}</span>
      </div>
      <div class="receipt-row">
        <span>Metode Bayar</span>
        <span>${t.paymentMethod.toUpperCase()}</span>
      </div>`;

    if (t.paymentMethod === 'cash') {
      html += `
        <div class="receipt-row">
          <span>Uang Diterima</span>
          <span>${Utils.formatRupiah(t.cashReceived)}</span>
        </div>
        <div class="receipt-row" style="color:var(--success)">
          <span>Kembalian</span>
          <span>${Utils.formatRupiah(t.change)}</span>
        </div>`;
    }

    if (t.pointsEarned > 0) {
      html += `
        <div class="receipt-divider"></div>
        <div class="receipt-row" style="color:var(--warning)">
          <span>⭐ Poin Diperoleh</span>
          <span>+${t.pointsEarned} poin</span>
        </div>`;
    }

    html += `
      <div class="receipt-divider"></div>
      <div class="receipt-center" style="color:var(--text-muted);font-size:11px">${footer}</div>
      <div class="receipt-center" style="color:var(--text-disabled);font-size:10px;margin-top:4px">
        Powered by KASIEKU v${CONFIG.APP_VERSION}
      </div>`;

    return html;
  }

  function print(transaction, settings) {
    const printArea = Utils.el('print-area');
    const storeName = settings.storeName || 'KASIEKU';
    const footer = settings.receiptFooter || 'Terima kasih telah berbelanja!';

    let text = `
${storeName}
${settings.storeAddress || ''}
${settings.storePhone ? '📞 ' + settings.storePhone : ''}
================================
No.: ${transaction.receiptNo}
${Utils.formatDateTime(transaction.timestamp)}
Kasir: ${transaction.cashierName}
${transaction.customer ? 'Pelanggan: ' + transaction.customer.name : ''}
--------------------------------
ITEM:
`;

    transaction.items.forEach(item => {
      text += `${item.name}\n  ${item.qty} x ${Utils.formatRupiah(item.price)} = ${Utils.formatRupiah(item.subtotal)}\n`;
    });

    text += `
--------------------------------
Subtotal : ${Utils.formatRupiah(transaction.subtotal)}
${transaction.discountAmt > 0 ? `Diskon   : -${Utils.formatRupiah(transaction.discountAmt)}` : ''}
${transaction.loyaltyDiscount > 0 ? `Poin     : -${Utils.formatRupiah(transaction.loyaltyDiscount)}` : ''}
TOTAL    : ${Utils.formatRupiah(transaction.total)}
Bayar    : ${transaction.paymentMethod.toUpperCase()}
${transaction.paymentMethod === 'cash' ? `Tunai    : ${Utils.formatRupiah(transaction.cashReceived)}\nKembali  : ${Utils.formatRupiah(transaction.change)}` : ''}
================================
${footer}
================================`;

    printArea.textContent = text;
    window.print();
  }

  function share(transaction) {
    const text = `Struk Belanja\nNo: ${transaction.receiptNo}\nTotal: ${Utils.formatRupiah(transaction.total)}\nTerima kasih!`;
    if (navigator.share) {
      navigator.share({ title: 'Struk KASIEKU', text });
    } else {
      navigator.clipboard.writeText(text);
      Utils.toast('Struk disalin ke clipboard', 'info');
    }
  }

  return { show };

})();

// ═══════════════════════════════════════════════════════
// CUSTOMER SELECTOR (in POS)
// ═══════════════════════════════════════════════════════

const CustomerSelector = (() => {

  async function open() {
    Utils.showModal('modal-select-customer');
    await loadList();

    Utils.el('customer-search-pos').addEventListener('input', Utils.debounce(filter, 250));
    Utils.el('use-general-customer').onclick = () => {
      State.setCartCustomer(null);
      Utils.setText('cart-customer-name', 'Pelanggan Umum');
      Utils.hideModal('modal-select-customer');
      POS.addToCartByBarcode && null; // dummy ref
    };
  }

  async function loadList() {
    const list = Utils.el('customer-list-pos');
    list.innerHTML = '<div style="text-align:center;padding:20px"><div class="spinner"></div></div>';
    const res = await API.getCustomers();
    if (res.success) {
      State.setCustomers(res.data || []);
      renderList(res.data || []);
    }
  }

  function renderList(customers) {
    const list = Utils.el('customer-list-pos');
    if (customers.length === 0) {
      list.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:20px;font-size:13px">Tidak ada pelanggan</p>';
      return;
    }
    list.innerHTML = customers.map(c => `
      <div class="customer-option" onclick="CustomerSelector.select('${c.id}')">
        <div class="customer-option__avatar">${Utils.initials(c.name)}</div>
        <div>
          <div class="customer-option__name">${c.name}</div>
          <div class="customer-option__phone">${c.phone}</div>
        </div>
        <div class="customer-option__points">⭐ ${c.points || 0} poin</div>
      </div>`).join('');
  }

  function filter(e) {
    const q = e.target.value.toLowerCase();
    const filtered = State.getCustomers().filter(c =>
      c.name.toLowerCase().includes(q) || c.phone.includes(q)
    );
    renderList(filtered);
  }

  function select(customerId) {
    const customer = State.getCustomers().find(c => c.id === customerId);
    if (!customer) return;
    State.setCartCustomer(customer);
    Utils.setText('cart-customer-name', customer.name);
    Utils.hideModal('modal-select-customer');
    Utils.toast(`Pelanggan: ${customer.name} (${customer.points || 0} poin)`, 'info');
    // Recalculate totals
    State.getCart().discountPct = State.getCart().discountPct;
    // Trigger re-render via POS (akses global)
    if (typeof POS !== 'undefined') {
      // Refresh totals
      document.querySelector('#discount-pct').dispatchEvent(new Event('input'));
    }
  }

  return { open, select };

})();
