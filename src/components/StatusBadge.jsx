import React from 'react';

export default function StatusBadge({ status, className = '' }) {
  if (!status) return null;

  let colorClasses = 'bg-slate-100 text-slate-800 border-slate-200';

  switch (status) {
    case 'נדרש טיפול':
      // כתום
      colorClasses = 'bg-amber-100 text-amber-800 border-amber-300';
      break;
    case 'בטיפול':
      // כחול
      colorClasses = 'bg-blue-100 text-blue-800 border-blue-300';
      break;
    case 'הטיפול הושלם':
    case 'טיפול בתוקף':
    case 'תקין':
      // ירוק
      colorClasses = 'bg-emerald-100 text-emerald-800 border-emerald-300';
      break;
    case 'הועבר להמשך טיפול':
    case 'טיפול באיחור':
    case 'לא תקין':
      // אדום
      colorClasses = 'bg-rose-100 text-rose-800 border-rose-300';
      break;
    default:
      colorClasses = 'bg-slate-100 text-slate-700 border-slate-200';
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${colorClasses} ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 ml-1 bg-current opacity-70"></span>
      {status}
    </span>
  );
}
