/**
 * VDAJ Services — CommercePage
 * Meta Commerce Catalog connector + Product grid + Multi-product message builder
 */

import React, { useState, useEffect } from 'react';
import { clsx } from 'clsx';
import { showSuccess, showError } from '../components/atoms/Toast/Toast.jsx';
import Button, { PrimaryButton, GhostButton } from '../components/atoms/Button/Button.jsx';
import Input, { Select } from '../components/atoms/Input/Input.jsx';
import client from '../lib/api';
import { ErrorState, parseApiError } from '../components/atoms/ErrorState/ErrorState.jsx';

// Commerce API (direct calls)
const commerceApi = {
  getCatalogs: () => client.get('/commerce/catalogs'),
  connectCatalog: (data) => client.post('/commerce/catalogs', data),
  getProducts: (catalogId) => client.get(`/commerce/catalogs/${catalogId}/products`),
  addProduct: (catalogId, data) => client.post(`/commerce/catalogs/${catalogId}/products`, data),
};

// ── WhatsApp Commerce Preview ─────────────────────────────────
function CommercePreview({ products = [], type = 'multi' }) {
  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 rounded-2xl"
        style={{ background: '#0B141A', border: '1px solid rgba(255,255,255,0.08)' }}>
        <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>Add products to preview</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#0B141A', border: '1px solid rgba(255,255,255,0.1)' }}>
      {/* WA Header */}
      <div className="flex items-center gap-2 px-3 py-2.5" style={{ background: '#1F2C34' }}>
        <div className="w-7 h-7 rounded-full bg-brand-gradient flex items-center justify-center text-xs font-bold text-white">B</div>
        <p className="text-xs font-semibold text-white">Business</p>
      </div>

      <div className="p-3 space-y-2">
        {type === 'single' ? (
          /* Single Product */
          <div className="rounded-xl overflow-hidden" style={{ background: '#1F2C34' }}>
            {products[0]?.image_url ? (
              <img src={products[0].image_url} alt="" className="w-full h-32 object-cover" onError={(e) => { e.target.style.display = 'none'; }} />
            ) : (
              <div className="w-full h-32 flex items-center justify-center text-3xl" style={{ background: '#2A3942' }}>🛍️</div>
            )}
            <div className="p-2.5">
              <p className="text-xs font-bold text-white">{products[0]?.name || 'Product Name'}</p>
              <p className="text-xs mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                {products[0]?.currency || 'INR'} {products[0]?.price || '—'}
              </p>
              <button className="w-full mt-2 py-1.5 rounded-lg text-xs font-bold text-white"
                style={{ background: '#00A884' }}>View Product</button>
            </div>
          </div>
        ) : (
          /* Multi Product */
          <>
            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {products.slice(0, 3).map((p, i) => (
                <div key={i} className="shrink-0 w-28 rounded-xl overflow-hidden" style={{ background: '#1F2C34' }}>
                  <div className="w-full h-20 flex items-center justify-center text-2xl" style={{ background: '#2A3942' }}>
                    {p.image_url ? <img src={p.image_url} alt="" className="w-full h-full object-cover" /> : '🛍️'}
                  </div>
                  <div className="p-1.5">
                    <p className="text-2xs font-bold text-white truncate">{p.name}</p>
                    <p className="text-2xs" style={{ color: '#AFA9EC' }}>{p.currency} {p.price}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: '#00A884' }}>
              View Catalog →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ── Product Card ──────────────────────────────────────────────
function ProductCard({ product, selected, onToggle }) {
  return (
    <button onClick={onToggle}
      className={clsx('text-left p-4 rounded-2xl transition-all border-2')}
      style={{
        background: 'var(--bg-elevated)',
        borderColor: selected ? '#534AB7' : 'var(--bg-border)',
      }}>
      <div className="w-full h-28 rounded-xl mb-3 flex items-center justify-center text-3xl overflow-hidden"
        style={{ background: 'var(--bg-base)' }}>
        {product.image_url ? (
          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover rounded-xl"
            onError={(e) => { e.target.parentElement.innerHTML = '🛍️'; }} />
        ) : '🛍️'}
      </div>
      <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{product.name}</p>
      <p className="text-2xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{product.currency} {product.price?.toLocaleString()}</p>
      {selected && (
        <div className="mt-2 flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-brand" />
          <span className="text-2xs font-semibold" style={{ color: '#AFA9EC' }}>Selected</span>
        </div>
      )}
    </button>
  );
}

// ── Add Product Modal ─────────────────────────────────────────
function AddProductModal({ catalogId, onClose, onAdded }) {
  const [form, setForm] = useState({ meta_product_id: '', name: '', price: '', currency: 'INR', image_url: '' });
  const [loading, setLoading] = useState(false);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async () => {
    if (!form.name || !form.meta_product_id) return;
    setLoading(true);
    try {
      const res = await commerceApi.addProduct(catalogId, form);
      onAdded(res.data);
      onClose();
      showSuccess('Product added.');
    } catch {} finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-md glass-card p-6" style={{ background: 'var(--bg-card)', border: '1px solid var(--bg-border)' }}>
        <div className="flex justify-between mb-5">
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Add Product</h3>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}>✕</button>
        </div>
        <div className="space-y-4">
          <Input label="Meta Product ID" placeholder="From Meta Commerce Manager" required
            value={form.meta_product_id} onChange={(e) => set('meta_product_id', e.target.value)} />
          <Input label="Product Name" placeholder="e.g. VDAJ Pro Plan" required
            value={form.name} onChange={(e) => set('name', e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Price" type="number" placeholder="999.00"
              value={form.price} onChange={(e) => set('price', e.target.value)} />
            <Select label="Currency" value={form.currency}
              options={[{ value: 'INR', label: 'INR ₹' }, { value: 'USD', label: 'USD $' }, { value: 'AOA', label: 'AOA Kz' }]}
              onChange={(e) => set('currency', e.target.value)} />
          </div>
          <Input label="Image URL (optional)" placeholder="https://…"
            value={form.image_url} onChange={(e) => set('image_url', e.target.value)} />
        </div>
        <div className="flex gap-3 mt-5">
          <GhostButton onClick={onClose} fullWidth>Cancel</GhostButton>
          <PrimaryButton loading={loading} onClick={submit} fullWidth>Add Product</PrimaryButton>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CommercePage() {
  const [catalogs, setCatalogs] = useState([]);
  const [activeCatalog, setActiveCatalog] = useState(null);
  const [products, setProducts] = useState([]);
  const [selected, setSelected] = useState([]);
  const [previewType, setPreviewType] = useState('multi');
  const [catForm, setCatForm] = useState({ meta_catalog_id: '', name: '' });
  const [connecting, setConnecting] = useState(false);
  const [showAddProduct, setShowAddProduct] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    client.get('/commerce/catalogs', { silent: true })
      .then((r) => setCatalogs(r?.data || []))
      .catch((err) => setLoadError(parseApiError(err)))
      .finally(() => setLoading(false));
  }, []);

  const connectCatalog = async () => {
    if (!catForm.meta_catalog_id || !catForm.name) return;
    setConnecting(true);
    try {
      const res = await commerceApi.connectCatalog(catForm);
      setCatalogs((cs) => [res.data, ...cs]);
      setActiveCatalog(res.data);
      setCatForm({ meta_catalog_id: '', name: '' });
      showSuccess('Catalog connected.');
    } catch {} finally { setConnecting(false); }
  };

  const loadProducts = async (catalog) => {
    setActiveCatalog(catalog);
    setProducts([]);
    try {
      const res = await commerceApi.getProducts(catalog.id);
      setProducts(res?.data || []);
    } catch {}
  };

  const toggleSelect = (p) => {
    setSelected((s) => s.find((x) => x.id === p.id) ? s.filter((x) => x.id !== p.id) : [...s, p]);
  };

  const previewProducts = selected.length > 0 ? selected : products.slice(0, 3);

  return (
    <div className="max-w-7xl mx-auto space-y-6" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black" style={{ color: 'var(--text-primary)' }}>Commerce</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Connect Meta Catalog · Build product messages · Send to customers</p>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Left Panel */}
        <div className="col-span-12 lg:col-span-7 space-y-5">
          {/* Connect Catalog */}
          <div className="glass-card p-5">
            <h2 className="text-sm font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Connect Catalog</h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Input label="Meta Catalog ID" placeholder="From Meta Commerce Manager"
                value={catForm.meta_catalog_id} onChange={(e) => setCatForm((f) => ({ ...f, meta_catalog_id: e.target.value }))} size="sm" />
              <Input label="Catalog Name" placeholder="e.g. VDAJ Products"
                value={catForm.name} onChange={(e) => setCatForm((f) => ({ ...f, name: e.target.value }))} size="sm" />
            </div>
            <PrimaryButton loading={connecting} onClick={connectCatalog} size="sm">Connect Catalog</PrimaryButton>

            {/* Catalog tabs */}
            {catalogs.length > 0 && (
              <div className="flex gap-2 flex-wrap mt-4 pt-4 border-t" style={{ borderColor: 'var(--bg-border)' }}>
                {catalogs.map((c) => (
                  <button key={c.id} onClick={() => loadProducts(c)}
                    className="px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    style={{
                      background: activeCatalog?.id === c.id ? '#534AB7' : 'var(--bg-elevated)',
                      color: activeCatalog?.id === c.id ? '#fff' : 'var(--text-secondary)',
                      border: '1px solid var(--bg-border)',
                    }}>
                    {c.name} ({c.product_count})
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Grid */}
          {activeCatalog && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  Products · {products.length}
                  {selected.length > 0 && <span className="ml-2 badge badge-brand">{selected.length} selected</span>}
                </p>
                <Button size="sm" variant="secondary" onClick={() => setShowAddProduct(true)}
                  leftIcon={<span>+</span>}>Add Product</Button>
              </div>
              {products.length === 0 ? (
                <div className="glass-card flex flex-col items-center py-12 text-center">
                  <span className="text-4xl mb-3">🛍️</span>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>No products yet</p>
                  <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-muted)' }}>Add your products from Meta Commerce Manager.</p>
                  <PrimaryButton size="sm" onClick={() => setShowAddProduct(true)}>Add First Product</PrimaryButton>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  {products.map((p) => (
                    <ProductCard key={p.id} product={p} selected={!!selected.find((s) => s.id === p.id)} onToggle={() => toggleSelect(p)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {!activeCatalog && !loading && loadError && (
            <ErrorState
              title="Failed to load catalogs"
              message={loadError.message}
              httpCode={loadError.httpCode}
              errorCode={loadError.errorCode}
              onRetry={() => {
                setLoadError(null);
                setLoading(true);
                client.get('/commerce/catalogs', { silent: true })
                  .then((r) => setCatalogs(r?.data || []))
                  .catch((err) => setLoadError(parseApiError(err)))
                  .finally(() => setLoading(false));
              }}
            />
          )}
          {!activeCatalog && !loading && !loadError && catalogs.length === 0 && (
            <div className="glass-card flex flex-col items-center py-16 text-center">
              <span className="text-5xl mb-4">🏪</span>
              <p className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>No catalog connected</p>
              <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Connect your Meta Commerce catalog above to get started.</p>
            </div>
          )}
        </div>

        {/* Right: Preview */}
        <div className="col-span-12 lg:col-span-5 space-y-4">
          <div className="glass-card p-5 sticky top-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Message Preview</h3>
              <div className="flex rounded-xl overflow-hidden" style={{ border: '1px solid var(--bg-border)' }}>
                {['single', 'multi'].map((t) => (
                  <button key={t} onClick={() => setPreviewType(t)}
                    className="px-3 py-1.5 text-xs font-semibold capitalize transition-all"
                    style={{
                      background: previewType === t ? '#534AB7' : 'var(--bg-elevated)',
                      color: previewType === t ? '#fff' : 'var(--text-secondary)',
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <CommercePreview products={previewProducts} type={previewType} />

            {previewProducts.length > 0 && (
              <div className="mt-4 pt-4 border-t space-y-2" style={{ borderColor: 'var(--bg-border)' }}>
                <p className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>Selected products:</p>
                {previewProducts.map((p) => (
                  <div key={p.id} className="flex items-center justify-between text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <span className="truncate">{p.name}</span>
                    <span className="shrink-0 ml-2 font-mono">{p.currency} {p.price}</span>
                  </div>
                ))}
                <PrimaryButton fullWidth size="sm" className="mt-3">
                  Send to Campaign →
                </PrimaryButton>
              </div>
            )}
          </div>
        </div>
      </div>

      {showAddProduct && activeCatalog && (
        <AddProductModal catalogId={activeCatalog.id} onClose={() => setShowAddProduct(false)}
          onAdded={(p) => setProducts((ps) => [p, ...ps])} />
      )}
    </div>
  );
}
