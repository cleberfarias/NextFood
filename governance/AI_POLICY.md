# Política de Governança de IA

## Princípios

- IA apoia decisões de engenharia; não substitui aprovação humana em mudanças críticas.
- Toda execução relevante deve ser auditável.
- Contexto enviado a modelos deve ser mínimo e necessário.
- Segredos, credenciais e dados sensíveis não devem ser enviados a modelos.

## Permissões padrão

Agentes podem:
- Ler código e documentação autorizados.
- Criar propostas de alteração.
- Executar lint, testes, build e análises locais.
- Criar commits e PRs quando o workflow permitir.

Agentes não podem sem aprovação humana:
- Fazer deploy em produção.
- Executar migration destrutiva em produção.
- Alterar secrets.
- Remover dados de produção.
- Desabilitar controles de segurança.

## Auditoria

Registrar, quando aplicável:
- agente e versão;
- modelo utilizado;
- objetivo da execução;
- artefatos/contexto utilizados;
- ferramentas chamadas;
- custo/tokens;
- resultado e avaliações;
- aprovação humana requerida/recebida.
