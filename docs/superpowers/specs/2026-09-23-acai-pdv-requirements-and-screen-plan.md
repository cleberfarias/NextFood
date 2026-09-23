# Açaí PDV — requisitos e planejamento de telas

Status: discovery registrado; pronto para refinamento antes da implementação
Data: 2026-09-23
Meta operacional informada: 2026-10-01
Relacionados: [arquitetura web front/back](2026-09-17-web-front-back-architecture-design.md), [login e autenticação](2026-09-17-login-auth-and-chef-experience-design.md), [arquitetura do sistema](../../../architecture/system.md)

## Contexto do cliente

Operação inicial de açaí e sorvete, empresa MEI, sem sistema anterior, estoque ou catálogo a migrar. A venda será à vista, em dinheiro, débito e crédito. Haverá três usuários nominais e um usuário geral inicialmente, com possibilidade de ampliação futura.

O sistema deve estar apto a operar no caixa mesmo durante indisponibilidade temporária de internet, preferencialmente com sincronização posterior. Computador/tablet e impressora ainda serão adquiridos.

## Requisitos funcionais consolidados

### Venda / PDV

- Vincular uma balança USB à loja e ao PDV para receber automaticamente a pesagem de açaí e sorvete; a tara é configurada na própria balança.
- Registrar na venda o peso recebido, o preço por quilo vigente, o valor calculado e a identificação/estado da balança usada.
- Permitir lançamento manual somente como contingência para indisponibilidade da balança e para ajustes autorizados; a venda deve guardar o motivo desse uso manual.
- Vender itens por unidade: copos em vários tamanhos, potes de sorvete, picolés e outros produtos cadastrados.
- Aceitar pagamento em dinheiro, cartão de débito e crédito, inclusive pagamento dividido entre mais de uma forma.
- Concluir a venda com recibo; oferecer emissão de cupom fiscal quando o cliente exigir, desde o início do sistema.
- Imprimir recibo de venda em impressora térmica ao concluir a venda e imprimir/reimprimir o cupom fiscal quando ele for emitido.
- Consultar, cancelar e registrar o motivo de uma venda já realizada.
- Exigir senha de cancelamento compartilhável, com troca diária ou semanal; registrar quem solicitou, quem autorizou e quando.

### Catálogo e estoque

- Cadastrar produtos de venda e insumos, pois não existe catálogo inicial.
- Controlar estoque de todos os produtos e insumos, incluindo polpa de açaí e complementos.
- Registrar entradas, saídas, perdas/ajustes e consumo de insumos decorrente das vendas.
- Exibir alerta dentro do sistema quando o saldo atingir o estoque mínimo configurado.

### Pessoas, acesso e gestão

- Oferecer login individual para três usuários iniciais e suportar criação futura de outros usuários.
- Manter um usuário geral inicial, mas não usar uma identidade genérica como substituta da trilha de auditoria em operações críticas.
- Permitir gestão de catálogo, estoque, usuários e configurações por perfis autorizados.
- Exibir resumo de caixa, vendas, cancelamentos e alertas de estoque baixo.

## Requisitos não funcionais e restrições

| Tema | Decisão / necessidade |
| --- | --- |
| Multiempresa | Usar o modelo atual `tenant → store`; toda leitura e escrita é filtrada pelo estabelecimento confiável da sessão. |
| Segurança | Autorização é resolvida no servidor; senha de cancelamento é armazenada como hash e nunca enviada ao cliente ou registrada em log. |
| Auditoria | Venda, pagamento, cancelamento, ajuste de estoque, emissão fiscal e alteração de permissões têm evento imutável com ator, data e contexto. |
| Offline | PDV precisa de fila local durável, identificadores idempotentes, sincronização e resolução explícita de conflitos. Não prometer emissão fiscal offline sem validar a regra fiscal e a integração escolhida. |
| Balança USB | A balança é fonte vinculada de pesagem, não apenas um campo do formulário. Criar adaptador de dispositivo, pareamento por loja/caixa, leitura de peso estável, estado de conexão e tela de diagnóstico; validar protocolo, driver, sistema operacional e modelo antes de fechar o fluxo automático. |
| Impressora térmica | Vincular a impressora ao caixa, testar conexão e papel, suportar impressão de recibo e cupom fiscal, reimpressão autorizada e registro de falhas/pendências. Validar modelo, conexão (USB, rede ou Bluetooth), largura de papel e linguagem do equipamento. |
| Fiscal | Cupom fiscal depende de UF, regime/obrigações do MEI, tipo de documento aplicável, certificado/credenciais e provedor homologado. Recibo não substitui documento fiscal quando houver obrigação. |
| Pagamento | A primeira versão deve registrar formas de pagamento; integração com adquirente/TEF exige escolha de hardware/provedor e fluxo de conciliação. |
| Disponibilidade | O modo offline deve deixar claro o estado de sincronização e impedir operações que dependam de autorização externa. |

