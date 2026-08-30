import React, { useState, useEffect } from 'react';
import { Package, Plus, Edit2, Trash2, Check, X, ToggleLeft, ToggleRight, AlertCircle, Sparkles } from 'lucide-react';

export default function ProductsView() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [editError, setEditError] = useState('');

  const loadProducts = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, []);

  const handleAddProduct = async (e) => {
    e.preventDefault();
    if (!newName.trim()) return;

    setAdding(true);
    setAddError('');

    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newName.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בהוספת מוצר');
      }
      setNewName('');
      loadProducts();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleStartEdit = (prod) => {
    setEditingId(prod.id);
    setEditingName(prod.name);
    setEditError('');
  };

  const handleSaveEdit = async (id) => {
    if (!editingName.trim()) return;
    setEditError('');

    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בעריכת מוצר');
      }
      setEditingId(null);
      loadProducts();
    } catch (err) {
      setEditError(err.message);
    }
  };

  const handleToggleActive = async (id) => {
    try {
      const res = await fetch(`/api/products/${id}/toggle`, {
        method: 'PATCH'
      });
      if (res.ok) {
        loadProducts();
      }
    } catch (err) {
      console.error('Toggle error:', err);
    }
  };

  const handleDeleteProduct = async (prod) => {
    if (!window.confirm(`האם אתה בטוח שברצונך למחוק את המוצר "${prod.name}" לצמיתות מהרשימה?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/products/${prod.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'שגיאה במחיקת מוצר');
      } else {
        loadProducts();
      }
    } catch (err) {
      console.error('Delete error:', err);
      alert('שגיאה בתקשורת עם השרת');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <span className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Package className="w-6 h-6" />
            </span>
            <span>ניהול מוצרים וסוגי מכשירים</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            הגדרת סוגי המכשירים הזמינים לבחירה על ידי הטכנאים בעת ביצוע טיפול מונע
          </p>
        </div>
      </div>

      {/* Add Product Form */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-3">
        <h2 className="text-sm font-extrabold text-slate-800">הוספת מוצר / סוג מכשיר חדש</h2>
        
        {addError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
            ⚠️ {addError}
          </div>
        )}

        <form onSubmit={handleAddProduct} className="flex gap-2">
          <input
            type="text"
            placeholder="לדוגמה: מצלמת פנים, מסך מגע..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            required
          />
          <button
            type="submit"
            disabled={adding}
            className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white text-sm font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center gap-2 transition-all disabled:opacity-50"
          >
            <Plus className="w-5 h-5" />
            <span>הוסף מוצר</span>
          </button>
        </form>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">קטלוג מוצרים פעילים והיסטוריים ({products.length})</span>
          <span className="text-xs text-slate-400">מוצר שהושבת לא יימחק מדוחות עבר</span>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-sm">
            לא הוגדרו עדיין מוצרים במערכת
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {products.map((prod) => (
              <div key={prod.id} className="p-4 flex items-center justify-between gap-3 hover:bg-slate-50 transition-colors">
                
                {editingId === prod.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 px-3 py-2 border border-emerald-500 rounded-xl text-sm font-bold text-slate-900 focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(prod.id)}
                      className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700"
                      title="שמור"
                    >
                      <Check className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-2 bg-slate-200 text-slate-700 rounded-xl hover:bg-slate-300"
                      title="בטל"
                    >
                      <X className="w-4 h-4" />
                    </button>
                    {editError && <span className="text-xs text-rose-600 font-bold">{editError}</span>}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${prod.is_active ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <div>
                      <span className={`text-sm font-bold ${prod.is_active ? 'text-slate-900' : 'text-slate-400 line-through'}`}>
                        {prod.name}
                      </span>
                      <span className="block text-[11px] text-slate-400">
                        נוצר בתאריך: {new Date(prod.created_at).toLocaleDateString('he-IL')}
                      </span>
                    </div>
                  </div>
                )}

                {editingId !== prod.id && (
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleStartEdit(prod)}
                      className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                      title="ערוך שם מוצר"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleDeleteProduct(prod)}
                      className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="מחק מוצר מהרשימה"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      onClick={() => handleToggleActive(prod.id)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 ${
                        prod.is_active
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                          : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                      }`}
                    >
                      <span>{prod.is_active ? 'פעיל' : 'מושבת'}</span>
                    </button>
                  </div>
                )}

              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}
