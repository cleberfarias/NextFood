# Tela Cardápio (`/configuracoes/cardapio`) — design

**Data:** 2026-09-25
**Status:** aprovado em conversa, aguardando revisão desta spec

## Objetivo

Permitir que o dono da loja defina, sem mexer em código, os preços e as regras do que vende: açaí por kg, copos prontos, produtos por unidade, complementos e embalagens. As mudanças ficam guardadas no navegador e o caixa passa a usá-las imediatamente. Continua o catálogo único de `2026-09-25-catalog-single-source-design.md`.

## Decisões

| Decisão | Escolha | Motivo |
|---|---|---|
| Onde as mudanças ficam | `localStorage` do navegador, num store único do catálogo | Sobrevive a recarregar; o Firestore substitui só o store depois. |
| Escopo | Editar e cadastrar produtos, complementos e embalagens; desativar em vez de apagar | A loja começa sem catálogo; apagar quebraria referências. |
| Validação | Toda gravação passa por `validateCatalog`; catálogo inválido nunca é salvo | Uma regra só para arquivo simulado, formulário e futuro backend. |
| Estoque | Lê a lista de itens do store; saldos e movimentações continuam só em memória | Guardar o estoque é etapa própria. |
| Formulário | Painel lateral (Radix Dialog), mesmo padrão do painel de movimentação | Consistência entre telas. |

## Fora de escopo

- Vender copo pronto e descontar tara no caixa (etapa de adaptação do caixa). Editar copo pronto e tara não muda nada visível no caixa ainda.
- Persistir saldos e movimentações do estoque.
- Cadastro/edição de itens de estoque pela tela de estoque (só a criação automática descrita abaixo).
- Permissão por perfil; banco de dados; sincronização entre computadores.

## Mudanças no modelo (`back/domain/catalog/catalog.ts`)

- `Packaging`, `Complement` e todas as variantes de `SaleProduct` ganham `active: boolean`. Todos os registros do catálogo simulado são `active: true`.
- `unitProducts(catalog)` passa a devolver só produtos `unidade` **ativos**. Nova `activeComplements(catalog)`: complementos ativos, na ordem do catálogo. `weighedProduct` não muda.
- Regras novas em `validateCatalog` (numeração continua a da spec anterior):
  11. Nome vazio ou só espaços em produto, complemento, embalagem ou item de estoque → "Informe o nome." (path do registro, ex.: `packagings[copo-300]`).
  12. Produto ativo usando embalagem desativada → "A embalagem {nome da embalagem} está desativada." (path `products[x].packagingId` ou `products[x].packagingIds`).
  13. O catálogo precisa ter exatamente um produto `peso`, e ele ativo → "O catálogo precisa de um açaí por peso ativo." (path `products`).

## Edições puras (`back/domain/catalog/catalog-edits.ts`)

Funções puras que recebem o catálogo atual e devolvem `EditResult = { ok: true; catalog: Catalog } | { ok: false; errors: CatalogError[] }`. Todas terminam chamando `validateCatalog` no catálogo resultante; se houver erro, devolvem `ok: false` e o catálogo original não muda.

- `slugId(name, existingIds): string` — minúsculas, sem acento, não alfanuméricos viram `-`, sem `-` nas pontas (ex.: "Copo 700 ml" → `copo-700-ml`); se já existir, acrescenta `-2`, `-3`… Nome sem nenhum caractere válido → `item`.
- `saveProduct(catalog, draft: SaleProduct, options?: { trackStock?: boolean })`
  - `draft.id === ""` → produto novo: id = `slugId(name, ids dos produtos)`, acrescentado ao fim de `products`. Criar produto `peso` é recusado com "Só pode existir um açaí por peso." (path `products`).
  - Produto novo `unidade` com `trackStock: true` → cria item de estoque `{ id: slugId(name, ids dos itens), name, category: "produto", unit: "un", balance: 0, minimum: 0 }` e acrescenta `{ itemId, quantity: 1 }` no início de `consumes`.
  - Id existente → substitui o registro no mesmo lugar (a ordem não muda). `kind` de um produto existente não pode mudar → "O tipo do produto não pode mudar." (path `products[x]`).
