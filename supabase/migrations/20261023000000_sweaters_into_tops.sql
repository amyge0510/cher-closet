-- SWEATERS is folded into TOPS: sweaters already filed move over.
update public.garments set category = 'tops', slot = 'top' where category = 'sweaters';
