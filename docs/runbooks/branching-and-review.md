# Estratégia de branching e code review

## Fluxo adotado

O projeto deve usar GitHub Flow com branches curtas e deploy contínuo para `main`.

- `main`: sempre deployável
- `feature/<ticket>-<slug>`: novas funcionalidades
- `fix/<ticket>-<slug>`: correções funcionais
- `hotfix/<ticket>-<slug>`: correções urgentes de produção
- `chore/<ticket>-<slug>`: infraestrutura, dependências e manutenção
- `release/<yyyy-mm-dd>`: branch opcional para congelamento e validação de release

## Regras de merge

- Todo merge em `main` deve ocorrer via Pull Request
- Squash merge é o padrão para preservar histórico legível
- PRs exigem no mínimo 2 aprovações
- CI obrigatória:
  - `Build, Lint and Test`
  - `Audit and Secret Scan`
- Branch deve estar atualizada com `main` antes do merge
- Force-push e branch deletion em `main` devem ser bloqueados

## Checklist de review

- Segurança: auth, autorização, validação, segredos, exposição de dados e logging
- Performance: loops, chamadas remotas, uso de memória, queries e retries
- Testes: cobertura do fluxo alterado e regressões negativas
- Documentação: variáveis de ambiente, contratos, migrações e runbooks

## Aplicação no GitHub

O script `scripts/github/apply-branch-protection.sh` aplica a proteção mínima da branch via `gh api`.

Pré-requisitos:

1. `gh auth login`
2. `export GITHUB_REPOSITORY=<owner>/<repo>`
3. `./scripts/github/apply-branch-protection.sh main`
