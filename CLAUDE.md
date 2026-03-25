# FactoryMind

## Workflow

This project uses the **flow** workflow plugin for structured development.

### Branch Naming

- Features: `feat/{issue}-{slug}`
- Bug fixes: `fix/{issue}-{slug}`
- Chores: `chore/{issue}-{slug}`

### Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
type(scope): subject (max 72 chars)

body (optional)

footer (optional)
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `build`, `ci`, `chore`

### Pull Requests

- PRs require passing checks and at least one approval
- Use `/flow:pr` to create PRs with automated review
- Use `/flow:address <pr>` to handle review feedback

### Development Commands

| Command | Purpose |
|---------|---------|
| `/flow:start <issue>` | Start work on an issue |
| `/flow:commit` | Classify and commit changes |
| `/flow:pr` | Create pull request |
| `/flow:review <pr>` | Review a pull request |
| `/flow:status` | Workflow overview |
