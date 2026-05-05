/**
 * KASIEKU — UTILITIES
 * Format currency, toast, date helpers, dll.
 */

const Utils = (() => {

  // ── Currency ─────────────────────────────────

  function formatRupiah(amount) {
    if (isNaN(amount) || amount === null) return 'Rp 0';
    return new Intl.NumberFormat(CONFIG.LOCALE, {
      style: 'currency',
      currency: CONFIG.CURRENCY,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  function parseRupiah(str) {
    return parseInt(String(str).replace(/[^0-9]/g, ''), 10) || 0;
  }

  // ── Date / Time ──────────────────────────────

  function formatDate(dateStr, opts = {}) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleDateString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric', ...opts
    });
  }

  function formatDateTime(dateStr) {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    if (isNaN(d)) return dateStr;
    return d.toLocaleString('id-ID', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  }

  function formatTime(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  function todayISO() {
    return new Date().toISOString().split('T')[0];
  }

  function nowISO() {
    return new Date().toISOString();
  }

  // ── ID Generation ─────────────────────────────

  function generateId(prefix = '') {
    const ts = Date.now().toString(36).toUpperCase();
    const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}${ts}${rnd}`;
  }

  function generateBarcode() {
    return Math.floor(100000000000 + Math.random() * 900000000000).toString();
  }

  function generateReceiptNo() {
    const now = new Date();
    const ymd = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
    const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
    return `INV-${ymd}-${rand}`;
  }

  // ── Toast Notifications ───────────────────────

  const TOAST_ICONS = {
    success: '✅',
    error:   '❌',
    warning: '⚠️',
    info:    'ℹ️',
  };

  function toast(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const el = document.createElement('div');
    el.className = `toast toast--${type}`;
    el.innerHTML = `
      <span class="toast__icon">${TOAST_ICONS[type] || 'ℹ️'}</span>
      <span class="toast__text">${message}</span>
      <button class="toast__close" onclick="this.parentElement.remove()">×</button>
    `;
    container.appendChild(el);

    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 250);
    }, duration);
  }

  // ── DOM Helpers ───────────────────────────────

  function el(id) { return document.getElementById(id); }

  function show(id) {
    const e = el(id);
    if (e) e.classList.remove('hidden');
  }

  function hide(id) {
    const e = el(id);
    if (e) e.classList.add('hidden');
  }

  function setText(id, text) {
    const e = el(id);
    if (e) e.textContent = text;
  }

  function setHtml(id, html) {
    const e = el(id);
    if (e) e.innerHTML = html;
  }

  function showModal(id) {
    const e = el(id);
    if (e) e.classList.remove('hidden');
  }

  function hideModal(id) {
    const e = el(id);
    if (e) e.classList.add('hidden');
  }

  // ── String ───────────────────────────────────

  function initials(name = '') {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }

  function slugify(str) {
    return str.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  }

  function highlight(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
  }

  // ── Debounce ─────────────────────────────────

  function debounce(fn, delay = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  // ── Stock Badge ──────────────────────────────

  function stockBadge(stock, minStock = 5) {
    if (stock <= 0)          return '<span class="badge badge--danger">Habis</span>';
    if (stock <= minStock)   return `<span class="badge badge--warning">Sedikit (${stock})</span>`;
    return `<span class="badge badge--success">${stock}</span>`;
  }

  // ── Role Badge ───────────────────────────────

  function roleBadge(role) {
    const map = {
      admin:   'badge--purple',
      manager: 'badge--info',
      kasir:   'badge--neutral',
    };
    return `<span class="badge ${map[role] || 'badge--neutral'}">${role}</span>`;
  }

  // ── Loyalty Level ─────────────────────────────

  function loyaltyLevel(points, settings = {}) {
    const gold   = settings.goldThreshold   || 2000;
    const silver = settings.silverThreshold || 500;
    if (points >= gold)   return { label: 'Gold 🥇',   class: 'badge--warning' };
    if (points >= silver) return { label: 'Silver 🥈', class: 'badge--info' };
    return { label: 'Bronze 🥉', class: 'badge--neutral' };
  }

  // ── Confirm Dialog ─────────────────────────────
  function confirm(message) {
    return window.confirm(message);
  }

  return {
    formatRupiah, parseRupiah,
    formatDate, formatDateTime, formatTime, todayISO, nowISO,
    generateId, generateBarcode, generateReceiptNo,
    toast,
    el, show, hide, setText, setHtml, showModal, hideModal,
    initials, slugify, highlight, debounce,
    stockBadge, roleBadge, loyaltyLevel,
    confirm,
  };

})();
