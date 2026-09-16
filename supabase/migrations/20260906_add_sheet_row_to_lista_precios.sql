-- Guarda la fila original de la planilla de Google para poder escribir de vuelta
-- en ella cuando se edita un precio desde la web.

alter table public.gestion_jd_lista_precios
  add column if not exists sheet_row integer;

create unique index if not exists gestion_jd_lista_precios_sheet_row_idx
  on public.gestion_jd_lista_precios (app_source, sheet_row)
  where sheet_row is not null;

-- Backfill para quien ya haya corrido el seed anterior, que no tenia sheet_row.
-- sort_order es el orden con el que se importo la planilla, asi que alcanza para
-- mapear cada vehiculo a su fila. Es idempotente: reescribe los mismos valores.
update public.gestion_jd_lista_precios as p
set sheet_row = m.sheet_row
from (values
    (10, 4),
    (20, 5),
    (30, 6),
    (40, 7),
    (50, 10),
    (60, 11),
    (70, 12),
    (80, 13),
    (90, 14),
    (100, 15),
    (110, 19),
    (120, 20),
    (130, 23),
    (140, 26),
    (150, 27),
    (160, 28),
    (170, 30),
    (180, 31),
    (190, 33),
    (200, 34),
    (210, 35),
    (220, 36),
    (230, 37),
    (240, 38),
    (250, 39),
    (260, 41),
    (270, 42),
    (280, 43),
    (290, 44),
    (300, 45),
    (310, 46),
    (320, 49),
    (330, 50),
    (340, 53),
    (350, 57),
    (360, 61),
    (370, 62),
    (380, 65),
    (390, 66),
    (400, 69),
    (410, 72),
    (420, 73),
    (430, 74),
    (440, 75),
    (450, 76),
    (460, 77),
    (470, 78),
    (480, 79),
    (490, 82),
    (500, 83),
    (510, 86),
    (520, 87),
    (530, 88),
    (540, 89),
    (550, 91),
    (560, 92),
    (570, 93),
    (580, 96),
    (590, 99)
) as m (sort_order, sheet_row)
where p.app_source = 'gestion_jd'
  and p.sort_order = m.sort_order
  and p.sheet_row is distinct from m.sheet_row;
