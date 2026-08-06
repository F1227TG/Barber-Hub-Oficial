# Decisões técnicas da versão 1.5

## Por que Python/FastAPI

A API própria foi criada em Python para centralizar validação, autorização,
operações sensíveis e documentação. O código usa FastAPI, modelos Pydantic e
I/O assíncrono com `httpx`.

Python não foi escolhido com a afirmação de que JavaScript “não possui
concorrência”. Ambos conseguem atender muitas requisições de rede. No CPython,
threads tradicionais são especialmente úteis para tarefas de I/O, enquanto o
GIL limita ganhos em processamento pesado na configuração padrão. Para as
chamadas ao Supabase, `async` é mais simples e adequado neste momento.

## Por que o Supabase continua

API própria não significa recriar banco, autenticação e armazenamento. O
Supabase permanece como infraestrutura de dados. A API Barber Hub controla o
contrato público e as regras que não devem morar no navegador.

## Por que senhas não aparecem

O Supabase guarda hashes bcrypt, não senhas reversíveis. O painel oferece envio
de recuperação ao titular. Exibir senha exigiria armazenar texto puro ou criar
um mecanismo inseguro, o que não faz parte do produto.

## Compatibilidade

O navegador ainda possui alguns fallbacks autenticados para RPC durante o
desenvolvimento estático. Em produção, as operações sensíveis priorizam
`/api/v1`. Esses fallbacks podem ser removidos gradualmente depois da validação
da API em produção.
