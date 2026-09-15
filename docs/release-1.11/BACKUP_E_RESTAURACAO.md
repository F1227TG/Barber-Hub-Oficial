# Runbook de backup e restauração — Barber Hub 1.11

## Objetivo

Garantir que uma mudança possa ser revertida sem improviso e que o backup seja realmente restaurável. “Backup habilitado” não equivale a “restauração testada”.

## Valores que precisam de decisão

| Parâmetro | Valor | Aprovador |
|---|---|---|
| RPO máximo aceitável | A definir | |
| RTO máximo aceitável | A definir | |
| Retenção de backup operacional | A definir conforme política LGPD/contrato | |
| Região/local de cópia | A definir | |
| Responsável primário | A definir | |
| Substituto | A definir | |

A release é **no-go** enquanto RPO, RTO e responsáveis permanecerem indefinidos.

## Escopo a proteger

1. PostgreSQL, incluindo schemas de aplicação, Auth, funções, triggers, grants, policies e histórico de migrations.
2. Objetos do Supabase Storage e seus metadados.
3. Configuração externa reproduzível: variáveis por nome/escopo, Auth URLs, Turnstile, Cron, VAPID, Advisors e feature flags. Registre referências; nunca copie segredos para este repositório.
4. Deployment conhecido como estável, commit e artefatos necessários ao rollback.
5. Evidências de auditoria e runbooks, com acesso restrito.

Confirme no fornecedor o que cada modalidade de backup inclui. Exportação lógica do banco pode não representar Storage, configuração de Auth, variáveis da Vercel ou segredos.

## Preparação

- [ ] Identificar ambiente e project ref sem expor credenciais.
- [ ] Confirmar espaço, criptografia, controle de acesso e prazo de retenção.
- [ ] Impedir que o artefato seja salvo em diretório público ou anexado a issue aberta.
- [ ] Registrar versão do schema, último migration id e commit.
- [ ] Verificar se o backup gerenciado/PITR está disponível no plano contratado.
- [ ] Escolher também uma cópia lógica apropriada à criticidade.
- [ ] Inventariar buckets/objetos e definir cópia separada quando necessário.
- [ ] Registrar configuração externa por nome, ambiente e checksum/versão, sem valores secretos.
- [ ] Definir janela sem escritas ou método de consistência quando a cópia exigir.

## Execução pré-release

1. Coloque mudanças administrativas não essenciais em pausa durante a captura, se necessário para consistência.
2. Inicie o backup pelo mecanismo aprovado do fornecedor ou ferramenta oficial.
3. Gere o inventário de schema e a lista de migrations aplicadas.
4. Capture o inventário de Storage e confirme a estratégia de recuperação dos arquivos.
5. Calcule checksum dos artefatos exportados.
6. Armazene-os em local criptografado e restrito.
7. Registre início, fim, tamanho, checksum, executor e qualquer aviso.
8. Faça uma verificação de leitura do artefato.

Não inclua chaves privadas, tokens de sessão ou senhas no pacote. Segredos devem ser recuperáveis pelo cofre/gestor autorizado, com procedimento separado.

## Ensaio de restauração

O ensaio deve ocorrer em projeto isolado, nunca sobre produção.

1. Crie ou identifique um ambiente vazio autorizado.
2. Restrinja rede e acesso; dados pessoais restaurados continuam sujeitos à LGPD.
3. Restaure banco e, quando aplicável, Storage.
4. Reaplique apenas configuração externa necessária ao teste por meio do cofre.
5. Valide a versão do schema e o histórico de migrations.
6. Execute o verificador correspondente à versão restaurada.
7. Compare contagens e invariantes, sem copiar dados pessoais para a evidência.
8. Teste Auth com contas sintéticas, RLS cross-tenant e um fluxo crítico de leitura/escrita.
9. Teste referências de arquivos sem tornar buckets privados públicos.
10. Meça tempo total e compare com RTO/RPO aprovados.
11. Destrua ou sanitize o ambiente de ensaio segundo a política de retenção.

## Critérios de sucesso da restauração

- [ ] Banco aceita conexões autorizadas.
- [ ] Schema, funções, triggers, grants e policies correspondem à versão esperada.
- [ ] Verificador pós-migration termina sem exceção.
- [ ] Contagens/invariantes escolhidas batem com o manifesto do backup.
- [ ] Auth funciona e nenhuma senha/hash foi exportada para documentação.
- [ ] Visitante não lê dados privados.
- [ ] Usuário A não lê ou altera dados do usuário/estabelecimento B.
- [ ] Objetos de Storage esperados existem e mantêm política correta.
- [ ] API e frontend compatíveis completam o smoke test.
- [ ] Tempo observado atende RTO e perda máxima atende RPO.

Se qualquer item falhar, o backup não pode ser chamado de “recuperável”.

## Restauração em incidente real

1. O comandante do incidente declara a necessidade e o ponto de recuperação aprovado.
2. Preserve logs e evidências antes de sobrescrever estado.
3. Interrompa escritas quando necessário para evitar nova divergência.
4. Confirme impacto de dados posteriores ao ponto escolhido e obtenha aceite do responsável de negócio.
5. Restaure em ambiente paralelo sempre que possível.
6. Valide segurança, integridade e compatibilidade antes de trocar tráfego.
7. Reabra o serviço gradualmente e acompanhe os sinais do runbook de monitoramento.
8. Registre dados perdidos/reprocessados, horários, responsáveis e comunicação.

## Exclusão, retenção e backups

- Exclusão no sistema ativo não remove automaticamente cópias históricas já feitas.
- A política deve definir quando backups contendo dados excluídos expiram e como impedir restauração permanente desses dados.
- Depois de uma restauração, reaplique solicitações de exclusão/anonimização ocorridas após o ponto recuperado, usando registro separado e protegido.
- Não use backup como arquivo permanente sem finalidade e prazo aprovados.

## Registro do ensaio

| Campo | Valor |
|---|---|
| Ambiente de origem | |
| Artefato/backup id | |
| Checksum | |
| Ponto de recuperação | |
| Ambiente isolado de destino | |
| Início/fim | |
| RPO observado | |
| RTO observado | |
| Resultado | Não executado |
| Defeitos | |
| Evidências | |
| Executor/aprovador | |