## Mapa de telas

| Prioridade | Rota sugerida | Tela | Responsabilidade principal |
| --- | --- | --- | --- |
| P0 | `/login` | Login | Autenticação individual; já iniciada. |
| P0 | `/onboarding` | Configuração inicial | Empresa/loja, dados fiscais, usuários iniciais, formas de pagamento, impressora e estoque mínimo padrão. |
| P0 | `/pdv` | Frente de caixa | Buscar/adicionar itens, peso da balança ou manual, carrinho, pagamentos múltiplos, finalizar e imprimir recibo térmico. |
| P0 | `/pdv/pagamento` | Pagamento da venda | Distribuir valores por forma de pagamento, validar total e confirmar. Pode ser painel/modal no PDV em vez de rota. |
| P0 | `/vendas/[saleId]` | Detalhe/recibo/cupom | Histórico da venda, impressão, status fiscal e opção autorizada de cancelamento. |
| P0 | `/caixa` | Sessão e fechamento de caixa | Abrir caixa, resumo por pagamento, sangria/suprimento, divergência e fechamento. |
| P0 | `/produtos` | Catálogo | Produtos por peso/unidade, preços, tamanhos, fichas técnicas e estoque mínimo. |
| P0 | `/estoque` | Visão de estoque | Saldos, alertas de baixo estoque e filtros. |
| P0 | `/estoque/movimentacoes/nova` | Movimentação de estoque | Entrada, perda, ajuste e inventário, sempre com justificativa. |
| P1 | `/fiscal` | Documentos fiscais | Fila de emissão, status, reimpressão/contingência e consulta de documentos. |
| P1 | `/relatorios` | Gestão | Vendas, meios de pagamento, cancelamentos, produtos e estoque. |
| P1 | `/usuarios` | Usuários e permissões | Criar/desativar usuários, perfis e redefinir acesso. |
| P1 | `/configuracoes/dispositivos` | Balança e impressora | Vincular/desvincular a balança à loja/caixa, testar leitura, exibir conexão/tara e definir impressora. |
| P1 | `/configuracoes` | Configurações da loja | Política da senha de cancelamento, pagamentos e dados fiscais; concentra o acesso às configurações de dispositivos. |

## Fluxo crítico: venda no PDV

```text
abrir caixa → incluir item por peso ou unidade → revisar carrinho
  → dividir/confirmar pagamentos → concluir venda
  → baixar estoque e criar auditoria → recibo sempre
  → cupom fiscal somente quando solicitado e permitido pela configuração fiscal
```

Em modo offline, a conclusão fica marcada como `pendente de sincronização`. O sistema pode imprimir um recibo local conforme a política da loja, mas a emissão/validação fiscal fica pendente até haver conectividade e o provedor confirmar o documento.

### Fluxo de pesagem vinculada

```text
PDV seleciona item por peso → consulta a balança vinculada ao caixa
  → confirma conexão e peso estável → recebe peso em kg
  → aplica preço/kg cadastrado → exibe valor calculado
  → atendente confirma inclusão no carrinho → persiste peso, preço e origem da leitura
```

O PDV deve apresentar de forma inequívoca: `Balança conectada`, `Aguardando peso`, `Peso instável` ou `Balança indisponível`. Só então o botão de lançamento manual aparece, com registro obrigatório da justificativa. A leitura não deve ser aceita quando estiver instável, negativa, acima do limite configurado ou quando a configuração não corresponder ao dispositivo esperado.

## Referência do protótipo

