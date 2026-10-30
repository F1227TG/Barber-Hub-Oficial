# Estabelecimentos de Jacinto — 30/10/2026

Importados do documento fornecido: 7 negócios e 41 serviços no Barber; 6 negócios e 36 serviços na Beauty. Foram criadas 13 contas pela API administrativa oficial, com senhas exclusivas entregues em arquivo privado local, fora do Git e dos deploys.

E-mails example.com são identificadores fictícios, sem recuperação por e-mail. Precisam ser substituídos pelos endereços dos responsáveis antes da transferência definitiva.

Dados preservados: preços, orçamento, contatos, Instagram, endereço em Jacinto/MG, intervalos e dias informados. As duas fichas sem horários permanecem exclusivamente mediante agendamento, sujeito a confirmação. Capas são ilustrativas; não representam fotos reais dos negócios. Não foram inventadas avaliações, verificações nem durações.

72 serviços não informam duração. Barber apresenta contato para confirmação pelo WhatsApp; Beauty aceita solicitações pelo fluxo de orçamento. Reservas automáticas exigem duração definida. Esse limite está explicado no arquivo de acessos.

Correções: duração nullable com proteção contra somas parciais; fechamento à meia-noite não cria intervalo vazio no dia seguinte; Beauty preserva períodos de almoço na edição e apresenta Instagram/Maps; Barber aceita múltiplos perfis de Instagram.

Barber: acesso Profissional concedido administrativamente aos sete cadastros para habilitar gestão/agenda; nenhuma cobrança criada. Braga e Leal não informaram nomes dos profissionais: exibem o nome do estabelecimento como responsável.

Validação: importações completas ensaiadas com rollback antes da gravação; contagens conferidas; testes PostgreSQL para duração variável, isolamento e reservas; verificações estruturais e de interface. Login interativo com CAPTCHA ainda exige teste humano; criação das contas foi confirmada pela API administrativa.

Advisors mantêm avisos sobre RPCs SECURITY DEFINER existentes e proteção contra senhas vazadas desativada. Nenhuma permissão nova foi concedida. Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection
