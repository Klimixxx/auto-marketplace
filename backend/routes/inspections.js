// backend/routes/inspections.js
import express from 'express';
import { query } from '../db.js';

const router = express.Router();
const BASE_PRICE = 12000;

// Создать заказ на осмотр
router.post('/', async (req, res) => {
  try {
    // ВНИМАНИЕ: этот роут должен быть навешан под app.use('/api/inspections', auth, router)
    // тогда req.user будет заполнен (см. backend/index.js)
    const userId = req.user?.sub;
    const listingId = Number(req.body?.listingId);
    if (!userId) return res.status(401).json({ error: 'No user' });
    if (!listingId) return res.status(400).json({ error: 'listingId required' });

    // Проверим, что объявление существует
    const l = await query('SELECT id, title FROM listings WHERE id=$1', [listingId]);
    if (!l.rows[0]) return res.status(404).json({ error: 'Listing not found' });

    // Получим пользователя, баланс и статус подписки
    const u = await query(
      `SELECT id, balance, COALESCE(subscription_status,'free') AS subscription_status
         FROM users WHERE id=$1 FOR UPDATE`,
      [userId]
    );

    // Чтобы FOR UPDATE сработал, оборачиваем всё в транзакцию
    await query('BEGIN');
    const user = u.rows[0];
    if (!user) { await query('ROLLBACK'); return res.status(404).json({ error: 'User not found' }); }

    const isPro = String(user.subscription_status).toLowerCase() === 'pro';
    const discountPercent = isPro ? 50 : 0;
    const finalAmount = Math.round(BASE_PRICE * (100 - discountPercent) / 100);

    if (Number(user.balance) < finalAmount) {
      await query('ROLLBACK');
      return res.status(402).json({ error: 'INSUFFICIENT_FUNDS', message: 'Недостаточно средств, пополните счет' });
    }

    // Списание
    await query('UPDATE users SET balance = balance - $1 WHERE id=$2', [finalAmount, userId]);

    // Создание заказа
    const ins = await query(
      `INSERT INTO inspections (user_id, listing_id, status, base_price, discount_percent, final_amount)
       VALUES ($1,$2,'Идет модерация',$3,$4,$5)
       RETURNING *`,
      [userId, listingId, BASE_PRICE, discountPercent, finalAmount]
    );

    await query('COMMIT');
    return res.json({ ok: true, order: ins.rows[0] });
  } catch (e) {
    await query('ROLLBACK').catch(()=>{});
    console.error('create inspection error:', e);
    return res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

// Список заказов текущего пользователя
router.get('/me', async (req, res) => {
  try {
    const userId = req.user?.sub;
    if (!userId) return res.status(401).json({ error: 'No user' });
    const q = await query(
      `SELECT i.*, l.title AS listing_title
         FROM inspections i
         JOIN listings l ON l.id = i.listing_id
        WHERE i.user_id = $1
        ORDER BY i.created_at DESC`,
      [userId]
    );
    res.json({ items: q.rows });
  } catch (e) {
    console.error('my inspections error:', e);
    res.status(500).json({ error: 'SERVER_ERROR' });
  }
});

export default router;
