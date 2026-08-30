import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Wrench, CheckCircle2, XCircle, Phone, Lock, User } from 'lucide-react';
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
                        {!isSelf && (
                          <button
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
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
