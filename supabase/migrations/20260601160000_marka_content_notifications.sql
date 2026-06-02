-- Marka paneli: içerik paylaşımı ve teslimat bildirimleri
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'content_published';
ALTER TYPE notification_type ADD VALUE IF NOT EXISTS 'deliverable_late';
