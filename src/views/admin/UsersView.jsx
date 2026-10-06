import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Wrench, CheckCircle2, XCircle, Phone, Lock, User, KeyRound, Edit2, X, RotateCcw, Eye, EyeOff, Unlock, ShieldAlert, Trash2, Crown, AlertTriangle, Copy, Check, Sparkles } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

const generateClientSecurePassword = () => {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
  const getChunk = (len) => {
    const array = new Uint8Array(len);
    window.crypto.getRandomValues(array);
    return Array.from(array).map(b => chars[b % chars.length]).join('');
  };
  return `${getChunk(4)}-${getChunk(4)}-${getChunk(4)}`;
};

export default function UsersView() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // New user form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState('technician');
  const [showAddPinText, setShowAddPinText] = useState(true);
  const [addError, setAddError] = useState('');
  const [addSuccessData, setAddSuccessData] = useState(null); // { name, phone, tempPassword }
  const [copiedAddPass, setCopiedAddPass] = useState(false);
  const [adding, setAdding] = useState(false);

  // Change PIN modal state
  const [pinModalUser, setPinModalUser] = useState(null);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPinText, setShowPinText] = useState(true);
  const [pinError, setPinError] = useState('');
  const [pinSaving, setPinSaving] = useState(false);
  const [pinSuccessData, setPinSuccessData] = useState(null); // { name, phone, tempPassword }
  const [copiedPinPass, setCopiedPinPass] = useState(false);

  // Edit details modal state
  const [editModalUser, setEditModalUser] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  // Delete user modal state
  const [deleteModalUser, setDeleteModalUser] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

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
    setAddSuccessData(null);

    if (!fullName.trim() || !phone.trim()) {
      setAddError('שם מלא ומספר טלפון הם שדות חובה');
      return;
    }

    setAdding(true);
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          phone: phone.trim(),
          pin: pin.trim(),
          role
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה ביצירת משתמש');
      }

      setAddSuccessData({
        name: data.full_name,
        phone: data.phone,
        tempPassword: data.tempPassword || pin.trim()
      });
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

  const handleUnlockUser = async (id) => {
    try {
      const res = await fetch(`/api/users/${id}/unlock`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'שגיאה בשחרור נעילת משתמש');
      } else {
        alert('נעילת האבטחה שוחררה בהצלחה!');
        loadUsers();
      }
    } catch (err) {
      console.error('Unlock user error:', err);
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
    const initialGen = generateClientSecurePassword();
    setNewPin(initialGen);
    setConfirmPin(initialGen);
    setPinError('');
    setPinSuccessData(null);
    setCopiedPinPass(false);
  };

  const handleSavePin = async (e) => {
    e.preventDefault();
    setPinError('');

    if (newPin.trim() !== confirmPin.trim()) {
      setPinError('הסיסמאות אינן תואמות');
      return;
    }

    setPinSaving(true);
    try {
      const res = await fetch(`/api/users/${pinModalUser.id}/pin`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          newPin: newPin.trim()
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה בעדכון הסיסמה');
      }

      setPinSuccessData({
        name: pinModalUser.full_name,
        phone: pinModalUser.phone,
        tempPassword: data.tempPassword || newPin.trim()
      });
      loadUsers();
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

  const handleOpenDeleteModal = (u) => {
    setDeleteModalUser(u);
    setDeleteError('');
  };

  const handleConfirmDelete = async () => {
    if (!deleteModalUser) return;
    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch(`/api/users/${deleteModalUser.id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'שגיאה במחיקת המשתמש');
      }
      setDeleteModalUser(null);
      loadUsers();
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
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

        {addSuccessData && (
          <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <span className="font-extrabold text-sm text-emerald-900">
                  המשתמש {addSuccessData.name} נוצר בהצלחה!
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAddSuccessData(null)}
                className="p-1 text-emerald-700 hover:text-emerald-900"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-3 bg-white rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <span className="text-xs font-bold text-slate-500 block">סיסמה זמנית ראשונית למסירה לעובד:</span>
                <span className="text-base font-black font-mono text-emerald-800 tracking-wider" dir="ltr">
                  {addSuccessData.tempPassword}
                </span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await navigator.clipboard.writeText(addSuccessData.tempPassword);
                  setCopiedAddPass(true);
                  setTimeout(() => setCopiedAddPass(false), 2000);
                }}
                className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 transition-all active:scale-95"
              >
                {copiedAddPass ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAddPass ? 'הועתק! ✓' : 'העתק סיסמה'}</span>
              </button>
            </div>

            <p className="text-[11px] text-emerald-800 font-medium">
              * המשתמש יידרש להחליף סיסמה זו לסיסמה אישית וקבועה מיד עם כניסתו הראשונה למערכת.
            </p>
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">סיסמה זמנית ראשונית</label>
              <button
                type="button"
                onClick={() => {
                  const gen = generateClientSecurePassword();
                  setPin(gen);
                }}
                className="text-[11px] text-emerald-700 hover:text-emerald-900 font-bold flex items-center gap-1"
                tabIndex="-1"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" />
                <span>חולל אקראית</span>
              </button>
            </div>
            <div className="relative">
              <input
                type={showAddPinText ? 'text' : 'password'}
                maxLength={32}
                dir="ltr"
                placeholder="השאר ריק למחולל אוטומטי"
                value={pin}
                onChange={(e) => setPin(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none text-left font-mono"
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

          <div className="sm:col-span-2 lg:col-span-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-1">
            <span className="text-[11px] text-slate-500 font-medium">
              🔒 כל משתמש חדש מחויב אוטומטית לשנות את הסיסמה האישית שלו בהתחברות הראשונה.
            </span>

            <button
              type="submit"
              disabled={adding}
              className="py-2.5 px-6 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
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
                  <th className="p-3.5">סטטוס ואבטחה</th>
                  <th className="p-3.5">תאריך הצטרפות</th>
                  <th className="p-3.5 text-center">פעולות</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const isSelf = u.id === currentUser?.id;
                  const isSuperAdmin = Boolean(u.is_super_admin);

                  return (
                    <tr key={u.id} className={`hover:bg-slate-50 transition-colors ${isSuperAdmin ? 'bg-amber-50/20' : ''}`}>
                      <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                        <span>{u.full_name}</span>
                        {isSuperAdmin && (
                          <span className="inline-flex items-center gap-1 text-[10px] bg-gradient-to-r from-amber-100 to-amber-200 text-amber-900 border border-amber-300 font-black px-2 py-0.5 rounded-full shadow-sm">
                            <Crown className="w-3 h-3 text-amber-600 fill-amber-500" />
                            <span>מנהל על</span>
                          </span>
                        )}
                        {isSelf && !isSuperAdmin && (
                          <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-normal">
                            (אתה)
                          </span>
                        )}
                      </td>
                      <td className="p-3.5 font-mono text-slate-600" dir="ltr">{u.phone}</td>
                      <td className="p-3.5">
                        {isSuperAdmin ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-purple-50 text-purple-900 border border-purple-200">
                            <Shield className="w-3.5 h-3.5 text-purple-600" />
                            <span>מנהל על (Super Admin)</span>
                          </span>
                        ) : (
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
                        )}
                      </td>
                      <td className="p-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-bold ${
                            u.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                          }`}>
                            {u.is_active ? 'פעיל' : 'מושבת'}
                          </span>

                          {u.is_locked && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-rose-100 text-rose-800 border border-rose-300 animate-pulse">
                              <ShieldAlert className="w-3 h-3" />
                              <span>נעול זמנית</span>
                            </span>
                          )}

                          {u.must_change_pin && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              <KeyRound className="w-3 h-3" />
                              <span>נדרש עדכון סיסמה</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-3.5 text-slate-500">
                        {new Date(u.created_at).toLocaleDateString('he-IL')}
                      </td>
                      <td className="p-3.5 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {u.is_locked && (
                            <button
                              type="button"
                              onClick={() => handleUnlockUser(u.id)}
                              className="p-2 rounded-xl text-rose-600 hover:text-rose-800 hover:bg-rose-50 transition-colors"
                              title="שחרר נעילת אבטחה של המשתמש"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                          )}

                          {isSuperAdmin && !currentUser?.isSuperAdmin ? (
                            <span className="text-[11px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-xl inline-flex items-center gap-1 shadow-sm">
                              <Shield className="w-3.5 h-3.5 text-amber-600" />
                              <span>מוגן (מנהל על)</span>
                            </span>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleOpenPinModal(u)}
                                className="p-2 rounded-xl text-slate-500 hover:text-purple-700 hover:bg-purple-50 transition-colors"
                                title="שנה קוד PIN / סיסמה למשתמש"
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
                            </>
                          )}

                          {!isSelf && !isSuperAdmin && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleToggleUser(u.id)}
                                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors ${
                                  u.is_active 
                                    ? 'text-amber-600 hover:bg-amber-50' 
                                    : 'text-emerald-600 hover:bg-emerald-50'
                                }`}
                              >
                                {u.is_active ? 'השבת' : 'הפעל'}
                              </button>

                              <button
                                type="button"
                                onClick={() => handleOpenDeleteModal(u)}
                                className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                                title="מחק משתמש לצמיתות מהמערכת"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
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

      {/* Change PIN / Password Modal */}
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
                    {pinModalUser.id === currentUser?.id ? 'שינוי הסיסמה האישית שלך' : 'איפוס / שינוי סיסמה'}
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

            {pinSuccessData ? (
              <div className="space-y-4 animate-fadeIn">
                <div className="p-4 bg-emerald-50 border-2 border-emerald-300 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-emerald-900 font-extrabold text-sm">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                    <span>הסיסמה הזמנית אופסה בהצלחה!</span>
                  </div>

                  <div className="p-3 bg-white rounded-xl border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-500 block">סיסמה זמנית חדשה עבור {pinSuccessData.name}:</span>
                      <span className="text-base font-black font-mono text-emerald-800 tracking-wider" dir="ltr">
                        {pinSuccessData.tempPassword}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={async () => {
                        await navigator.clipboard.writeText(pinSuccessData.tempPassword);
                        setCopiedPinPass(true);
                        setTimeout(() => setCopiedPinPass(false), 2000);
                      }}
                      className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 shrink-0 transition-all active:scale-95"
                    >
                      {copiedPinPass ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedPinPass ? 'הועתק! ✓' : 'העתק סיסמה'}</span>
                    </button>
                  </div>

                  <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                    * כל ההתחברויות והסשנים הפעילים של המשתמש בוטלו מיידית. המשתמש יידרש להחליף סיסמה זו לסיסמה אישית בכניסתו הבאה.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setPinModalUser(null)}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl transition-all shadow-md"
                >
                  סגור חלון
                </button>
              </div>
            ) : (
              <>
                {pinError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                    ⚠️ {pinError}
                  </div>
                )}

                {/* Generator Option for Admin */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-slate-800 block">מחולל סיסמה זמנית אקראית:</span>
                    <span className="text-[11px] text-slate-500">יוצר סיסמה מאובטחת של 12 תווים</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const gen = generateClientSecurePassword();
                      setNewPin(gen);
                      setConfirmPin(gen);
                    }}
                    className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 text-xs font-bold rounded-lg border border-purple-300 flex items-center gap-1.5 transition-colors shrink-0"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-purple-700" />
                    <span>חולל אקראית</span>
                  </button>
                </div>

                <form onSubmit={handleSavePin} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">סיסמה זמנית חדשה:</label>
                      <button
                        type="button"
                        onClick={() => setShowPinText(!showPinText)}
                        className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1"
                        tabIndex="-1"
                      >
                        {showPinText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        <span>{showPinText ? 'הסתר' : 'הצג סיסמה'}</span>
                      </button>
                    </div>
                    <input
                      type={showPinText ? 'text' : 'password'}
                      maxLength={32}
                      dir="ltr"
                      placeholder="הזן סיסמה חדשה (לפחות 6 תווים)..."
                      value={newPin}
                      onChange={(e) => setNewPin(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none text-left font-mono"
                      required
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">אימות סיסמה חדשה:</label>
                    <input
                      type={showPinText ? 'text' : 'password'}
                      maxLength={32}
                      dir="ltr"
                      placeholder="הזן שוב לאימות..."
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-bold text-slate-900 focus:bg-white focus:ring-2 focus:ring-purple-500 focus:outline-none text-left font-mono"
                      required
                    />
                  </div>

                  <p className="text-[11px] text-slate-500">
                    🔒 המשתמש יחויב להחליף סיסמה זו לסיסמה אישית בכניסתו הבאה, וכל החיבורים הפעילים ינותקו.
                  </p>

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
                      <span>{pinSaving ? 'מעדכן...' : 'שמור סיסמה ושחרר נעילה'}</span>
                    </button>
                  </div>
                </form>
              </>
            )}
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

      {/* Delete User Confirmation Modal */}
      {deleteModalUser && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-slate-200 space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900">מחיקת משתמש לצמיתות</h3>
                  <p className="text-xs text-slate-500">פעולה זו בלתי הפיכה</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold rounded-xl">
                ⚠️ {deleteError}
              </div>
            )}

            <div className="p-4 bg-rose-50/50 border border-rose-200 rounded-2xl space-y-2">
              <div className="flex items-center gap-2 text-rose-800 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>האם אתה בטוח שברצונך למחוק משתמש זה?</span>
              </div>
              <div className="text-xs text-slate-700 bg-white p-3 rounded-xl border border-rose-100 space-y-1">
                <p><strong>שם מלא:</strong> {deleteModalUser.full_name}</p>
                <p><strong>מספר טלפון:</strong> <span dir="ltr" className="font-mono">{deleteModalUser.phone}</span></p>
                <p><strong>תפקיד:</strong> {deleteModalUser.role === 'admin' ? 'מנהל מערכת' : 'טכנאי שטח'}</p>
              </div>
              <p className="text-[11px] text-rose-600 font-semibold leading-relaxed">
                * המשתמש יימחק לחלוטין ויינותק מיד מהמערכת. היסטוריית הדוחות שביצע בעבר תישמר במלואה.
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteModalUser(null)}
                className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                ביטול
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting}
                className="flex-1 py-3 px-4 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-bold text-xs rounded-xl shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleting ? 'מוחק...' : 'מחק משתמש לצמיתות'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
