# Catálogo único (produtos, embalagens, complementos e insumos) — design

**Data:** 2026-09-25
**Status:** aprovado em conversa, aguardando revisão desta spec

## Objetivo

Ter uma única fonte de dados para o que a loja vende e para o que ela guarda em estoque, e registrar nela o que cada venda consome do estoque. É o primeiro passo do catálogo previsto em `2026-09-23-acai-pdv-requirements-and-screen-plan.md` (`/produtos`, ficha técnica). Hoje o caixa (`front/features/pos/pos-mocks.ts`) e o estoque (`front/features/inventory/inventory-mocks.ts`) têm listas separadas e desconectadas.

Nesta etapa o comportamento das telas não muda: o caixa e o estoque passam a ler o catálogo e funcionam como hoje. A única diferença visível é a Casquinha, item novo na lista do estoque.

## Como a loja vende (base do modelo)

A loja funciona como uma sorveteria:

| Forma de venda | Exemplo | Preço | O que sai do estoque |
|---|---|---|---|
| **Montado por peso** (`peso`) | O cliente monta o açaí num copo ou numa casquinha e pesa | R$/kg sobre o peso líquido (peso na balança menos a tara da embalagem); os complementos já entram no peso | 1 embalagem escolhida + polpa estimada por kg vendido |
| **Copo pronto** (`pronto`) | Copo 500 ml com açaí e 3 complementos por R$ 15,00 | Preço fixo; cada complemento além dos incluídos cobra o adicional daquele complemento | 1 embalagem fixa + consumos fixos por copo (polpa estimada, colher) |
| **Unidade** (`unidade`) | Copo 300 ml, pote 1 L, picolé | Preço fixo | Consumos fixos por unidade |

Complementos não têm baixa automática: no montado por peso não há como saber quanto de cada um foi usado, e no copo pronto a porção varia. O saldo deles é corrigido pelo **Inventário** (contagem física) da tela de estoque. A polpa usa estimativa (fator por kg ou quantidade por copo) que o dono ajusta depois; o inventário corrige a diferença.

## Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Onde fica o modelo | `back/domain/catalog/catalog.ts`, TypeScript puro | Mesma regra de camadas do estoque; o Firestore entra depois como adaptador. |
| Onde ficam os dados simulados | Um arquivo só, `front/features/catalog/catalog-mocks.ts` | Acaba com a duplicação entre caixa e estoque. |
| Tipo do item de estoque | Reaproveita `InventoryItem` de `back/domain/inventory/inventory.ts` | O estoque já usa esse tipo e suas regras de movimentação. |
| Consumo de complementos | Nenhum automático; inventário | Não é mensurável por venda (vai dentro do peso). |
| Consumo de polpa | Estimado: fator por kg no `peso`, quantidade fixa no `pronto` | Mantém o alerta de reposição útil; o inventário corrige. |
| Preço de complemento | `extraPrice`: vale para o extra no copo pronto e, até o caixa ser adaptado, para o complemento cobrado à parte como hoje | O caixa atual cobra cada complemento; ele só muda numa etapa própria. |

## Fora de escopo

- Tela Cardápio em Configurações (editar preço, tara, fatores) — próxima etapa.
- Mudar o caixa para o modelo acima (escolher embalagem, descontar tara, vender copo pronto, complementos incluídos) — etapa própria, junto com o Cardápio.
- Calcular e aplicar a baixa por venda no estoque (movimentação "Venda") — etapa própria.
- Cadastro de itens de estoque e edição de mínimo pela tela de estoque — etapa própria.
- Persistência real.

## Modelo de domínio (`back/domain/catalog/catalog.ts`)

Sem Next.js, React ou Firebase (regra de `back/architecture.test.ts`).

**`StockUsage`** — `{ itemId: string; quantity: number }`: quanto sai do item de estoque `itemId`, na unidade do item.

**`Packaging`** (embalagem) — `{ id; name; stockItemId; tareKg }`
- `stockItemId`: o item de estoque consumido (1 unidade) a cada venda com essa embalagem.
- `tareKg`: peso da embalagem vazia, descontado na balança.

**`Complement`** — `{ id; name; extraPrice; stockItemId }`
- `extraPrice`: valor cobrado por complemento extra (em R$).
- `stockItemId`: o item de estoque correspondente, só para ligação (sem baixa automática).

**`SaleProduct`** — união discriminada por `kind`, todos com `id` e `name`:
- `{ kind: "peso"; pricePerKg; packagingIds: string[]; consumesPerKg: StockUsage[] }` — `consumesPerKg` é por kg líquido vendido.
- `{ kind: "pronto"; price; packagingId; includedComplements; consumes: StockUsage[] }` — `consumes` é por copo, além da embalagem.
- `{ kind: "unidade"; price; consumes: StockUsage[] }` — `consumes` é por unidade vendida.

**`Catalog`** — `{ stockItems: InventoryItem[]; packagings: Packaging[]; complements: Complement[]; products: SaleProduct[] }`.

