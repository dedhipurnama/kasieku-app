/**
 * KASIEKU — STATE MANAGEMENT
 * Centralized state: session, cart, data cache
 */

const State = (() => {

  // ── Session ──────────────────────────────────
  const SESSION_KEY = 'kasieku_session';

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      // Cek expiry
      if (Date.now() > session.expiresAt) {
        clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  }

  function setSession(sessionData) {
    const session = {
      ...sessionData,
      expiresAt: Date.now() + CONFIG.SESSION_DURATION,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    _state.session = session;
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    _state.session = null;
  }

  function isLoggedIn() {
    return getSession() !== null;
  }

  function isAdmin() {
    const s = getSession();
    return s?.role === 'admin';
  }

  function isManagerOrAdmin() {
    const s = getSession();
    return ['admin','manager'].includes(s?.role);
  }

  // ── Internal State ────────────────────────────
  const _state = {
    session: getSession(),

    // Data cache
    products: [],
    customers: [],
    users: [],
    settings: {},
    categories: [],

    // Cart
    cart: {
      items: [],        // { productId, name, price, qty, subtotal }
      customer: null,   // { id, name, phone, points }
      discountPct: 0,
      paymentMethod: 'cash',
      cashReceived: 0,
      notes: '',
    },

    // UI state
    currentPage: 'pos',
  };

  // ── Cart ─────────────────────────────────────

  function getCart() { return _state.cart; }

  function addToCart(product) {
    const existing = _state.cart.items.find(i => i.productId === product.id);
    if (existing) {
      if (existing.qty >= product.stock) {
        Utils.toast('Stok tidak mencukupi', 'warning');
        return false;
      }
      existing.qty++;
      existing.subtotal = existing.qty * existing.price;
    } else {
      if (product.stock <= 0) {
        Utils.toast('Stok habis', 'error');
        return false;
      }
      _state.cart.items.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        qty: 1,
        subtotal: product.price,
        stock: product.stock,
      });
    }
    return true;
  }

  function updateCartQty(productId, delta) {
    const item = _state.cart.items.find(i => i.productId === productId);
    if (!item) return;
    item.qty = Math.max(0, item.qty + delta);
    if (item.qty === 0) {
      removeFromCart(productId);
      return;
    }
    if (item.qty > item.stock) {
      item.qty = item.stock;
      Utils.toast('Sudah mencapai batas stok', 'warning');
    }
    item.subtotal = item.qty * item.price;
  }

  function removeFromCart(productId) {
    _state.cart.items = _state.cart.items.filter(i => i.productId !== productId);
  }

  function clearCart() {
    _state.cart = {
      items: [],
      customer: null,
      discountPct: 0,
      paymentMethod: 'cash',
      cashReceived: 0,
      notes: '',
    };
  }

  function getCartTotals() {
    const subtotal = _state.cart.items.reduce((s, i) => s + i.subtotal, 0);
    const discountAmt = Math.round(subtotal * (_state.cart.discountPct / 100));
    const afterDiscount = subtotal - discountAmt;

    // Hitung max poin yang bisa digunakan
    const customer = _state.cart.customer;
    const settings = _state.settings;
    const pointValue = settings.pointValue || CONFIG.LOYALTY_POINT_VALUE;
    const maxPointsUsable = customer ? Math.min(customer.points, Math.floor(afterDiscount / pointValue)) : 0;
    const loyaltyDiscount = maxPointsUsable * pointValue;

    const total = afterDiscount - loyaltyDiscount;
    const pointsEarned = Math.floor((total / 1000) * (settings.loyaltyRate || CONFIG.LOYALTY_POINTS_PER_1K));

    return { subtotal, discountAmt, afterDiscount, loyaltyDiscount, maxPointsUsable, total, pointsEarned };
  }

  // ── Products cache ────────────────────────────

  function setProducts(products) {
    _state.products = products;
    // Extract categories
    const cats = [...new Set(products.map(p => p.category).filter(Boolean))];
    _state.categories = cats;
  }

  function getProducts() { return _state.products; }
  function getCategories() { return _state.categories; }

  function updateProductStock(productId, newStock) {
    const product = _state.products.find(p => p.id === productId);
    if (product) product.stock = newStock;
  }

  // ── Customers cache ───────────────────────────

  function setCustomers(customers) { _state.customers = customers; }
  function getCustomers() { return _state.customers; }
  function setCartCustomer(customer) { _state.cart.customer = customer; }

  // ── Settings cache ────────────────────────────

  function setSettings(settings) { _state.settings = settings; }
  function getSettings() { return _state.settings; }

  // ── Users cache ───────────────────────────────

  function setUsers(users) { _state.users = users; }
  function getUsers() { return _state.users; }

  // ── Page state ────────────────────────────────

  function setCurrentPage(page) { _state.currentPage = page; }
  function getCurrentPage() { return _state.currentPage; }

  return {
    // Session
    getSession, setSession, clearSession, isLoggedIn, isAdmin, isManagerOrAdmin,
    // Cart
    getCart, addToCart, updateCartQty, removeFromCart, clearCart, getCartTotals,
    // Products
    setProducts, getProducts, getCategories, updateProductStock,
    // Customers
    setCustomers, getCustomers, setCartCustomer,
    // Settings
    setSettings, getSettings,
    // Users
    setUsers, getUsers,
    // UI
    setCurrentPage, getCurrentPage,
  };

})();
