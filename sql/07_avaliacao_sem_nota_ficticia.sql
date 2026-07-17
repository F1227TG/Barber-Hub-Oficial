-- Até o módulo de avaliações verificadas ficar pronto, nenhum estabelecimento
-- deve começar exibindo nota máxima fictícia.
alter table public.estabelecimentos alter column avaliacao set default 0;
update public.estabelecimentos set avaliacao = 0 where avaliacao = 5.0;
