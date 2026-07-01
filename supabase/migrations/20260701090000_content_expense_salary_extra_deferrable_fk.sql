-- İçerik harcaması ↔ bordro kalemi çembersel FK'sini DEFERRABLE yap.
-- content_expenses.salary_extra_id  → salary_extras(id)
-- salary_extras.content_expense_id  → content_expenses(id)
-- İki yönlü referans olduğundan, kayıtlar ayrı isteklerle/işlemlerle
-- yazılırken FK ihlali oluşabiliyordu. DEFERRABLE INITIALLY DEFERRED ile
-- kontrol işlem sonuna ertelenir; uygulama tarafı ayrıca bağlantıyı iki
-- fazda kurar (önce ana satır, sonra geri bağlantı).

ALTER TABLE public.content_expenses
  ALTER CONSTRAINT content_expenses_salary_extra_id_fkey DEFERRABLE INITIALLY DEFERRED;

ALTER TABLE public.salary_extras
  ALTER CONSTRAINT salary_extras_content_expense_id_fkey DEFERRABLE INITIALLY DEFERRED;
