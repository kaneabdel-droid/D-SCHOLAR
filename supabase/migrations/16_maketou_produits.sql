CREATE TABLE IF NOT EXISTS public.maketou_produits (
    palier varchar(20) not null check (palier in ('elementaire', 'secondaire', 'complet')),
    pourcentage smallint not null check (pourcentage in (25, 50, 100)),
    product_id varchar(255) not null,
    updated_at timestamptz not null default now(),
    primary key (palier, pourcentage)
);
ALTER TABLE public.maketou_produits ENABLE ROW LEVEL SECURITY;
