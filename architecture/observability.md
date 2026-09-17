# Observabilidade

## Objetivo

Garantir visibilidade sobre erros, desempenho e fluxos críticos sem expor dados sensíveis.

## Padrão

- OpenTelemetry para traces e métricas.
- Sentry para captura de erros e performance da aplicação web.
- Logs estruturados com correlação por request, tenant e usuário técnico quando seguro.

## Requisitos

- Toda requisição relevante deve possuir correlation id.
- Erros devem carregar contexto técnico suficiente para diagnóstico.
- Dados pessoais, tokens e secrets não podem ser registrados em logs/traces.
- Fluxos críticos devem possuir métricas de latência e erro.
- Incidentes devem ser rastreáveis até versão/commit quando possível.

## Primeiros fluxos observáveis

1. autenticação;
2. criação e fechamento de pedidos;
3. pagamentos;
4. abertura/fechamento de caixa;
5. movimentações de estoque;
6. falhas de isolamento multi-tenant.
