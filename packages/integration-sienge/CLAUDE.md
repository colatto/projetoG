# Contexto da Integracao Sienge

## Objetivo

Concentrar os adaptadores e fluxos de integracao com o Sienge.

## Escopo inicial

- leitura de cotacoes;
- leitura cadastral de fornecedores;
- leitura de pedidos;
- leitura de entregas e notas fiscais;
- escrita controlada da resposta de cotacao;
- tratamento de webhooks como gatilho de sincronizacao.

## Regras locais

- webhook dispara sincronizacao, mas nao substitui leitura detalhada por API;
- respostas de cotacao so podem ser escritas apos aprovacao de `Compras`;
- cada chamada deve registrar contexto tecnico para auditoria e suporte;
- falhas devem permitir retry e reprocessamento controlado;
- os adaptadores devem poder ser consumidos por `apps/api` e pela camada de workers sem duplicar logica.
