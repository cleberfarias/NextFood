# RNF-SEC-001 — Isolamento multi-tenant

## Regra

Nenhum usuário autenticado pode consultar, alterar ou excluir dados pertencentes a outro tenant.

## Critérios de aceitação

- Toda operação de leitura e escrita em entidades de negócio deve validar `tenantId`.
- Consultas sem contexto de tenant devem falhar por padrão.
- Testes automatizados devem cobrir tentativa de acesso cruzado entre tenants.
- Logs e traces devem registrar o identificador técnico do tenant sem expor dados sensíveis.
- Revisões de segurança devem tratar ausência de filtro por tenant como bloqueadora.

## Rastreabilidade inicial

Relacionado a:
- arquitetura multi-tenant;
- camada de autorização;
- testes de integração;
- Security Agent;
- Code Reviewer Agent.
