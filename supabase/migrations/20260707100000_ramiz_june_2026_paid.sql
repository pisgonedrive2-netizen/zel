-- Ramiz Haziran 2026 bordrosu tam ödendi (kasa dışı / işaretleme).

INSERT INTO payment_statuses (employee_id, month, paid, paid_date, line_payments)
VALUES ('emp-ramiz', '2026-06', true, '2026-07-05', '[]'::jsonb)
ON CONFLICT (employee_id, month) DO UPDATE SET
  paid = EXCLUDED.paid,
  paid_date = EXCLUDED.paid_date,
  updated_at = now();
