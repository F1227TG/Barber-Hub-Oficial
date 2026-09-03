# Barber Hub 1.10.0 — relatório de segurança

## Auditoria diferencial V01–V06

| Achado | Estado | Evidência resumida | Dependência externa |
|---|---|---|---|
| V01 — moderação/visibilidade | Corrigido | suspensão administrativa separada, RLS pública e bloqueio de republicação | testar papéis no ambiente alvo |
| V02 — transições de agendamento | Corrigido | máquina de estados no banco; estados terminais falham fechados | executar migrations e testes reais |
| V03 — limites e concorrência | Corrigido | locks transacionais, entitlements e validação de plano no banco | plano/assinatura precisam estar configurados |
| V04 — curtidas e contadores | Corrigido | contador derivado, escrita direta bloqueada e reparo legado | observar integridade após migration |
| V05 — rate limit | Corrigido no código | escopos na API, identidade autenticada e cobertura das rotas novas | produção distribuída exige armazenamento compartilhado adequado |
| V06 — CAPTCHA/configuração | Parcialmente corrigido | configuração pública não expõe segredo; frontend/API preparados | habilitar e configurar Turnstile no provedor/deploy |

Os controles automatizados V01–V06 continuam aprovados. “Corrigido” no código não substitui aplicar migrations ou configurar serviços externos.

## Proteções novas da 1.10

- RLS em todas as tabelas novas;
- RPCs sensíveis sem execução por `anon`;
- `SECURITY DEFINER` com `search_path` vazio e nomes de schema explícitos;
- idempotência calculada no PostgreSQL para atendimento e despesa;
- importação com limite, hash, prévia, deduplicação e rejeição de fórmulas;
- feature flags invisíveis a usuários comuns e avaliadas por função autorizada;
- auditoria append-only, sem senha/token/segredo nos snapshots;
- anonimização automática de ator/estabelecimento excluído sem apagar a trilha;
- paginação e limites máximos contra consultas sem fronteira;
- localização apenas mediante autorização do navegador.

## Senhas

O Barber Hub **não grava uma cópia visualizável da senha**. O Supabase Auth guarda um hash não reversível. Hash não é criptografia recuperável; não serve para descobrir a senha original. Administradores podem enviar um link de redefinição, nunca ler a senha atual.

Criar uma coluna com senha “criptografada” e uma chave capaz de descriptografá-la aumentaria o impacto de vazamento, contrariaria boas práticas e não é necessário para autenticar. A tabela da aplicação pode guardar identificador, e-mail, papel, status e datas; a credencial pertence ao Auth.

## Dados pessoais e LGPD

Perfis, contatos, histórico, preferências e anotações são dados pessoais. Acesso deve seguir necessidade por papel, consentimento/canal e finalidade informada. Exportações e logs não devem conter tokens, chaves ou senhas. Exclusão deve remover ou anonimizar vínculos conforme obrigação legal e política de retenção.

## Pendências obrigatórias antes do deploy

- aplicar 29, 30 e 31 e aprovar o verificador 31;
- ativar CAPTCHA e proteção contra senhas vazadas quando disponível;
- revisar URLs de login/recuperação e origens da API;
- configurar VAPID/worker;
- revisar Advisors;
- testar RLS com contas separadas;
- definir retenção e resposta a incidentes;
- confirmar backup e recuperação.

