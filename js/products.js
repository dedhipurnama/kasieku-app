/**
 * KASIEKU — PRODUCTS MODULE
 * Manajemen produk & inventori
 */

const Products = (() => {

  let _products = [];
  let _filteredProducts = [];

  async function init() {
    await loadProducts();
    bindEvents();
  }

  async function loadProducts() {
    Utils.el('products-tbody').innerHTML = `<tr><td colspan="9" class="loading-cell"><div class="spinner"></div></td></tr>`;
    const res = await API.getProducts();
    if (res.success) {
      _products = res.data || [];
      State.setProducts(_products);
      renderTable(_products);
      renderStats(_products);
      populateCategoryFilter(_products);
    } else {
      Utils.el('products-tbody').innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--danger);padding:32px">${res.message}</td></tr>`;
    }
  }

  function bindEvents() {
    // Search
    Utils.el('product-search').addEventListener('input', Utils.debounce(applyFilters, 250));

    // Category filter
    Utils.el('product-cat-filter').addEventListener('change', applyFilters);

    // Stock filter
    Utils.el('product-stock-filter').addEventListener('change', applyFilters);

    // Add button
    Utils.el('add-product-btn').addEventListener('click', () => openForm());

    // Save product
    Utils.el('save-product-btn').addEventListener('click', handleSave);

    // Generate barcode
    Utils.el('gen-barcode-btn').addEventListener('click', () => {
      Utils.el('pf-barcode').value = Utils.generateBarcode();
    });

    // Export
    Utils.el('export-products-btn').addEventListener('click', exportCSV);

    // Modal close
    document.querySelectorAll('[data-modal="modal-product"]').forEach(btn => {
      btn.addEventListener('click', () => Utils.hideModal('modal-product'));
    });
  }

  function applyFilters() {
    const q    = Utils.el('product-search').value.toLowerCase();
    const cat  = Utils.el('product-cat-filter').value;
    const stock= Utils.el('product-stock-filter').value;

    _filteredProducts = _products.filter(p => {
      const matchQ   = !q || p.name.toLowerCase().includes(q) || (p.barcode||'').includes(q);
      const matchCat = !cat || p.category === cat;
      const matchStk = !stock
        || (stock === 'low' && p.stock > 0 && p.stock <= (p.minStock || 5))
        || (stock === 'out' && p.stock <= 0);
      return matchQ && matchCat && matchStk;
    });
    renderTable(_filteredProducts);
  }

  function renderTable(products) {
    const tbody = Utils.el('products-tbody');
    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:32px">Tidak ada produk</td></tr>`;
      return;
    }

    tbody.innerHTML = products.map(p => {
      const margin = p.cost > 0 ? Math.round(((p.price - p.cost) / p.price) * 100) : null;
      const canEdit = State.isManagerOrAdmin();
      const canDelete = State.isAdmin();

      return `<tr>
        <td><span style="font-size:24px">${getCategoryEmoji(p.category)}</span></td>
        <td>
          <div style="font-weight:600;color:var(--text-primary)">${p.name}</div>
          ${p.description ? `<div style="font-size:11px;color:var(--text-muted)">${p.description}</div>` : ''}
          ${margin !== null ? `<div style="font-size:11px;color:var(--success)">Margin: ${margin}%</div>` : ''}
        </td>
        <td style="font-family:monospace;font-size:12px">${p.barcode || '—'}</td>
        <td>${p.category ? `<span class="badge badge--info">${p.category}</span>` : '—'}</td>
        <td style="font-weight:600;color:var(--accent-2)">${Utils.formatRupiah(p.price)}</td>
        <td style="color:var(--text-muted)">${p.cost ? Utils.formatRupiah(p.cost) : '—'}</td>
        <td>${Utils.stockBadge(p.stock, p.minStock)}</td>
        <td>${p.stock <= 0 ? '<span class="badge badge--danger">Habis</span>' : '<span class="badge badge--success">Aktif</span>'}</td>
        <td>
          <div class="action-btns">
            ${canEdit ? `<button class="btn btn--ghost btn--sm" onclick="Products.edit('${p.id}')"><i data-lucide="pencil"></i></button>` : ''}
            <button class="btn btn--ghost btn--sm" onclick="Products.adjustStock('${p.id}')">
              <i data-lucide="package-plus"></i>
            </button>
            ${canDelete ? `<button class="btn btn--danger btn--sm" onclick="Products.delete('${p.id}')"><i data-lucide="trash-2"></i></button>` : ''}
          </div>
        </td>
      </tr>`;
    }).join('');
    lucide.createIcons();
  }

  function getCategoryEmoji(category) {
    const map = { makanan:'🍱',minuman:'🥤',snack:'🍿',buah:'🍎',sayur:'🥦',daging:'🥩',susu:'🥛',bakery:'🍞',elektronik:'📱',fashion:'👔' };
    const key = (category||'').toLowerCase();
    for (const [k,v] of Object.entries(map)) { if (key.includes(k)) return v; }
    return '📦';
  }

  function renderStats(products) {
    const total = products.length;
    const low   = products.filter(p => p.stock > 0 && p.stock <= (p.minStock || 5)).length;
    const out   = products.filter(p => p.stock <= 0).length;
    const value = products.reduce((s,p) => s + (p.cost||p.price) * p.stock, 0);

    Utils.setText('stat-total-products', total);
    Utils.setText('stat-low-stock', low);
    Utils.setText('stat-out-stock', out);
    Utils.setText('stat-inventory-value', Utils.formatRupiah(value));
  }

  function populateCategoryFilter(products) {
    const cats = [...new Set(products.map(p=>p.category).filter(Boolean))];
    const sel = Utils.el('product-cat-filter');
    sel.innerHTML = '<option value="">Semua Kategori</option>' +
      cats.map(c => `<option value="${c}">${c}</option>`).join('');

    // Datalist untuk form
    const dl = Utils.el('category-list');
    if (dl) dl.innerHTML = cats.map(c => `<option value="${c}">`).join('');
  }

  function openForm(product = null) {
    // Reset form
    Utils.el('product-form').reset();
    Utils.el('pf-id').value = '';
    Utils.el('product-modal-title').textContent = product ? 'Edit Produk' : 'Tambah Produk';

    if (product) {
      Utils.el('pf-id').value = product.id;
      Utils.el('pf-name').value = product.name || '';
      Utils.el('pf-barcode').value = product.barcode || '';
      Utils.el('pf-category').value = product.category || '';
      Utils.el('pf-unit').value = product.unit || '';
      Utils.el('pf-cost').value = product.cost || '';
      Utils.el('pf-price').value = product.price || '';
      Utils.el('pf-stock').value = product.stock || 0;
      Utils.el('pf-min-stock').value = product.minStock || 5;
      Utils.el('pf-desc').value = product.description || '';
    }

    // Populate datalist
    const cats = State.getCategories();
    Utils.el('category-list').innerHTML = cats.map(c => `<option value="${c}">`).join('');

    Utils.showModal('modal-product');
  }

  async function handleSave() {
    const id       = Utils.el('pf-id').value;
    const name     = Utils.el('pf-name').value.trim();
    const price    = parseFloat(Utils.el('pf-price').value) || 0;

    if (!name || price <= 0) {
      Utils.toast('Nama produk dan harga wajib diisi', 'warning');
      return;
    }

    const session = State.getSession();
    const product = {
      id:          id || Utils.generateId('PRD-'),
      name,
      barcode:     Utils.el('pf-barcode').value.trim() || Utils.generateBarcode(),
      category:    Utils.el('pf-category').value.trim(),
      unit:        Utils.el('pf-unit').value.trim() || 'pcs',
      cost:        parseFloat(Utils.el('pf-cost').value) || 0,
      price,
      stock:       parseInt(Utils.el('pf-stock').value) || 0,
      minStock:    parseInt(Utils.el('pf-min-stock').value) || 5,
      description: Utils.el('pf-desc').value.trim(),
      storeId:     session.storeId,
      updatedAt:   Utils.nowISO(),
      createdAt:   id ? undefined : Utils.nowISO(),
    };

    const btn = Utils.el('save-product-btn');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    const res = await API.saveProduct(product);
    btn.disabled = false;
    btn.innerHTML = '<i data-lucide="save"></i> Simpan';
    lucide.createIcons();

    if (res.success) {
      Utils.toast(id ? 'Produk berhasil diperbarui' : 'Produk berhasil ditambahkan', 'success');
      Utils.hideModal('modal-product');
      await loadProducts();
    } else {
      Utils.toast('Gagal menyimpan: ' + res.message, 'error');
    }
  }

  async function deleteProduct(productId) {
    if (!Utils.confirm('Yakin hapus produk ini? Tindakan tidak bisa dibatalkan.')) return;
    const res = await API.deleteProduct(productId);
    if (res.success) {
      Utils.toast('Produk dihapus', 'success');
      await loadProducts();
    } else {
      Utils.toast('Gagal menghapus: ' + res.message, 'error');
    }
  }

  function adjustStock(productId) {
    const product = _products.find(p => p.id === productId);
    if (!product) return;
    const qty = prompt(`Sesuaikan stok untuk "${product.name}" (stok sekarang: ${product.stock})\nMasukkan jumlah penambahan (+ angka) atau pengurangan (- angka):`);
    if (qty === null) return;
    const delta = parseInt(qty);
    if (isNaN(delta)) { Utils.toast('Jumlah tidak valid', 'warning'); return; }
    const newStock = Math.max(0, product.stock + delta);
    API.updateStock(productId, Math.abs(delta), delta >= 0 ? 'add' : 'subtract').then(res => {
      if (res.success) {
        Utils.toast(`Stok berhasil diperbarui → ${newStock}`, 'success');
        loadProducts();
      } else {
        Utils.toast('Gagal update stok: ' + res.message, 'error');
      }
    });
  }

  function exportCSV() {
    const data = _filteredProducts.length ? _filteredProducts : _products;
    const headers = ['Nama','Barcode','Kategori','Satuan','Harga Beli','Harga Jual','Stok','Stok Min','Deskripsi'];
    const rows = data.map(p => [p.name,p.barcode,p.category,p.unit,p.cost,p.price,p.stock,p.minStock,p.description].map(v=>`"${v||''}"`).join(','));
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `produk_${Utils.todayISO()}.csv`;
    a.click(); URL.revokeObjectURL(url);
    Utils.toast('Export berhasil', 'success');
  }

  return {
    init, loadProducts,
    edit: (id) => openForm(_products.find(p => p.id === id)),
    delete: deleteProduct,
    adjustStock,
  };

})();
