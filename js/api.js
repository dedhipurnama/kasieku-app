/**
 * KASIEKU — API MODULE
 * Semua komunikasi ke Google Apps Script (backend)
 * Menggunakan fetch() dengan retry & timeout
 */

const API = (() => {

  /**
   * Core fetcher: POST ke GAS endpoint
   * @param {string} action  - Nama aksi yang dihandle GAS
   * @param {object} payload - Data yang dikirim
   * @returns {Promise<object>} - { success, data, message }
   */
  async function call(action, payload = {}) {
    const session = State.getSession();
    const body = {
      action,
      ...payload,
      // Sertakan token sesi untuk autentikasi setiap request
      sessionToken: session?.token || null,
      storeId: session?.storeId || null,
    };

    try {
      const response = await fetchWithTimeout(CONFIG.GAS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' }, // GAS butuh text/plain untuk CORS
        body: JSON.stringify(body),
      }, 30000); // 30 detik timeout

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data;

    } catch (err) {
      console.error(`[API] action=${action}`, err);
      return {
        success: false,
        message: err.message || 'Gagal terhubung ke server. Periksa koneksi internet Anda.',
        data: null
      };
    }
  }

  /** Fetch dengan timeout */
  function fetchWithTimeout(url, options, ms) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), ms);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(() => clearTimeout(id));
  }

  // ═══════════════════════════════════════════
  // AUTH
  // ═══════════════════════════════════════════

  /** Login: kirim username + password, dapat session token */
  async function login(username, password) {
    return call('login', { username, password });
  }

  /** Register akun baru */
  async function register(userData) {
    return call('register', userData);
  }

  /** Logout: invalidasi token di server */
  async function logout() {
    return call('logout');
  }

  /** Validasi session token yang tersimpan */
  async function validateSession() {
    return call('validateSession');
  }

  // ═══════════════════════════════════════════
  // PRODUCTS
  // ═══════════════════════════════════════════

  async function getProducts(filters = {}) {
    return call('getProducts', { filters });
  }

  async function saveProduct(product) {
    return call('saveProduct', { product });
  }

  async function deleteProduct(productId) {
    return call('deleteProduct', { productId });
  }

  async function getProductByBarcode(barcode) {
    return call('getProductByBarcode', { barcode });
  }

  async function updateStock(productId, qty, type = 'subtract') {
    return call('updateStock', { productId, qty, type });
  }

  // ═══════════════════════════════════════════
  // TRANSACTIONS
  // ═══════════════════════════════════════════

  async function saveTransaction(transaction) {
    return call('saveTransaction', { transaction });
  }

  async function getTransactions(filters = {}) {
    return call('getTransactions', { filters });
  }

  async function getTransactionDetail(transactionId) {
    return call('getTransactionDetail', { transactionId });
  }

  // ═══════════════════════════════════════════
  // REPORTS
  // ═══════════════════════════════════════════

  async function getReport(period, dateRange = {}) {
    return call('getReport', { period, dateRange });
  }

  async function getDailySales(date) {
    return call('getDailySales', { date });
  }

  // ═══════════════════════════════════════════
  // CUSTOMERS
  // ═══════════════════════════════════════════

  async function getCustomers(search = '') {
    return call('getCustomers', { search });
  }

  async function saveCustomer(customer) {
    return call('saveCustomer', { customer });
  }

  async function deleteCustomer(customerId) {
    return call('deleteCustomer', { customerId });
  }

  async function updateCustomerPoints(customerId, points, type = 'add') {
    return call('updateCustomerPoints', { customerId, points, type });
  }

  // ═══════════════════════════════════════════
  // USERS (Admin only)
  // ═══════════════════════════════════════════

  async function getUsers() {
    return call('getUsers');
  }

  async function saveUser(user) {
    return call('saveUser', { user });
  }

  async function deleteUser(userId) {
    return call('deleteUser', { userId });
  }

  async function resetUserPassword(userId, newPassword) {
    return call('resetUserPassword', { userId, newPassword });
  }

  // ═══════════════════════════════════════════
  // SETTINGS
  // ═══════════════════════════════════════════

  async function getSettings() {
    return call('getSettings');
  }

  async function saveSettings(settings) {
    return call('saveSettings', { settings });
  }

  // Ekspor public API
  return {
    login, register, logout, validateSession,
    getProducts, saveProduct, deleteProduct, getProductByBarcode, updateStock,
    saveTransaction, getTransactions, getTransactionDetail,
    getReport, getDailySales,
    getCustomers, saveCustomer, deleteCustomer, updateCustomerPoints,
    getUsers, saveUser, deleteUser, resetUserPassword,
    getSettings, saveSettings,
  };

})();
