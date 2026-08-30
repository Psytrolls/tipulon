import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Wrench, CheckCircle2, XCircle, Phone, Lock, User, KeyRound, Edit2, X, RotateCcw, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export default function UsersView() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // New user form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState('technician');
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [adding, setAdding] = useState(false);

  // Change PIN modal state
  const [pinModalUser, setPinModalUser] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPinText, setShowPinText] = useState(false);
  const [pinError, setPinError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  // Edit details modal state
  const [editModalUser, setEditModalUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/users');
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
      }
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddError('');
    setAddSuccess('');

    if (!fullName.trim() || !phone.trim() || !pin.trim()) {
      setAddError('כל השדות הם חובה');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName, phone, pin, role })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה ביצירת משתמש');
      }

      setAddSuccess(`המשתמש ${data.full_name} נוצר בהצלחה עם PIN זמני!`);
      setFullName('');
      setPhone('');
      setPin('');
      setRole('technician');
      loadUsers();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  };

  const handleRoleChange = async (id, newRole) => {
    try {
      const res = await fetch(`/api/users/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: newRole })
      });
      if (res.ok) {
        loadUsers();
      }
    } catch (err) {
      console.error('Role change error:', err);
    }
  };

  const handleToggleUser = async (id) => {
    try {
      const res = await fetch(`/api/users/${id}/toggle`, {
        method: 'PATCH'
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'שגיאה בעדכון סטטוס משתמש');
      } else {
        loadUsers();
      }
    } catch (err) {
      console.error('Toggle user error:', err);
    }
  };

  const handleOpenPinModal = (u) => {
    setPinModalUser(u);
    setNewPin('');
    setConfirmPin('');
    setPinError('');
  };

  const handleSavePin = async (e) => {
    e.preventDefault();
    setPinError('');

    if (newPin.length < 4 || newPin.length > 8 || !/^\d+$/.test(newPin)) {
      setPinError('קוד PIN חייב להכיל בין 4 ל-8 ספרות בלבד');
      return;
    }
    if (newPin !== confirmPin) {
      setPinError('קודי ה-PIN אינם תואמים');
      return;
    }

    setPinSaving(true);
    try {
      const res = await fetch(`/api/users/${pinModalUser.id}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בעדכון קוד PIN');
      }
      alert(`קוד ה-PIN עבור ${pinModalUser.full_name} עודכן בהצלחה!`);
      setPinModalUser(null);
    } catch (err) {
      setPinError(err.message);
    } finally {
      setPinSaving(false);
    }
  };

  const handleOpenEditModal = (u) => {
    setEditModalUser(u);
    setEditName(u.full_name);
    setEditPhone(u.phone);
    setEditError('');
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    setEditError('');

    if (!editName.trim() || !editPhone.trim()) {
      setEditError('שם מלא ומספר טלפון הם שדות חובה');
      return;
    }

    setEditSaving(true);
    try {
      const res = await fetch(`/api/users/${editModalUser.id}/details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: editName.trim(), phone: editPhone.trim() })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בעדכון פרטי משתמש');
      }
      setEditModalUser(null);
      loadUsers();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
          <span className="p-2 bg-purple-50 text-purple-600 rounded-xl">
            <Users className="w-6 h-6" />
          </span>
          <span>ניהול משתמשים והרשאות</span>
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          הוספה וניהול של טכנאי שטח ומנהלי מערכת, הגדרת מספרי טלפון וקודי PIN
        </p>
      </div>

      {/* Add User Card */}
      <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-base font-black text-slate-900 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-emerald-600" />
          <span>הוספת משתמש חדש</span>
        </h2>

        {addSuccess && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{addSuccess}</span>
          </div>
        )}

        {addError && (
          <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs font-bold text-rose-700">
            ⚠️ {addError}
          </div>
        )}

        <form onSubmit={handleAddUser} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">שם מלא</label>
            <div className="relative">
              <input
                type="text"
                placeholder="ישראל ישראלי"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full pl-3 pr-9 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                required
              />
              <User className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">מספר טלפון</label>
            <div className="relative">
              <input
                type="tel"
                dir="ltr"
                placeholder="050-1234567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-left"
                required
              />
              <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">PIN זמני (4-8 ספרות)</label>
            <div className="relative">
              <input
                type="password"
                inputMode="numeric"
                maxLength={8}
                dir="ltr"
                placeholder="••••"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-left"
                required
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">תפקיד</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            >
              <option value="technician">טכנאי שטח</option>
              <option value="admin">מנהל מערכת</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-4 pt-1">
            <button
              type="submit"
              disabled={adding}
              className="py-3 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              <UserPlus className="w-4 h-4" />
              <span>{adding ? 'יוצר משתמש...' : 'צור משתמש חדש'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Users List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">משתמשי המערכת ({users.length})</span>
        </div>

        {loading ? (
          <div className="p-12 flex justify-center">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3.5">שם מלא</th>
                  <th className="p-3.5">מספר טלפון</th>
                  <th className="p-3.5">תפקיד</th>
                  <th className="p-3.5">סטטוס</th>
                  <th className="p-3.5">תאריך הצטרפות</th>
                  <th className="p-3.5 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                        <span>{u.full_name}</span>
                        {isSelf && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal">
                            (אתה)
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-slate-600" dir="ltr">{u.phone}</td>
                      <td className="p-3.5">
                        <select
                          value={u.role}
                          disabled={isSelf}
                          onChange={(e) => handleRoleChange(u.id, e.target.value)}
                          className={`px-2 py-1 rounded-lg text-xs font-bold border ${
                            u.role === 'admin'
                              ? 'bg-purple-50 text-purple-800 border-purple-200'
                              : 'bg-blue-50 text-blue-800 border-blue-200'
                          } disabled:opacity-75`}
                        >
                          <option value="technician">טכנאי</option>
                          <option value="admin">מנהל</option>
                        </select>
                      </td>
                      <td className="p-3.5">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                        }`}>
                          {u.is_active ? 'פעיל' : 'מושבת'}
                        </span>
                      </td>
                      <td className="p-3.5 text-slate-500">
                        {new Date(u.created_at).toLocaleDateString('he-IL')}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenPinModal(u)}
                            className="p-2 rounded-xl text-slate-500 hover:text-purple-700 hover:bg-purple-50 transition-colors"
                            title="שנה קוד PIN למשתמש"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleOpenEditModal(u)}
                            className="p-2 rounded-xl text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors"
                            title="ערוך שם ומספר טלפון"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => handleToggleUser(u.id)}
                              className={`px-3 py-1 rounded-xl text-xs font-bold transition-colors ${
                                u.is_active 
                                  ? 'text-rose-600 hover:bg-rose-50' 
                                  : 'text-emerald-600 hover:bg-emerald-50'
                              }`}
                            >
                              {u.is_active ? 'השבת' : 'הפעל'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Change PIN Modal */}
      {pinModalUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">
                    {pinModalUser.id === currentUser?.id ? 'שינוי קוד ה-PIN האישי שלך' : 'איפוס / שינוי קוד PIN'}
                  </h3>
                  <p className="text-xs text-slate-500">עבור {pinModalUser.full_name} ({pinModalUser.phone})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPinModalUser(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {pinError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                ⚠️ {pinError}
              </div>
            )}

            {/* Quick Reset Option for Technicians */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-slate-800 block">איפוס מהיר לטכנאי שנשכח ממנו הקוד:</span>
                <span className="text-[11px] text-slate-500">קביעת קוד ברירת המחדל 1234 בלחיצה אחת</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setNewPin('1234');
                  setConfirmPin('1234');
                }}
                className="px-3 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-900 text-xs font-bold rounded-lg border border-amber-300 flex items-center gap-1.5 transition-colors shrink-0"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>הגדר 1234</span>
              </button>
            </div>

            <form onSubmit={handleSavePin} className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">קוד PIN חדש (4-8 ספרות):</label>
                  <button
                    type="button"
                    onClick={() => setShowPinText(!showPinText)}
                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                  >
                    {showPinText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showPinText ? 'הסתר' : 'הצג קוד'}</span>
                  </button>
                </div>
                <input
                  type={showPinText ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="הזן קוד PIN חדש..."
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono tracking-wider"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">אימות קוד PIN חדש:</label>
                <input
                  type={showPinText ? 'text' : 'password'}
                  inputMode="numeric"
                  maxLength={8}
                  placeholder="הזן שוב לאימות..."
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none font-mono tracking-wider"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setPinModalUser(null)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={pinSaving}
                  className="flex-1 py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs rounded-xl shadow-md shadow-purple-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <KeyRound className="w-4 h-4" />
                  <span>{pinSaving ? 'מעדכן...' : 'שמור ואפס קוד PIN'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Details Modal */}
      {editModalUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">עריכת פרטי משתמש</h3>
                  <p className="text-xs text-slate-500">שינוי שם מלא ומספר טלפון לכניסה</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditModalUser(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                ⚠️ {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">שם מלא:</label>
                <input
                  type="text"
                  placeholder="לדוגמה: מנהל מערכת ראשי"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  required
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">מספר טלפון להתחברות:</label>
                <input
                  type="tel"
                  placeholder="050-1234567"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none font-mono"
                  dir="ltr"
                  required
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditModalUser(null)}
                  className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
                >
                  {editSaving ? 'שומר...' : 'שמור שינויים'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