Protótipo analisado: [Ponto do Açaí](https://claude.ai/artifact/Pj157Qyvo6wbkLcGh6Pd15).

Ele propõe quatro áreas principais — **Caixa**, **Estoque**, **Financeiro** e **Configurações** — e, no Caixa, apresenta pesagem, preço/kg, subtotal, carrinho e escolha de pagamento. Essa estrutura é uma boa referência de navegação para o P0. O controle de `+50g`, `+100g`, `+250g` e o campo de peso devem permanecer somente como contingência ou instrumento de teste: na operação normal, o peso exibido vem da balança vinculada.

## Organização proposta no projeto

Manter a convenção já aprovada, sem concentrar lógica de produto em `app/`:

```text
apps/web/app/
  (protected)/pdv/page.tsx
  (protected)/caixa/page.tsx
  (protected)/produtos/page.tsx
  (protected)/estoque/page.tsx
  (protected)/vendas/[saleId]/page.tsx
  (protected)/fiscal/page.tsx
  (protected)/usuarios/page.tsx
  (protected)/configuracoes/page.tsx
front/features/
  pos/                 # carrinho, leitura de peso, pagamento, impressão térmica, estado offline
  cash-register/       # abertura/fechamento e movimentos de caixa
  catalog/             # catálogo e ficha técnica
  inventory/           # saldo, alertas e movimentações
  sales/               # histórico, detalhe e cancelamento
  fiscal/              # estado de emissão e reimpressão
  devices/             # vínculo da balança e impressora, diagnóstico, leitura de peso e impressão
  users/               # administração de usuários
  store-settings/      # dispositivo, pagamento e configuração da loja
back/domain/
  sales/ inventory/ catalog/ cash-register/ fiscal/ users/ devices/
back/data/
  sales/ inventory/ catalog/ cash-register/ fiscal/ users/ devices/
back/actions/
  sales.ts inventory.ts catalog.ts cash-register.ts fiscal.ts users.ts devices.ts store-settings.ts
back/schemas/
  sales.ts inventory.ts catalog.ts cash-register.ts fiscal.ts users.ts devices.ts store-settings.ts
```

`app/` compõe páginas e protege rotas. Cada Server Action valida com Zod, resolve usuário/tenant/loja a partir da sessão, injeta o adaptador de dados e retorna resultado serializável. Regras de preço, pagamento dividido, baixa de estoque, cancelamento e transições fiscais pertencem ao domínio, testadas sem Next.js ou Firebase.

Para o PDV em tempo real/offline, o adaptador cliente do Firebase e a fila local ficam em `front/features/pos/`; a regra de negócio continua em `back/domain/`. A consistência final deve ser validada no servidor durante a sincronização.

## Fases sugeridas

1. **Fundação operacional:** concluir login, perfis, criação da primeira loja, catálogo, estoque inicial e configuração de caixa.
2. **Venda essencial:** PDV para peso/manual/unidade, pagamentos divididos, recibo, abertura/fechamento de caixa e histórico.
3. **Controle e segurança:** cancelamento autorizado com auditoria, ficha técnica/baixa de insumos, alertas de estoque e relatórios básicos.
4. **Integrações:** implementar e homologar o vínculo da balança (leitura, estabilidade, reconexão e contingência) e da impressora térmica (recibo, reimpressão e falhas), adquirente/TEF se aplicável e provedor fiscal; implementar cupom fiscal de acordo com a decisão técnica e regulatória.
5. **Resiliência:** modo offline, fila de sincronização, indicadores de pendência e testes de recuperação.

## Decisões pendentes antes de construir os módulos externos

- UF e município de operação; CNAE/atividade efetivamente registrada; confirmação com contador sobre obrigação e modalidade de documento fiscal.
- Provedor fiscal, certificado/credenciais e ambiente de homologação.
- Modelo, fabricante, protocolo/porta e documentação da balança USB; sistema operacional do computador/tablet; marca/modelo, conexão, largura de papel e linguagem de impressão da impressora térmica. Confirmar se a balança transmite apenas peso ou peso e preço/valor, e qual é a unidade/precisão.
- Política de cartão: apenas registro manual da venda ou integração com maquininha/TEF; adquirente escolhida.
- Regras de preço por quilo, tamanhos, descontos, troco, retirada/sangria e ficha técnica de cada produto.
- Papéis de cada usuário e responsáveis pela senha de cancelamento.

## Critérios de aceite iniciais

- Uma venda por peso, uma por unidade e uma com pagamento dividido podem ser concluídas e aparecem no histórico.
- Com a balança vinculada, uma leitura estável preenche o peso e calcula o valor pelo preço/kg; desconexão, peso instável e lançamento manual ficam visíveis e auditáveis.
- Uma venda concluída gera recibo na impressora térmica vinculada; falha de impressão permite nova tentativa ou reimpressão sem duplicar a venda ou o documento fiscal.
- Toda venda reduz o estoque apropriado e todo ajuste/cancelamento deixa trilha auditável.
- Usuário sem autorização não consegue cancelar venda, ajustar estoque ou alterar configuração.
- Estoque abaixo do mínimo é visível no sistema.
- Falha de rede não perde uma venda local; a interface mostra seu estado até sincronizar.
- A emissão fiscal é testada em homologação antes de ser ativada na loja.
