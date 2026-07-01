-- Acelya Haziran 2026 son bordro + Lucy Haziran ödendi

UPDATE public.salary_extras
SET amount = 600,
    description = 'Açık avans geri ödemesi (final · kalan $600) · 29 Haziran iş çıkışı · net maaş $2.783'
WHERE id = 'se-acelya-adv-2026-06';

UPDATE public.salary_extras
SET amount = 1550,
    description = 'Ev kira desteği (Haziran · 5 Haziran''da ödendi)'
WHERE id = 'se-acelya-rent-2026-06';

DELETE FROM public.salary_extras
WHERE employee_id = 'emp-acelya'
  AND (month > '2026-06' OR id = 'se-acelya-adv-2026-07');

UPDATE public.employees
SET status = 'inactive',
    exit_date = '2026-06-29',
    payroll_end_month = '2026-06',
    exit_reason = 'termination',
    notes = '29 Haziran 2026 iş çıkışı. Haziran son bordro: floor($3.500×29/30) − $600 avans = $2.783 maaş; kira $1.550 (5 Haziran''da ödendi).'
WHERE id = 'emp-acelya';

UPDATE public.app_users SET active = false WHERE id = 'u-acelya';

INSERT INTO public.payment_statuses (employee_id, month, paid, paid_date, line_payments)
VALUES (
  'emp-lucy',
  '2026-06',
  true,
  '2026-07-01',
  '[{"lineId":"base","kind":"base_salary","label":"Temel maaş (oransal %60)","amountUsd":1800,"paid":true,"paidDate":"2026-07-01"},{"lineId":"rent","kind":"rent","label":"Kira desteği","amountUsd":500,"paid":true,"paidDate":"2026-07-01"}]'::jsonb
)
ON CONFLICT (employee_id, month) DO UPDATE SET
  paid = EXCLUDED.paid,
  paid_date = EXCLUDED.paid_date,
  line_payments = EXCLUDED.line_payments;

INSERT INTO public.payment_statuses (employee_id, month, paid, paid_date, line_payments)
VALUES (
  'emp-acelya',
  '2026-06',
  false,
  NULL,
  '[{"lineId":"rent","kind":"rent","label":"Kira desteği","amountUsd":1550,"paid":true,"paidDate":"2026-06-05"}]'::jsonb
)
ON CONFLICT (employee_id, month) DO UPDATE SET
  paid = EXCLUDED.paid,
  line_payments = EXCLUDED.line_payments;
