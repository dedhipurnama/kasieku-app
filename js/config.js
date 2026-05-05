/**
 * KASIEKU — CONFIG
 * Isi GAS_URL dengan URL deployment Google Apps Script Anda
 */

const CONFIG = {
  // ⬇️ GANTI dengan URL Web App Google Apps Script Anda setelah deploy
  GAS_URL: 'https://script.google.com/macros/s/AKfycbzdmHqy6ti9i3rpmk2GgfqiJKx8dSlnCiT4gtByRpklI39dNId4goedyzwTayb8CLRnqw/exec',

  // Nama aplikasi
  APP_NAME: 'KASIEKU',
  APP_VERSION: '1.0.0',

  // Pengaturan sesi (dalam ms): 8 jam
  SESSION_DURATION: 8 * 60 * 60 * 1000,

  // Batas stok rendah (default)
  LOW_STOCK_THRESHOLD: 5,

  // Format currency
  CURRENCY: 'IDR',
  LOCALE: 'id-ID',

  // Poin loyalitas default
  LOYALTY_POINTS_PER_1K: 1,   // poin per Rp 1.000
  LOYALTY_POINT_VALUE: 10,     // nilai 1 poin = Rp 10

  // Warna chart
  CHART_COLORS: [
    '#7c3aed', '#06b6d4', '#10b981', '#f59e0b',
    '#ef4444', '#a855f7', '#3b82f6', '#ec4899'
  ]
};

// Freeze agar tidak bisa dimodifikasi dari luar
Object.freeze(CONFIG);
