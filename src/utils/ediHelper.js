/**
 * Helper utilities for EDI closing text generation and clipboard operations
 */

export function generateEdiClosingText(report) {
  if (!report) return '';

  const busNum = report.bus_number || report.busNumber || '';
  const operator = report.operator || 'דן באר שבע';
  const summary = report.summary || '';
  const result = report.result || (report.status === 'הטיפול הושלם' ? 'הכול תקין באוטובוס' : 'הועבר להמשך טיפול');
  const dateStr = report.created_at ? new Date(report.created_at).toLocaleDateString('he-IL') : new Date().toLocaleDateString('he-IL');
  const techName = report.technician_name || report.technicianName || '';

  // Format validator devices list
  let devicesSection = '';
  if (report.devices && report.devices.length > 0) {
    const deviceLines = report.devices.map((d, i) => {
      const name = d.product_name || d.productName || `מכשיר ${i + 1}`;
      const sn = d.serial_number || d.serialNumber || 'ללא סריאלי';
      const st = d.status || 'תקין';
      const notes = d.notes ? ` [${d.notes}]` : '';
      return `${name}: ${sn} (${st}${notes})`;
    });
    devicesSection = `מכשירים:\n${deviceLines.join('\n')}`;
  }

  let text = `אוטובוס: ${busNum} (${operator})\nתאריך: ${dateStr}${techName ? ` | טכנאי: ${techName}` : ''}\nתוצאה: ${result}`;
  if (devicesSection) {
    text += `\n${devicesSection}`;
  }
  if (summary) {
    text += `\nסיכום: ${summary}`;
  }
  if (report.resolution_notes) {
    text += `\nפירוט תיקון/סגירה: ${report.resolution_notes}`;
  }

  return text;
}

export async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) {
    console.warn('navigator.clipboard.writeText failed, trying fallback textarea', err);
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error('Copy fallback failed:', err);
    return false;
  }
}
