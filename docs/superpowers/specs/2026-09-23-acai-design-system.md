# Design system do Ponto do Açaí

## Princípios

- Use tokens semânticos (`brand-*`) em vez de hexadecimais nos componentes.
- Reserve `brand-primary` para ações principais e estados selecionados.
- Mantenha texto principal em `brand-plum-900` e texto auxiliar em `brand-text-muted`.
- Estados de hover devem preservar contraste: fundo roxo e texto branco.
- Cards usam `brand-surface-card` com borda `brand-border`; superfícies internas usam `brand-surface-muted`.

## Tokens Tailwind

Os tokens ficam em `apps/web/app/globals.css`, disponíveis como classes Tailwind v4:

| Token | Uso |
| --- | --- |
| `brand-primary` / `brand-primary-dark` | CTA, seleção e hover |
| `brand-plum-900` / `brand-plum-950` | Texto e títulos |
| `brand-rose` | Labels, ícones e destaques |
| `brand-surface` | Fundo da aplicação |
| `brand-surface-card` | Cards e painéis |
| `brand-surface-muted` | Campos, itens e áreas secundárias |
| `brand-border` | Bordas e divisores |
| `brand-text-soft` / `brand-text-muted` | Texto secundário e auxiliar |
| `brand-accent-peach` | Ação desabilitada / estado de atenção |
| `brand-success` | Confirmações e sucesso |

Exemplo:

```tsx
<Button className="bg-brand-primary text-white hover:bg-brand-primary-dark">
  Finalizar venda
</Button>
```

## Decisões permanentes para o PDV

- O PDV prioriza a sequência operacional: produtos e pesagem, revisão, pagamento e finalização. A etapa atual aparece acima do conteúdo e a próxima ação aparece junto ao total.
- Painéis operacionais usam borda `brand-border`, raio amplo e elevação discreta. O painel de total usa `brand-surface-muted`; somente a ação principal usa `brand-primary`.
- Estados de dispositivo e integrações devem ser nomeados como `Simulada`, `Demonstração` ou `Integração pendente` até que exista confirmação de backend. Não usar mensagens de sucesso para fluxos locais.
- Ações destrutivas e dependentes de autorização usam diálogo com foco gerenciado. A senha do supervisor nunca é coletada ou validada no cliente.
- Componentes de operação reutilizáveis ficam em `front/features/pos/pos-ui.tsx`: cartão de produto, linha de carrinho, seletor de pagamento, indicador de balança e feedback.

Novos módulos (Estoque, Financeiro e Configurações) devem reutilizar esses tokens; não crie novas cores locais sem necessidade de produto.
