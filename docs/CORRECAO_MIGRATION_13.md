# Correção da migration 13

A primeira edição da migration 13 tentava atualizar avaliações existentes enquanto o gatilho `avaliacoes_validar` ainda estava ativo. Isso gerava o erro `Você não pode alterar esta avaliação`.

A versão corrigida pausa somente esse gatilho durante a conversão dos registros antigos e o reativa dentro da mesma transação. Execute `sql/13_modais_status_avaliacoes_comunidade.sql` inteiro após a migration 12.
