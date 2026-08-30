import express from 'express';
import { db, logAudit } from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';

const router = express.Router();

// GET /api/products - Get products
// If admin: returns all products
// If technician: returns only active products
router.get('/', requireAuth, (req, res) => {
  try {
    const isAdmin = req.user.role === 'admin';
    let stmt;
    if (isAdmin) {
      stmt = db.prepare('SELECT id, name, is_active, created_at FROM products ORDER BY id ASC');
    } else {
      stmt = db.prepare('SELECT id, name FROM products WHERE is_active = 1 ORDER BY name ASC');
    }
    const products = stmt.all();
    res.json(products);
  } catch (err) {
    console.error('Fetch products error:', err);
    res.status(500).json({ error: 'שגיאה בטעינת רשימת מוצרים' });
  }
});

// POST /api/products - Create new product (Admin only)
router.post('/', requireAdmin, (req, res) => {
  try {
    const { name } = req.body;
    const cleanName = (name || '').trim();

    if (!cleanName) {
      return res.status(400).json({ error: 'נא להזין שם מוצר' });
    }

    const checkStmt = db.prepare('SELECT id FROM products WHERE LOWER(name) = LOWER(?)');
    const existing = checkStmt.get(cleanName);
    if (existing) {
      return res.status(400).json({ error: 'קיים כבר מוצר בשם זה' });
    }

    const insertStmt = db.prepare('INSERT INTO products (name, is_active) VALUES (?, 1)');
    const result = insertStmt.run(cleanName);

    logAudit(req.user.id, req.user.fullName, 'הוספת מוצר', 'מוצר', result.lastInsertRowid, `נוסף מוצר: ${cleanName}`);

    res.status(201).json({
      id: Number(result.lastInsertRowid),
      name: cleanName,
      is_active: 1
    });
  } catch (err) {
    console.error('Create product error:', err);
    res.status(500).json({ error: 'שגיאה ביצירת מוצר' });
  }
});

// PUT /api/products/:id - Edit product name (Admin only)
router.put('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const cleanName = (name || '').trim();

    if (!cleanName) {
      return res.status(400).json({ error: 'נא להזין שם מוצר תקין' });
    }

    const checkStmt = db.prepare('SELECT id FROM products WHERE LOWER(name) = LOWER(?) AND id != ?');
    const duplicate = checkStmt.get(cleanName, id);
    if (duplicate) {
      return res.status(400).json({ error: 'קיים כבר מוצר אחר בשם זה' });
    }

    const updateStmt = db.prepare('UPDATE products SET name = ? WHERE id = ?');
    updateStmt.run(cleanName, id);

    logAudit(req.user.id, req.user.fullName, 'עריכת מוצר', 'מוצר', id, `שם שונה ל: ${cleanName}`);

    res.json({ success: true, id: Number(id), name: cleanName });
  } catch (err) {
    console.error('Update product error:', err);
    res.status(500).json({ error: 'שגיאה בעדכון מוצר' });
  }
});

// PATCH /api/products/:id/toggle - Toggle active/inactive (Admin only)
router.patch('/:id/toggle', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('SELECT id, name, is_active FROM products WHERE id = ?');
    const prod = stmt.get(id);

    if (!prod) {
      return res.status(404).json({ error: 'מוצר לא נמצא' });
    }

    const newStatus = prod.is_active ? 0 : 1;
    const updateStmt = db.prepare('UPDATE products SET is_active = ? WHERE id = ?');
    updateStmt.run(newStatus, id);

    const statusText = newStatus ? 'פעיל' : 'מושבת';
    logAudit(req.user.id, req.user.fullName, 'שינוי סטטוס מוצר', 'מוצר', id, `סטטוס שונה ל: ${statusText}`);

    res.json({ success: true, id: Number(id), is_active: newStatus });
  } catch (err) {
    console.error('Toggle product error:', err);
    res.status(500).json({ error: 'שגיאה בשינוי סטטוס מוצר' });
  }
});

// DELETE /api/products/:id - Delete product from list (Admin only)
router.delete('/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('SELECT id, name FROM products WHERE id = ?');
    const prod = stmt.get(id);

    if (!prod) {
      return res.status(404).json({ error: 'מוצר לא נמצא' });
    }

    const deleteStmt = db.prepare('DELETE FROM products WHERE id = ?');
    deleteStmt.run(id);

    logAudit(req.user.id, req.user.fullName, 'מחיקת מוצר', 'מוצר', id, `המוצר ${prod.name} נמחק מהמערכת`);

    res.json({ success: true, id: Number(id), name: prod.name });
  } catch (err) {
    console.error('Delete product error:', err);
    res.status(500).json({ error: 'שגיאה במחיקת מוצר' });
  }
});

export default router;
