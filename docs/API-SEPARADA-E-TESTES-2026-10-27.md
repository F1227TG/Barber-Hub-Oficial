# API independente e verificação geral — 27/10/2026

## Entrega e limites

Repositório independente privado: [F1227TG/Barber-Hub-API](https://github.com/F1227TG/Barber-Hub-API). Cópia local: `.tools/barber-hub-api`. Contém FastAPI, domínio, serviços, integração Supabase, SQL histórico, migrations gerenciadas, contrato OpenAPI, testes e pipeline próprio. Não contém interface nem credenciais de produção.

A API foi instalada em ambiente próprio, com importação isolada comprovando que o pacote vem do novo repositório. As correções da interface estão neste checkout. A cópia antiga de backend permanece temporariamente para manter o deploy existente: **a troca de tráfego e a remoção dessa compatibilidade ainda não aconteceram**.

Atualização em 28/10: migração de contas aplicada em produção após autorização explícita. O Supabase atribuiu a versão `20261028151359_modernizacao_contas_administrativas`; os arquivos locais foram reconciliados com esse identificador, sem alterar o SQL anteriormente testado (`20261022155131`). O verificador 41 retornou os 12 controles verdadeiros e nenhuma tabela ficou sem a proteção de estado de conta. A CI da API independente passou.

A CI web apontou verificações de versão antigas e diferenças visuais entre Windows desktop e Windows Server; a aprovação local anterior não representa aprovação dessa execução remota. O CAPTCHA do navegador automatizado permanece pendente; não houve envio de recuperação nem comprovação de login real após a atualização da chave informada pelo usuário.

As verificações de versão foram corrigidas e as 16 verificações gerais passaram novamente, incluindo 19 testes JavaScript, 160 testes Python e o cenário transacional PostgreSQL/PGlite. Um único teste negativo de CAPTCHA, com desafio deliberadamente inválido e endereço reservado `.test`, retornou HTTP 400 `captcha_failed` / `invalid-input-response`, em lugar do antigo `invalid-input-secret`. Isso indica que a chave passou a ser aceita, mas não comprova o fluxo com desafio válido. Nenhum cadastro ou e-mail foi gerado por esse teste.

## Correções

- Cache de perfil não atravessa troca de usuário nem sobrevive à perda da sessão.
- Evento inicial de visitante anônimo preserva continuação do agendamento; logout explícito continua limpando os dados locais.
- Carregamento de perfil repete falhas transitórias, sem repetir negações de autorização.
- Cadastro com sessão e perfil ausente não anuncia sucesso nem redireciona de volta para login como se tivesse concluído.
- Mudança de e-mail não escreve um endereço pendente como confirmado no perfil.
- API preserva indisponibilidade/limitação do provedor de identidade, em vez de apresentar esses casos como sessão expirada.
- Resposta HTTP 200 com HTML ou JSON fora do contrato não vira sucesso silencioso na interface.
- CAPTCHA consulta a origem configurada da API, permite repetir configuração/carregamento após falha e não trata erro de configuração como proteção desabilitada.
- Destino padrão de recuperação passa a usar `www.barberhuboficial.com.br`; o alias antigo respondeu `DEPLOYMENT_NOT_FOUND` durante a auditoria.
- Monitoramento e carregamento de dados do painel deixam de disputar o mesmo texto de atualização.
- Preparação Google anterior permanece desativada até configuração real do provedor; não foi habilitada nesta entrega.

## Evidências

| Verificação | Resultado |
| --- | --- |
| Suíte geral do checkout web | 16 verificações aprovadas; 160 testes Python, 18 testes JavaScript e teste PostgreSQL/PGlite; regressão adicional de conta criada validada depois |
| Navegador, suite completa | 104 cenários: 103 passaram inicialmente; um revelou a corrida do painel |
| Painel após correção | Os 10 cenários de admin passaram, sem alterar snapshots nem tolerância |
| API independente | 148 testes Python aprovados; importação isolada, instalação com lockfile e teste transacional de banco aprovados |
| Páginas publicadas | 12 visitas: login, cadastro, recuperação, portal, planos e sobre em 390/1440 px; HTTP 200, sem erros de JS ou overflow |
| Serviços publicados | health, public-config e catalog/summary HTTP 200; perfil sem token HTTP 401, como esperado |
| Auth público | E-mail e cadastro habilitados; Google desabilitado; configuração observada de confirmação automática habilitada |

Os testes de formulários usam identidades sintéticas e respostas controladas para sucesso, erro e repetição. As verificações na web foram somente leitura. **Não comprovam login válido, criação de conta, recebimento de e-mail, gravação ou permissões com contas reais em produção.** O usuário disponibilizou e-mails de teste, mantidos fora dos artefatos versionados.

## Próxima publicação

1. Integrações Vercel e Supabase disponíveis. A criação do projeto Vercel da API retornou HTTP 403 pela integração; importar o repositório no painel e configurar a chave privada diretamente no ambiente do backend. Não enviar segredos pelo chat.
2. Migração de contas aplicada e verificada. A autenticação privada já dispõe de `sessao_conta_ativa`; concluir o teste real com CAPTCHA, sem reaplicar a migração antiga.
3. Importar Barber-Hub-API na Vercel, configurar variáveis somente no backend e validar perfil autenticado e operações. Preservar o mesmo banco.
4. Gerar o frontend com `python scripts/build_frontend.py --api-origin https://DOMINIO-REAL-DA-API --output CAMINHO-NOVO`. O comando exige uma URL real HTTPS; não há destino fictício ativado no site.
5. O artefato contém somente web/PWA e proxy de mesma origem para `/api/*`, sem Python, SQL ou segredos. Fazer preview e testar leitura, POST/PATCH, bearer token, CAPTCHA e cache. Transferir o cron somente na troca para evitar duplicação.
6. Validar login, cadastro, logout, recuperação e contas cliente/profissional com os e-mails de teste. Não desabilitar CAPTCHA nem controles de sessão para fazer o teste passar.
7. Publicar e retirar a compatibilidade antiga somente após comprovar os passos anteriores. Reversão: retornar ao deploy web/API anterior, sem desfazer banco nem recriar dados.

Evidências locais: `test-results/checks.json`, `test-results/general-browser/`, `test-results/admin-race-fix/`, `test-results/live-audit.json`, `test-results/live-public-pages.json`. Esses arquivos são ignorados pelo Git e podem não existir em outro computador.
