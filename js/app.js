/* =============================================
   app.js  —  Wholesale IMS (PHP + MySQL version)
   All CRUD operations hit the PHP API endpoints
   ============================================= */

/* ---- Helpers ---- */

function fmt(n) {
  return '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusBadge(s) {
  const map = {
    'In Stock':    'badge-green',
    'Low Stock':   'badge-amber',
    'Out of Stock':'badge-red',
    'Delivered':   'badge-green',
    'Shipped':     'badge-blue',
    'Processing':  'badge-amber',
    'Pending':     'badge-amber',
    'Active':      'badge-green',
    'Inactive':    'badge-red',
  };
  return `<span class="badge ${map[s] || 'badge-amber'}">${s}</span>`;
}

function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

/* Generic fetch wrappers */
async function apiFetch(url, options = {}) {
  const defaults = { headers: { 'Content-Type': 'application/json' } };
  const res = await fetch(url, { ...defaults, ...options });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
const apiGet    = url              => apiFetch(url);
const apiPost   = (url, body)      => apiFetch(url, { method: 'POST',   body: JSON.stringify(body) });
const apiPut    = (url, body)      => apiFetch(url, { method: 'PUT',    body: JSON.stringify(body) });
const apiDelete = url              => apiFetch(url, { method: 'DELETE' });

/* ---- Supplier cache (used for product form dropdown) ---- */
let supplierCache = [];

/* ---- Tab Navigation ---- */

document.querySelectorAll('.nav-link').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const tab = link.dataset.tab;
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    document.querySelectorAll('.tab-section').forEach(s => s.classList.remove('active'));
    link.classList.add('active');
    document.getElementById(tab).classList.add('active');
    if (tab === 'dashboard') updateDashboard();
    if (tab === 'products')  loadProducts();
    if (tab === 'orders')    loadOrders();
    if (tab === 'suppliers') loadSuppliers();
  });
});

/* ---- Modal Helpers ---- */

function openModal(id) {
  document.getElementById(id).classList.add('open');
  if (id === 'order-modal') populateOrderProductSelect();
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
}
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape')
    document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
});

/* ============================================
   DASHBOARD
   ============================================ */

async function updateDashboard() {
  try {
    const d = await apiGet(API.dashboard);

    document.getElementById('m-products').textContent = d.total_products;
    document.getElementById('m-orders').textContent   = d.total_orders;
    document.getElementById('m-lowstock').textContent = d.low_stock_count;
    document.getElementById('m-value').textContent    = fmt(d.inventory_value || 0);

    const recentTbody = document.getElementById('recent-orders-table');
    recentTbody.innerHTML = d.recent_orders.length
      ? d.recent_orders.map(o => `
          <tr>
            <td>${o.order_code}</td>
            <td>${o.customer}</td>
            <td>${statusBadge(o.status)}</td>
            <td>${fmt(o.total)}</td>
          </tr>`).join('')
      : '<tr class="empty-row"><td colspan="4">No orders yet</td></tr>';

    const lowTbody = document.getElementById('low-stock-table');
    lowTbody.innerHTML = d.low_stock_items.length
      ? d.low_stock_items.map(p => `
          <tr>
            <td>${p.name}</td>
            <td>${p.category}</td>
            <td>${statusBadge(p.status)}</td>
          </tr>`).join('')
      : '<tr class="empty-row"><td colspan="3">All items well stocked ✓</td></tr>';

  } catch (err) {
    console.error('Dashboard error:', err);
  }
}

/* ============================================
   PRODUCTS — CRUD
   ============================================ */

async function loadProducts() {
  try {
    const products = await apiGet(API.products);
    renderProductsTable(products);
  } catch (err) {
    document.getElementById('products-table').innerHTML =
      `<tr class="empty-row"><td colspan="8">Failed to load products: ${err.message}</td></tr>`;
  }
}

function renderProductsTable(products) {
  const q   = (document.getElementById('product-search').value || '').toLowerCase();
  const cat = document.getElementById('cat-filter').value;

  const filtered = products.filter(p =>
    (!q   || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q)) &&
    (!cat || p.category === cat)
  );

  document.getElementById('products-table').innerHTML = filtered.length
    ? filtered.map(p => `
        <tr>
          <td>${p.sku}</td>
          <td>${p.name}</td>
          <td>${p.category}</td>
          <td>${fmt(p.price)}</td>
          <td>${p.stock}</td>
          <td>${p.supplier_name || '—'}</td>
          <td>${statusBadge(p.status)}</td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-sm btn-edit"   onclick="editProduct(${p.id})">&#9998; Edit</button>
              <button class="btn btn-sm btn-delete" onclick="deleteProduct(${p.id})">&#128465; Delete</button>
            </div>
          </td>
        </tr>`).join('')
    : '<tr class="empty-row"><td colspan="8">No products found.</td></tr>';
}

/* Search / filter re-fetches and re-renders */
async function renderProducts() {
  await loadProducts();
}