**`validateCatalog(catalog): CatalogError[]`** — `CatalogError = { path: string; message: string }`, lista vazia quando está tudo certo. `path` aponta o registro, por exemplo `products[copo-pronto-500].consumes[0]`. Regras:

1. Id repetido dentro de cada lista → "Id repetido: {id}."
2. Referência para item de estoque ou embalagem inexistente → "Item de estoque não encontrado: {id}." / "Embalagem não encontrada: {id}."
3. Preço (`pricePerKg`, `price`) ≤ 0 → "O preço precisa ser maior que zero." `extraPrice` < 0 → "O adicional não pode ser negativo."
4. `tareKg` < 0 → "A tara não pode ser negativa."
5. `includedComplements` negativo ou fracionado → "Informe um número inteiro de complementos incluídos."
6. `quantity` de consumo ≤ 0 → "O consumo precisa ser maior que zero."
7. Consumo fracionado em item de estoque `un` (em `pronto` e `unidade`) → "Use um número inteiro para itens em unidades."
8. `consumesPerKg` apontando para item `un` → "Consumo por kg só vale para itens em kg ou L."
9. Embalagem cujo item de estoque não é `un` → "A embalagem precisa ser um item contado em unidades."
10. Produto `peso` sem embalagem → "Informe ao menos uma embalagem."

Todos os valores numéricos também precisam ser finitos; `NaN`/`Infinity` caem na regra do campo correspondente.

## Dados simulados (`front/features/catalog/catalog-mocks.ts`)

Exporta `CATALOG: Catalog`.

- **`stockItems`:** os 12 itens atuais de `INVENTORY_ITEMS`, com os mesmos valores, mais **Casquinha** (`casquinha`, insumo, `un`, saldo 60, mínimo 20). O leite condensado continua `un`.
- **`packagings`:** Copo 300 ml (`copo-300`, tara 0,012 kg), Copo 500 ml (`copo-500`, tara 0,018 kg), Casquinha (`casquinha`, tara 0,010 kg), cada uma ligada ao item de estoque de mesmo id.
- **`complements`:** os 6 atuais com o preço de hoje como `extraPrice` (Banana 2,00; Granola 2,50; Leite condensado 2,50; Paçoca 2,50; Morango 3,50; Confete 2,00), ligados ao item de estoque de mesmo id.
- **`products`**, nesta ordem:
  - `acai-peso` — Açaí por peso, `peso`, R$ 39,90/kg, embalagens copo-300, copo-500, casquinha, consome 0,8 kg de polpa por kg.
  - `copo-pronto-500` — Copo pronto 500 ml, `pronto`, R$ 15,00, embalagem copo-500, 3 complementos incluídos, consome 0,35 kg de polpa e 1 colher.
  - `copo-300` — Copo 300 ml, `unidade`, R$ 14,90, consome 1 copo 300 e 1 colher.
  - `pote-1l` — Pote de sorvete 1 L, `unidade`, R$ 29,90, consome 1 pote 1 L.
  - `picole` — Picolé cremoso, `unidade`, R$ 6,50, consome 1 picolé.

Os valores de tara, fator de polpa e porção são estimativas simuladas; o dono ajusta na tela Cardápio.

## Quem lê o catálogo

- **Caixa (`pdv-experience.tsx`):**
  - botões de produto: os `products` com `kind: "unidade"`, na ordem do catálogo (Copo 300 ml, Pote, Picolé, como hoje);
  - preço do açaí por peso: `pricePerKg` do produto `acai-peso`;
  - complementos: `complements`, com `extraPrice` como preço (comportamento atual).
  - O copo pronto e as embalagens ainda não aparecem no caixa.
  - `pos-mocks.ts` fica só com `MOCK_SCALE` e os tipos `CartItem`/`PaymentMethod`.
- **Estoque (`inventory-experience.tsx`):** lista inicial = `CATALOG.stockItems`. `inventory-mocks.ts` fica só com `MOVEMENT_AUTHOR`.
  - A Casquinha passa a aparecer na lista (13 itens). Ela não fica abaixo do mínimo, então o alerta continua com 4 itens.

O domínio do catálogo exporta duas funções de leitura para o caixa, que não filtra `kind` por conta própria:
- `unitProducts(catalog)` — os produtos `unidade`, na ordem do catálogo;
- `weighedProduct(catalog)` — o primeiro produto `peso`; lança erro se não houver (o catálogo simulado sempre tem um).

## Testes

- `catalog.test.ts`: um teste por regra de `validateCatalog`, sempre partindo de um catálogo válido mínimo e quebrando uma coisa só; e um teste de que um catálogo válido devolve lista vazia.
- `catalog.test.ts` também cobre `unitProducts` (filtra e mantém a ordem) e `weighedProduct` (encontra e lança sem produto `peso`).
- `catalog-mocks.test.ts`: `validateCatalog(CATALOG)` devolve lista vazia.
- Testes existentes do caixa e do estoque continuam passando; os do estoque que contam itens da lista mudam de 12 para 13 (Casquinha), e isso é a única mudança esperada neles.
