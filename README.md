# NextFood

SaaS vertical para operações de alimentação, iniciando por lojas de açaí e preparado para expansão para sorveterias, lanchonetes, cafeterias e operações similares.

## Princípios

- Multi-tenant desde a base
- React + Next.js + TypeScript + Tailwind CSS
- PostgreSQL + Prisma
- Testes unitários, integração e E2E
- Observabilidade com OpenTelemetry e Sentry
- Segurança e governança por padrão
- Arquitetura AI-native com agents, skills, harness e evals
- Rastreabilidade entre regras de negócio, requisitos, implementação e testes

## Estrutura inicial

- `apps/web`: aplicação principal
- `packages/*`: módulos compartilhados
- `product`: visão, personas e restrições
- `requirements`: regras de negócio, RF, RNF e rastreabilidade
- `architecture`: arquitetura, segurança, observabilidade e ADRs
- `agents`: agentes especializados
- `skills`: capacidades reutilizáveis dos agentes
- `harness`: políticas de execução, contexto, permissões e orçamento
- `evals`: avaliações automatizadas
- `governance`: políticas de IA, dados e aprovação humana
- `tests`: integração, E2E e segurança

## Status

Projeto em bootstrap arquitetural.
