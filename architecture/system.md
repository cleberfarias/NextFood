# Arquitetura do Sistema

## Objetivo

O NextFood é um SaaS vertical para operações de alimentação. A primeira vertical é açaí, mas o núcleo deve suportar sorveterias, lanchonetes, cafeterias e operações semelhantes.

## Arquitetura de aplicação

- Next.js + React + TypeScript no frontend e camada web.
- PostgreSQL como banco relacional.
- Prisma como ORM.
- Zod para validação de entrada e contratos.
- Multi-tenancy baseado em `tenantId` e, quando aplicável, `storeId`.
- Serviços de domínio isolados da camada de interface.

## Camada AI-native

A IA é usada para apoiar engenharia e evolução do produto, não para tornar fluxos críticos dependentes de LLM.

Componentes:

- Orchestrator: seleciona agentes por contexto.
- Context Engine: monta contexto mínimo e rastreável.
- Skills: procedimentos versionados e reutilizáveis.
- Agents: architect, planner, frontend, backend, qa, security e reviewer.
- Harness: permissões, orçamento, retries, ferramentas e critérios de conclusão.
- Evals: validação de comportamento dos agentes e aderência a requisitos.
- Model Gateway: camada futura para OpenRouter e múltiplos modelos.

## Regras arquiteturais

1. Todo acesso a dados de negócio deve ser filtrado por tenant.
2. Código de domínio não deve depender diretamente da UI.
3. Alterações críticas exigem teste automatizado.
4. Agentes não podem executar ações de produção sem aprovação humana.
5. Observabilidade deve cobrir erro, latência, tracing e contexto de tenant sem vazar dados sensíveis.
