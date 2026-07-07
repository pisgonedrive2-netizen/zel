-- Haziran 2026: Acelya tam ödendi; Ramiz bordro + içerik harcamaları ödendi işaretlendi.

-- Acelya: maaş $2.783 (7 Temmuz) + kira $1.550 (5 Haziran, zaten ödenmişti)
INSERT INTO public.payment_statuses (employee_id, month, paid, paid_date, line_payments)
VALUES (
  'emp-acelya',
  '2026-06',
  true,
  '2026-07-05',
  '[
    {"lineId":"base","kind":"base_salary","label":"Temel maaş (oransal %97)","amountUsd":2783,"paid":true,"paidDate":"2026-07-05"},
    {"lineId":"rent","kind":"rent","label":"Kira desteği","amountUsd":1550,"paid":true,"paidDate":"2026-06-05"}
  ]'::jsonb
)
ON CONFLICT (employee_id, month) DO UPDATE SET
  paid = EXCLUDED.paid,
  paid_date = EXCLUDED.paid_date,
  line_payments = EXCLUDED.line_payments,
  updated_at = now();

-- Ramiz: onaylı Haziran içerik harcamalarını ödendi işaretle
UPDATE public.content_expenses
SET paid = true,
    updated_at = now()
WHERE employee_id = 'emp-ramiz'
  AND month = '2026-06'
  AND review_status = 'approved'
  AND COALESCE(paid, false) = false;

-- Ramiz: bordro kalemleri (maaş + kira + içerik satırları) açıkça kayıtlı
WITH content_lines AS (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'lineId', 'content:' || ce.id,
        'kind', 'content_payroll',
        'label', CASE
          WHEN NULLIF(trim(ce.description), '') IS NOT NULL
            THEN 'İçerik · ' || trim(ce.description)
          ELSE 'İçerik · ' || ce.category
        END,
        'amountUsd', ce.amount_usd,
        'refId', ce.id,
        'paid', true,
        'paidDate', '2026-07-05'
      )
      ORDER BY ce.amount_usd DESC
    ),
    '[]'::jsonb
  ) AS lines
  FROM public.content_expenses ce
  WHERE ce.employee_id = 'emp-ramiz'
    AND ce.month = '2026-06'
    AND ce.review_status NOT IN ('rejected', 'cancelled')
)
UPDATE public.payment_statuses ps
SET
  paid = true,
  paid_date = '2026-07-05',
  line_payments = (
    jsonb_build_array(
      jsonb_build_object(
        'lineId', 'base',
        'kind', 'base_salary',
        'label', 'Temel maaş',
        'amountUsd', 7000,
        'paid', true,
        'paidDate', '2026-07-05'
      ),
      jsonb_build_object(
        'lineId', 'rent',
        'kind', 'rent',
        'label', 'Kira desteği',
        'amountUsd', 1400,
        'paid', true,
        'paidDate', '2026-07-05'
      )
    ) || (SELECT lines FROM content_lines)
  ),
  updated_at = now()
WHERE ps.employee_id = 'emp-ramiz'
  AND ps.month = '2026-06';
