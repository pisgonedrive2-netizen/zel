-- Ramiz Haziran 2026: son avans kesintisi canonical id; Temmuz yinelenen satırı kaldır.

DELETE FROM salary_extras
WHERE employee_id = 'emp-ramiz'
  AND month = '2026-06'
  AND type = 'deduction'
  AND id <> 'se-ramiz-adv-2026-06';

DELETE FROM salary_extras
WHERE id = 'se-ramiz-adv-2026-07';

INSERT INTO salary_extras (id, employee_id, month, amount, description, type)
VALUES (
  'se-ramiz-adv-2026-06',
  'emp-ramiz',
  '2026-06',
  3000,
  'Açık avans geri ödemesi (3/3 · final) · 1–5 Temmuz 2026 · borç kapanır',
  'deduction'
)
ON CONFLICT (id) DO UPDATE SET
  amount = EXCLUDED.amount,
  description = EXCLUDED.description,
  month = EXCLUDED.month,
  type = EXCLUDED.type;
