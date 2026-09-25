# Tela de Estoque (`/estoque`) — design

**Data:** 2026-09-25
**Status:** aprovado em conversa, aguardando revisão desta spec

## Objetivo

Dar ao dono da loja uma visão de saldo de todos os produtos e insumos, destacar o que está no mínimo ou zerado, e permitir registrar movimentações (entrada, perda, ajuste e inventário) sempre com justificativa. Cobre os itens P0 `/estoque` e `/estoque/movimentacoes/nova` de `2026-09-23-acai-pdv-requirements-and-screen-plan.md`, nesta etapa com dados simulados.

## Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Origem dos dados | Simulados em memória, como o caixa | O emulador do Firebase não está disponível no ambiente atual; as regras ficam no domínio e o Firestore entra depois só como adaptador. |
| Onde se registra a movimentação | Painel lateral na própria `/estoque` | Com estado em memória, uma rota separada perderia o estado ao navegar. |
| Gestão de estado | Funções puras em `back/domain/inventory` + `useReducer` na tela | Não há outra tela lendo o estoque ainda; um store global seria complexidade sem uso. |

## Fora de escopo

- Cadastro e edição de itens (tela `/produtos`, etapa própria).
- Permissão por perfil para movimentar (depende de sessão/backend real).
- Baixa automática de insumos pelas vendas do caixa (ficha técnica, fase 3 do roadmap).
- Persistência real (Firestore, Server Actions, regras multi-tenant).

## Modelo de domínio (`back/domain/inventory/inventory.ts`)

Código em TypeScript puro: sem Next.js, React ou Firebase (regra de `back/architecture.test.ts`).

**`InventoryItem`**
- `id: string`
- `name: string`
- `category: "insumo" | "produto"`
- `unit: "kg" | "un" | "L"`
- `balance: number` (saldo atual)
- `minimum: number` (estoque mínimo configurado)

**`MovementInput`** (o que a tela envia)
- `type: "entrada" | "perda" | "ajuste" | "inventario"`
- `quantity: number`
- `reason: string` (justificativa)

**`Movement`** (o que fica registrado no histórico)
- `id`, `itemId`, `type`, `reason`, `author`, `createdAt`
- `delta: number`: variação efetiva no saldo (positiva ou negativa)
- `balanceAfter: number`

**Efeito de cada tipo sobre o saldo**
- `entrada`: `balance + quantity`
- `perda`: `balance - quantity`
- `ajuste`: `balance + quantity` (`quantity` pode ser negativa, mas não zero)
- `inventario`: o saldo passa a ser `quantity` (contagem física); `delta = quantity - balance`

**Validações** (em ordem; a primeira que falhar é retornada)
1. `reason` vazia após `trim()` → erro no campo `reason`: "Informe a justificativa."
2. `quantity` não numérica ou não finita → erro em `quantity`: "Informe uma quantidade válida." (um campo vazio conta como não numérico; nunca vira zero)
3. Item com unidade `un` e `quantity` fracionada → erro em `quantity`: "Use um número inteiro para itens em unidades." (adicionada na revisão do plano)
4. `entrada`/`perda` com `quantity <= 0` → erro em `quantity`: "A quantidade precisa ser maior que zero."
5. `ajuste` com `quantity === 0` → erro em `quantity`: "O ajuste não pode ser zero."
6. `inventario` com `quantity < 0` → erro em `quantity`: "A contagem não pode ser negativa."
7. Saldo resultante `< 0` → erro em `quantity`, com a mensagem citando o saldo atual, por exemplo "A perda de 3 kg é maior que o saldo de 2 kg."

**Funções**
- `applyMovement(item, input, meta: { id, author, createdAt })` retorna `{ ok: true, item, movement }` ou `{ ok: false, error: { field: "quantity" | "reason", message } }`. Nunca lança exceção para erro de negócio.
- `stockStatus(item)` retorna `"sem-estoque"` (saldo = 0), `"baixo"` (0 < saldo ≤ mínimo) ou `"ok"`.
- `sortByCriticality(items)` ordena: sem estoque, depois baixo, depois ok; dentro de cada grupo, por nome.
- `formatQuantity(value, unit)` formata em pt-BR (`kg` e `L` com até 3 casas decimais, `un` inteiro), por exemplo "1,2 kg" ou "40 un".

