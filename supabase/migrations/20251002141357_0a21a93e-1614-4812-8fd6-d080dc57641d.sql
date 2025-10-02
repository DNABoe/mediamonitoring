-- Delete test articles
DELETE FROM items WHERE title_en LIKE '%Test%' OR title_pt LIKE '%Teste%' OR title_en LIKE '%Sample%';