- `saveComplement(catalog, draft: Complement, options?: { stockUnit?: InventoryUnit })`
  - Novo (`id === ""`): id = `slugId`; cria item de estoque `{ category: "insumo", unit: stockUnit ?? "kg", balance: 0, minimum: 0 }` com id `slugId(name, ids dos itens)` e liga `stockItemId` a ele.
  - Existente: substitui no lugar; o nome do item de estoque ligado **não** muda junto (o estoque tem nome próprio).
- `savePackaging(catalog, draft: Packaging)`
  - Nova: id = `slugId`; cria item de estoque `{ category: "insumo", unit: "un", balance: 0, minimum: 0 }` e liga `stockItemId`.
  - Existente: substitui no lugar.
- `setActive(catalog, list: "products" | "complements" | "packagings", id, active)` — muda só `active`. Desativar o produto `peso` falha pela regra 13; desativar embalagem usada por produto ativo falha pela regra 12 (o dono desativa ou edita o produto primeiro).

## Store do catálogo (`front/features/catalog/catalog-store.ts`)

- Chave `nextfood:catalog:v1` no `localStorage`. Todo acesso ao `localStorage` fica em `try/catch`; se falhar (modo privado, bloqueio), o app funciona só em memória.
- `loadCatalog(): Catalog` — lê e faz `JSON.parse`; conteúdo ausente, corrompido ou que não passa em `validateCatalog` → devolve `CATALOG` (valores de exemplo) e não sobrescreve o que está guardado.
- `saveCatalog(next: Catalog)` — grava, troca o snapshot em memória e avisa os assinantes. Só é chamado com catálogo já validado (resultado `ok` das edições).
- `resetCatalog()` — remove a chave e volta a `CATALOG`.
- `useCatalog(): Catalog` — `useSyncExternalStore`, com snapshot do servidor = `CATALOG` (sem erro de hidratação: servidor e primeira renderização do cliente mostram os valores de exemplo; depois o cliente troca pelos guardados). O snapshot do cliente é o mesmo objeto enquanto nada muda.
- Escuta o evento `storage` para refletir mudanças feitas em outra aba.
- `catalogKey(catalog): number` — número estável por objeto de catálogo (um `WeakMap`); muda quando o catálogo é trocado, inclusive na hidratação (quando o snapshot passa dos valores de exemplo para os guardados sem nenhuma gravação). Usado pelo estoque como `key`.

## Quem lê o store

- **Caixa:** `pdv-experience.tsx` troca as constantes de módulo por `useCatalog()` dentro do componente: `unitProducts`, `weighedProduct(...).pricePerKg` e `activeComplements` (mapeados para `{ id, name, price: extraPrice }` como hoje). Itens já no carrinho mantêm o preço do momento em que entraram.
- **Estoque:** a página `/estoque` renderiza `<InventoryExperience key={catalogKey(catalog)} initialItems={catalog.stockItems} />`. Trocar o catálogo (hidratação ou edição em outra aba) remonta a tela; como isso só acontece antes de qualquer uso ou vindo de outra aba, a perda das movimentações em memória é aceitável nesta etapa.

## Tela

### `/configuracoes`

Deixa de ser "em breve". Cabeçalho no padrão do estoque (BrandMark com subtítulo "Configurações", link "Início"). Três cartões:
- **Cardápio** — "Preços, copos, complementos e embalagens." — link para `/configuracoes/cardapio`.
- **Usuários** e **Dados da loja** — com selo "Em breve", sem link.

### `/configuracoes/cardapio`

- Cabeçalho: BrandMark com subtítulo "Cardápio", links "Configurações" e "Início". Título "Cardápio" e o aviso "As mudanças ficam salvas neste navegador." ao lado do botão "Restaurar valores de exemplo".
- Abas (`role="tablist"`): **Produtos**, **Complementos**, **Embalagens**. Cada aba tem uma lista (`<ul aria-label="Produtos">` etc.), com `li` de `aria-label` = nome, e um botão "Novo produto" / "Novo complemento" / "Nova embalagem".
- Linhas:
  - Produto: nome; tipo ("Por peso", "Copo pronto", "Unidade"); preço ("R$ 39,90/kg" no peso, "R$ 15,00" nos demais); selo "Desativado" se inativo; botão "Editar {nome}".
  - Complemento: nome; "Adicional R$ 2,00"; selo; botão "Editar {nome}".
  - Embalagem: nome; "Tara 12 g"; selo; botão "Editar {nome}".
