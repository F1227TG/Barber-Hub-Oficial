# Decisões técnicas — correções de 18 de setembro de 2026

## Falha ao salvar o estabelecimento

O erro de localização não era uma recusa do proprietário pela API ou pelo RLS.
O RPC `atualizar_localizacao_estabelecimento_110` chegava ao banco, mas o gatilho
de auditoria de `public.estabelecimentos` tentava ler a coluna
`estabelecimento_id`. Essa coluna existe nas tabelas filhas auditadas, enquanto a
própria tabela de estabelecimentos é identificada por `id`. O PostgreSQL então
interrompia a atualização com `SQLSTATE 42703` antes de persistir o endereço.

A migration `20260918114943_fix_establishment_audit_trigger.sql` substitui somente
o gatilho dessa tabela por uma função dedicada. A função continua registrando
quem alterou, valores anteriores/novos e o identificador da requisição, mas usa
`new.id` corretamente. Ela também cobre todos os campos modificados pela rota de
localização. Não foram abertas permissões, removidas políticas RLS ou alteradas
regras de propriedade.

Enquanto a migration não for aplicada no projeto Supabase, o ambiente publicado
continuará retornando erro ao salvar configurações auditadas. A migration é
transacional e pode ser executada novamente com segurança; quando o CLI for
autenticado, a respectiva entrada deverá ser registrada no histórico oficial de
migrations, sem editar migrations antigas.

## Qualidade e segurança no GitHub

O workflow `Qualidade e segurança` falhava porque dois validadores históricos
ainda procuravam um botão de “carregar mais” que foi substituído por paginação e
filtros no drawer de avaliações. As verificações agora exigem o carregamento
paginado, os controles Anterior/Próxima e os filtros atuais; portanto continuam
protegendo o comportamento em vez de apenas aceitarem texto antigo.

O auditor estrutural também passou a ignorar repositórios Git aninhados no
workspace. Isso evita que uma cópia local não rastreada seja analisada como parte
do site, sem deixar de verificar os arquivos efetivamente versionados.

A checagem de cron foi atualizada para o estado aprovado do produto: a manutenção
agendada permanece ativa e a entrega Web Push externa continua desativada até
aprovação operacional e configuração das credenciais necessárias. A rota direta
segue protegida para a etapa futura.

## Evidências desta etapa

- validação completa do comando de qualidade reproduzida com Node.js 22.23.2;
- 136 testes Python aprovados;
- validação estrutural aprovada para 100 páginas;
- auditoria de segurança V01–V06: 27/27 controles aprovados;
- auditoria de release 1.9: 32/32 invariantes aprovados.
