-- NftGiftCase case builder defaults. Safe to rerun: all inserts/updates are idempotent.
-- Old starter crates are hidden so the owner can focus on the five requested cases.
UPDATE cases SET active=0 WHERE id IN ('crate-blue','crate-orange','legend');

INSERT OR IGNORE INTO cases(id,title,description,image_url,price_xtr,is_free,active,max_opens,sort_order) VALUES
 ('rich-case','Rich Case','Золотая коллекция предметов','case-rich.png',39,0,0,NULL,10),
 ('durov-case','Durov Case','Коллекция в стиле Telegram','case-durov.png',39,0,0,NULL,20),
 ('march-8-case','8 March Case','Праздничная женская коллекция','case-march-8.png',39,0,0,NULL,30),
 ('halloween-case','Halloween Case','Мрачная коллекция редких подарков','case-halloween.png',39,0,0,NULL,40),
 ('daily-case','Daily Case','Ежедневная коллекция подарков','case-daily.png',39,0,0,NULL,50);