## Dados simulados (`front/features/inventory/inventory-mocks.ts`)

Polpa de açaí (kg), granola (kg), leite condensado (un), paçoca (un), banana (kg), morango (kg), confete (kg), copo 300 ml (un), copo 500 ml (un), colheres (un), pote 1 L (un), picolé cremoso (un, `produto`). Pelo menos um item começa zerado e dois começam abaixo do mínimo, para que a faixa de alerta apareça ao abrir a tela.

## Tela (`front/features/inventory/`)

Identidade visual do caixa: tokens `--brand-*`, fonte Fraunces nos títulos e escopo `.theme-light`. Cabeçalho com `BrandMark` ("Estoque"), link "Início" (`/dashboard`) e botão principal "Registrar movimentação".

- **Faixa de alerta:** visível só quando há itens baixos ou zerados. Lista cada um com saldo e mínimo, por exemplo "Polpa de açaí: 1,2 kg (mínimo 5 kg)". Um clique ativa o filtro "Só estoque baixo".
- **Filtros:** busca por nome (sem distinção de maiúsculas ou acentos), categoria (Todos, Insumos ou Produtos) e "Só estoque baixo".
- **Lista:** ordenada por `sortByCriticality`. No desktop é uma tabela com item, categoria, saldo, mínimo, status e botão "Movimentar"; no mobile vira cartões. Lista vazia após filtro mostra "Nenhum item encontrado com esses filtros." e um botão "Limpar filtros".
- **Painel de movimentação:** Radix Dialog ancorado à direita (portal com `.theme-light`, como o `PosDialog`). Tem:
  - seletor de item (pré-preenchido quando aberto pelo "Movimentar" de uma linha);
  - tipo em controle segmentado;
  - quantidade, com rótulo que muda conforme o tipo: "Quantidade recebida", "Quantidade perdida", "Diferença (+ ou −)" ou "Contagem física";
  - justificativa;
  - prévia, por exemplo "O saldo vai de 1,2 kg para 11,2 kg";
  - botão "Salvar movimentação".
  Erro do domínio aparece sob o campo indicado e o painel fica aberto. Ao salvar com sucesso, o painel fecha e lista, alerta e histórico atualizam.
- **Movimentações recentes:** as 10 mais recentes, da mais nova para a mais antiga, com tipo, item, variação com sinal, justificativa e horário. Autor fixo: "Usuário local (simulação)".
- **Estado:** `useReducer` com `{ items, movements }` e ação `movementApplied`. O reducer só aplica resultados que `applyMovement` já validou.

Arquivos: `inventory-experience.tsx` (tela e estado), `inventory-ui.tsx` (faixa, linha/cartão, badge, histórico), `movement-panel.tsx` (painel). `app/estoque/page.tsx` passa a renderizar `InventoryExperience` no lugar do placeholder.

## Testes

**Domínio** (`back/domain/inventory/inventory.test.ts`, `@vitest-environment node`)
- Cada tipo de movimentação produz o saldo, `delta` e `balanceAfter` corretos.
- Cada validação da lista acima retorna o campo e a mensagem esperados.
- `stockStatus` nas fronteiras: 0, igual ao mínimo, acima do mínimo.
- `sortByCriticality` e `formatQuantity`.

**Tela** (`front/features/inventory/inventory-experience.test.tsx`, Testing Library)
- A faixa de alerta lista os itens baixos e zerados dos dados simulados.
- Clicar na faixa ativa o filtro de estoque baixo.
- Registrar uma entrada pelo painel atualiza o saldo e tira o item do alerta quando ele passa do mínimo.
- Justificativa vazia mantém o painel aberto e mostra a mensagem.
- A movimentação aparece em "Movimentações recentes".

**Navegador:** layout desktop e mobile, hovers com as cores da marca, fluxo completo de registrar uma movimentação.
