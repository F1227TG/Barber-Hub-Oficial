---
name: barberhub-release
description: Prepara, valida e documenta uma nova versão do Barber Hub antes de commit, migration e deploy.
---

# Skill: preparar uma versão do Barber Hub

Use esta skill ao finalizar uma release.

## Procedimento

1. Ler `ARCHITECTURE.md`, `docs/MAPA_DE_NAVEGACAO.md` e changelog recente.
2. Conferir se migrations novas são idempotentes e estão numeradas.
3. Executar:
   - `npm run check`
   - `python scripts/validate_project.py`
4. Verificar links, scripts, CSS, manifesto e Service Worker.
5. Atualizar:
   - versão em `package.json`;
   - cache em `service-worker.js`;
   - documentação da release;
   - mapa de navegação se necessário.
6. Não incluir `.env`, `.env.local`, chaves ou arquivos de assinatura.
7. Gerar ZIP preservando a pasta raiz do projeto.
8. Informar claramente se há migration pendente e variáveis de ambiente necessárias.