async function openProductModal() {
  await loadSupplierDropdown('p-supplier');
  openModal('product-modal');
}

async function saveProduct() {
  const sku         = document.getElementById('p-sku').value.trim();
  const name        = document.getElementById('p-name').value.trim();
  const price       = parseFloat(document.getElementById('p-price').value) || 0;
  const stock       = parseInt(document.getElementById('p-stock').value)   || 0;
  const category    = document.getElementById('p-cat').value;
  const supplier_id = parseInt(document.getElementById('p-supplier').value);
  const editId      = document.getElementById('edit-product-id').value;

  if (!sku || !name) { alert('SKU and Product Name are required.'); return; }

  try {
    if (editId) {
      await apiPut(API.products, { id: parseInt(editId), sku, name, category, price, stock, supplier_id });
      showToast('✓ Product updated successfully.');
    } else {
      await apiPost(API.products, { sku, name, category, price, stock, supplier_id });
      showToast('✓ Product added successfully.');
    }
    closeModal('product-modal');
    resetProductForm();
    loadProducts();
    updateDashboard();
  } catch (err) {
    alert('Error: ' + err.message);
  }
}

async function editProduct(id) {
  try {
    const p = await apiGet(API.products + '?id=' + id);
    await loadSupplierDropdown('p-supplier');
    document.getElementById('product-modal-title').textContent = 'Edit Product';
    document.getElementById('edit-product-id').value = p.id;
    document.getElementById('p-sku').value      = p.sku;
    document.getElementById('p-name').value     = p.name;
    document.getElementById('p-cat').value      = p.category;
    document.getElementById('p-supplier').value = p.supplier_id;
    document.getElementById('p-price').value    = p.price;
    document.getElementById('p-stock').value    = p.stock;
    openModal('product-modal');
  } catch (err) { alert('Error loading product: ' + err.message); }
}

async function deleteProduct(id) {
  if (!confirm('Delete this product?')) return;
  try {
    await apiDelete(API.products + '?id=' + id);
    showToast('Product deleted.');
    loadProducts();
    updateDashboard();
  } catch (err) { alert('Error: ' + err.message); }
}

function resetProductForm() {
  document.getElementById('product-modal-title').textContent = 'Add New Product';
  document.getElementById('edit-product-id').value = '';
  ['p-sku', 'p-name', 'p-price', 'p-stock'].forEach(id => document.getElementById(id).value = '');
}

/* ============================================
   ORDERS — CRUD
   ============================================ */

let orderProductCache = [];

async function populateOrderProductSelect() {
  try {
    const products = await apiGet(API.products);
    orderProductCache = products;
    const sel = document.getElementById('o-product');
    sel.innerHTML = products.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
  } catch (err) { console.error('Could not load products for order form'); }
}

async function loadOrders() {
  try {
    const orders = await apiGet(API.orders);
    renderOrdersTable(orders);
  } catch (err) {
    document.getElementById('orders-table').innerHTML =
      `<tr class="empty-row"><td colspan="8">Failed to load orders: ${err.message}</td></tr>`;
  }
}

function renderOrdersTable(orders) {
  const q  = (document.getElementById('order-search').value || '').toLowerCase();
  const st = document.getElementById('status-filter').value;

  const filtered = orders.filter(o =>
    (!q  || o.customer.toLowerCase().includes(q) || o.order_code.toLowerCase().includes(q)) &&
    (!st || o.status === st)
  );

  document.getElementById('orders-table').innerHTML = filtered.length
    ? filtered.map(o => `
        <tr>
          <td>${o.order_code}</td>
          <td>${o.customer}</td>
          <td>${o.product_name || '—'}</td>
          <td>${o.qty}</td>
          <td>${fmt(o.total)}</td>
          <td>${o.order_date}</td>
          <td>${statusBadge(o.status)}</td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-sm btn-advance" onclick="advanceOrder(${o.id}, '${o.status}')">&#9654; Advance</button>
              <button class="btn btn-sm btn-delete"  onclick="deleteOrder(${o.id})">&#128465;</button>
            </div>
          </td>
        </tr>`).join('')
    : '<tr class="empty-row"><td colspan="8">No orders found.</td></tr>';
}

async function renderOrders() {
  await loadOrders();
}

async function saveOrder() {
  const customer    = document.getElementById('o-customer').value.trim();
  const product_id  = parseInt(document.getElementById('o-product').value);
  const qty         = parseInt(document.getElementById('o-qty').value) || 1;

  if (!customer) { alert('Customer name is required.'); return; }

  try {
    const result = await apiPost(API.orders, { customer, product_id, qty });
    showToast(`✓ Order ${result.order_code} placed successfully.`);
    closeModal('order-modal');
    document.getElementById('o-customer').value = '';
    document.getElementById('o-qty').value      = 1;
    loadOrders();
    updateDashboard();
  } catch (err) { alert('Error: ' + err.message); }
}

async function advanceOrder(id, currentStatus) {
  const flow = ['Pending', 'Processing', 'Shipped', 'Delivered'];
  const idx  = flow.indexOf(currentStatus);
  if (idx >= flow.length - 1) { showToast('Order is already Delivered.'); return; }
  const newStatus = flow[idx + 1];
  try {
    await apiPut(API.orders, { id, status: newStatus });
    showToast(`Order advanced to "${newStatus}".`);
    loadOrders();
    updateDashboard();
  } catch (err) { alert('Error: ' + err.message); }
}

async function deleteOrder(id) {
  if (!confirm('Delete this order?')) return;
  try {
    await apiDelete(API.orders + '?id=' + id);
    showToast('Order deleted.');
    loadOrders();
    updateDashboard();
  } catch (err) { alert('Error: ' + err.message); }
}

/* ============================================
   SUPPLIERS — CRUD
   ============================================ */

async function loadSuppliers() {
  try {
    const suppliers = await apiGet(API.suppliers);
    supplierCache = suppliers;
    renderSuppliersTable(suppliers);
  } catch (err) {
    document.getElementById('suppliers-table').innerHTML =
      `<tr class="empty-row"><td colspan="6">Failed to load suppliers: ${err.message}</td></tr>`;
  }
}

function renderSuppliersTable(suppliers) {
  const q = (document.getElementById('supplier-search').value || '').toLowerCase();
  const filtered = suppliers.filter(s =>
    !q || s.name.toLowerCase().includes(q) || s.contact.toLowerCase().includes(q)
  );
  document.getElementById('suppliers-table').innerHTML = filtered.length
    ? filtered.map(s => `
        <tr>
          <td>${s.name}</td>
          <td>${s.contact}</td>
          <td>${s.email}</td>
          <td>${s.category}</td>
          <td>${statusBadge(s.status)}</td>
          <td>
            <div class="actions-cell">
              <button class="btn btn-sm btn-edit"   onclick="editSupplier(${s.id})">&#9998; Edit</button>
              <button class="btn btn-sm btn-delete" onclick="deleteSupplier(${s.id})">&#128465;</button>
            </div>
          </td>
        </tr>`).join('')
    : '<tr class="empty-row"><td colspan="6">No suppliers found.</td></tr>';
}

async function renderSuppliers() {
  await loadSuppliers();
}

async function loadSupplierDropdown(selectId) {
  try {
    const suppliers = await apiGet(API.suppliers);
    supplierCache = suppliers;
    document.getElementById(selectId).innerHTML =
      suppliers.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  } catch (err) { console.error('Supplier dropdown error'); }
}

async function saveSupplier() {
  const name     = document.getElementById('s-name').value.trim();
  const contact  = document.getElementById('s-contact').value.trim();
  const email    = document.getElementById('s-email').value.trim();
  const category = document.getElementById('s-cat').value;
  const status   = document.getElementById('s-status') ? document.getElementById('s-status').value : 'Active';
  const editId   = document.getElementById('edit-supplier-id').value;

  if (!name) { alert('Company name is required.'); return; }

  try {
    if (editId) {
      await apiPut(API.suppliers, { id: parseInt(editId), name, contact, email, category, status });
      showToast('✓ Supplier updated successfully.');
    } else {
      await apiPost(API.suppliers, { name, contact, email, category });
      showToast('✓ Supplier added successfully.');
    }
    closeModal('supplier-modal');
    resetSupplierForm();
    loadSuppliers();
  } catch (err) { alert('Error: ' + err.message); }
}

async function editSupplier(id) {
  try {
    const s = await apiGet(API.suppliers + '?id=' + id);
    document.getElementById('supplier-modal-title').textContent = 'Edit Supplier';
    document.getElementById('edit-supplier-id').value = s.id;
    document.getElementById('s-name').value    = s.name;
    document.getElementById('s-contact').value = s.contact;
    document.getElementById('s-email').value   = s.email;
    document.getElementById('s-cat').value     = s.category;
    openModal('supplier-modal');
  } catch (err) { alert('Error loading supplier: ' + err.message); }
}

async function deleteSupplier(id) {
  if (!confirm('Delete this supplier?')) return;
  try {
    await apiDelete(API.suppliers + '?id=' + id);
    showToast('Supplier deleted.');
    loadSuppliers();
  } catch (err) { alert('Error: ' + err.message); }
}

function resetSupplierForm() {
  document.getElementById('supplier-modal-title').textContent = 'Add Supplier';
  document.getElementById('edit-supplier-id').value = '';
  ['s-name', 's-contact', 's-email'].forEach(id => document.getElementById(id).value = '');
}

/* ---- override Add Product button to load supplier dropdown first ---- */
document.addEventListener('DOMContentLoaded', () => {
  const addProductBtn = document.querySelector('[onclick="openModal(\'product-modal\')"]');
  if (addProductBtn) {
    addProductBtn.setAttribute('onclick', "openProductModal()");
  }
});

/* ---- Initial Load ---- */
updateDashboard();
loadProducts();
loadOrders();
loadSuppliers();