- Restaurar: abre confirmação (Radix Dialog) "Restaurar valores de exemplo? As mudanças salvas neste navegador serão apagadas." com "Cancelar" e "Restaurar".

### Painel de edição

Radix Dialog ancorado à direita com `.theme-light`, remontado (nova `key`) a cada abertura. Título "Editar {nome}" ou "Novo produto"/"Novo complemento"/"Nova embalagem".

Valores numéricos digitados passam por `parseQuantity` (aceita vírgula). Preços são mostrados com vírgula ("39,90"). Tara é digitada e mostrada em **gramas** e gravada em kg (`12` → `0.012`).

- **Novo produto:** primeiro um radiogroup "Tipo" com **Copo pronto** e **Unidade** (não há opção por peso).
- **Por peso:** Nome; "Preço por kg (R$)"; "Embalagens aceitas" (checkbox por embalagem ativa, mais as já marcadas mesmo se inativas); "Consumo por kg vendido" (editor de consumo, só itens em kg ou L).
- **Copo pronto:** Nome; "Preço (R$)"; "Embalagem" (select de embalagens ativas, mais a atual); "Complementos incluídos"; "Consumo por copo" (editor de consumo).
- **Unidade:** Nome; "Preço (R$)"; "Consumo por unidade" (editor de consumo); no produto novo, checkbox "Controlar estoque deste produto" (marcado por padrão).
- **Complemento:** Nome; "Adicional (R$)"; no novo, select "Unidade no estoque" (kg, L, un; padrão kg).
- **Embalagem:** Nome; "Tara (g)".
- **Editor de consumo:** uma linha por consumo com select "Item do estoque" (nome e unidade), campo "Quantidade ({unidade do item})" e botão "Remover"; botão "Adicionar consumo" acrescenta uma linha com o primeiro item permitido e quantidade vazia.
- **Ativo:** checkbox "Ativo" ao editar produto (exceto o por peso), complemento ou embalagem. Ele entra no mesmo salvamento (a edição grava o `draft` com o `active` escolhido; `setActive` fica para uso futuro e testes do domínio).
- Botões "Cancelar" e "Salvar". Salvar chama a edição correspondente:
  - `ok` → `saveCatalog`, fecha o painel e mostra "Alterações salvas." numa região `aria-live="polite"` da página.
  - `ok: false` → o painel continua aberto e as mensagens aparecem numa lista `role="alert"` acima dos botões, sem repetir mensagens iguais.

## Testes

- `catalog.test.ts`: regras 11, 12 e 13; `unitProducts` ignora inativos; `activeComplements`.
- `catalog-edits.test.ts`: `slugId` (acento, espaço, repetição, nome vazio); produto novo acrescentado com id gerado; produto `unidade` novo com `trackStock` cria item e consumo; criar `peso` recusado; mudar `kind` recusado; complemento novo cria item com a unidade escolhida; embalagem nova cria item `un`; edição mantém a ordem; edição inválida devolve erros e não muda o catálogo; `setActive` do `peso` recusado; desativar embalagem em uso recusado.
- `catalog-store.test.ts`: sem nada guardado → `CATALOG`; JSON corrompido → `CATALOG`; catálogo guardado inválido → `CATALOG`; `saveCatalog` persiste e `loadCatalog` devolve o salvo; `resetCatalog` volta ao exemplo; `useCatalog` re-renderiza após `saveCatalog`.
- `cardapio-editor.test.tsx`: editar o preço do açaí salva e a lista mostra o novo preço; preço inválido mantém o painel aberto com a mensagem; nova embalagem aparece na lista e cria o item de estoque; desativar complemento mostra o selo "Desativado"; o produto por peso não tem "Ativo"; restaurar volta os valores de exemplo; o painel reabre limpo depois de um erro.
- Caixa: com um catálogo salvo no store com outro preço de Copo 300 ml, o botão mostra o preço novo; complemento desativado não aparece.
- Estoque: item criado pelo Cardápio (salvo no store) aparece na lista.
- `configuracoes`: a página mostra o cartão Cardápio com link e os outros dois como "Em breve".
- Todos os testes limpam o `localStorage` e o store entre si.
