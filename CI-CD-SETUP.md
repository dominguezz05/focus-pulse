# 🚀 CI/CD Setup Guide - Focus Pulse

Esta guía te explica cómo configurar la publicación automática a VS Code Marketplace y OpenVSX Registry.

---

## 📦 1. Instalar Dependencias

```bash
npm install --save-dev \
  @commitlint/cli \
  @commitlint/config-conventional \
  husky \
  commitizen \
  cz-conventional-changelog \
  standard-version \
  ovsx
```

---

## 🔐 2. Configurar Tokens

### 2.1 VS Code Marketplace Token (VSCE_TOKEN)

1. Ve a https://dev.azure.com/
2. Click en tu perfil → "Personal access tokens"
3. Click "New Token"
4. Configuración:
   - **Name:** `focus-pulse-vsce`
   - **Organization:** All accessible organizations
   - **Expiration:** 1 year (o custom)
   - **Scopes:** `Marketplace` → `Manage`
5. Click "Create"
6. **Copia el token** (no lo perderás después)

### 2.2 OpenVSX Token (OVSX_TOKEN)

1. Ve a https://open-vsx.org/
2. Login con GitHub
3. Ve a tu perfil → Settings → Access Tokens
4. Click "Generate New Token"
5. **Copia el token**

### 2.3 Agregar Tokens a GitHub

1. Ve a tu repo en GitHub: `https://github.com/dominguezz05/focus-pulse`
2. Settings → Secrets and variables → Actions
3. Click "New repository secret"
4. Agrega dos secretos:
   - **Name:** `VSCE_TOKEN` | **Value:** [tu token de Azure]
   - **Name:** `OVSX_TOKEN` | **Value:** [tu token de OpenVSX]

---

## 🎯 3. Inicializar Husky

```bash
npm run prepare
npx husky add .husky/commit-msg 'npx --no -- commitlint --edit $1'
chmod +x .husky/commit-msg
```

---

## 📝 4. Hacer Commits Profesionales

### Opción 1: CLI Interactivo (Recomendado)

```bash
npm run commit
```

Te hará preguntas y generará un commit con formato:
```
feat(assistant): add predictive fatigue detection

Implemented linear regression to predict fatigue 10-15 minutes before it occurs
```

### Opción 2: Manual (Conventional Commits)

```bash
git commit -m "feat(scope): descripción corta

Descripción larga opcional que explica el cambio en detalle."
```

### Tipos de Commit Válidos

| Tipo       | Descripción                         | Ejemplo                                    |
|------------|-------------------------------------|--------------------------------------------|
| `feat`     | Nueva funcionalidad                 | `feat(assistant): add git integration`     |
| `fix`      | Corrección de bug                   | `fix(dashboard): resolve update issue`     |
| `docs`     | Cambios en documentación            | `docs(readme): update installation guide`  |
| `style`    | Formato, espacios (no afecta código)| `style: format code with prettier`         |
| `refactor` | Refactorización                     | `refactor(xp): simplify calculation`       |
| `perf`     | Mejoras de rendimiento              | `perf(tracker): optimize score algorithm`  |
| `test`     | Agregar o modificar tests           | `test(storage): add unit tests`            |
| `chore`    | Mantenimiento, deps, etc.           | `chore: update dependencies`               |
| `ci`       | Cambios en CI/CD                    | `ci: add publish workflow`                 |

---

## 🔄 5. Generar Release y Changelog Automático

### Opción 1: Automático (Detecta tipo desde commits)

```bash
npm run release
```

Esto:
- ✅ Lee tus commits desde el último tag
- ✅ Detecta si es patch/minor/major según tus commits
- ✅ Actualiza CHANGELOG.md automáticamente
- ✅ Incrementa versión en package.json
- ✅ Crea un git tag (ej: `v2.4.3`)

### Opción 2: Manual (Especificar tipo)

```bash
# Patch (2.4.2 → 2.4.3)
npm run release:patch

# Minor (2.4.2 → 2.5.0)
npm run release:minor

# Major (2.4.2 → 3.0.0)
npm run release:major
```

### Reglas de Versionado (SemVer)

| Commits                          | Versión Resultante | Ejemplo        |
|----------------------------------|--------------------|----------------|
| Solo `fix`, `perf`, `docs`       | PATCH (x.x.1)      | 2.4.2 → 2.4.3  |
| Al menos 1 `feat`                | MINOR (x.1.0)      | 2.4.2 → 2.5.0  |
| Cualquier `BREAKING CHANGE:`     | MAJOR (1.0.0)      | 2.4.2 → 3.0.0  |

---

## 🚀 6. Flujo de Publicación

### Flujo Completo (Recomendado)

```bash
# 1. Hacer cambios y commit
git add .
npm run commit  # O git commit manual con formato

# 2. Push a tu branch
git push origin features/mi-feature

# 3. Crear Pull Request en GitHub
# (Los workflows validarán tus commits automáticamente)

# 4. Merge del PR a main
# (Se ejecuta automáticamente el workflow de release)

# 5. El workflow hace:
# - ✅ Genera CHANGELOG.md
# - ✅ Incrementa versión
# - ✅ Crea tag vX.X.X
# - ✅ Push del tag
# - ✅ Compila y empaqueta .vsix
# - ✅ Publica a VS Code Marketplace
# - ✅ Publica a OpenVSX
# - ✅ Crea GitHub Release con .vsix adjunto
```

### Publicación Manual (Si prefieres hacerlo tú)

```bash
# 1. Generar release local
npm run release

# 2. Push del tag
git push --follow-tags origin main

# 3. Compilar y empaquetar
npm run compile
npm run package

# 4. Publicar a ambos marketplaces
npm run publish:all

# O publicar individualmente:
npm run publish:vsce  # Solo VS Code
npm run publish:ovsx  # Solo OpenVSX
```

---

## 🔧 7. Workflows de GitHub Actions

### 📄 `.github/workflows/validate.yml`
- **Trigger:** Pull Request a `main`
- **Qué hace:**
  - ✅ Valida formato de commits (commitlint)
  - ✅ Compila TypeScript
  - ✅ Ejecuta tests (si existen)
  - ✅ Genera .vsix de prueba

### 📄 `.github/workflows/release.yml`
- **Trigger:** Push a `main`
- **Qué hace:**
  - ✅ Ejecuta `standard-version`
  - ✅ Actualiza CHANGELOG.md
  - ✅ Incrementa versión en package.json
  - ✅ Crea tag vX.X.X
  - ✅ Push del tag
  - ✅ Compila y empaqueta
  - ✅ Crea GitHub Release

### 📄 `.github/workflows/publish.yml`
- **Trigger:** Push de tag `v*`
- **Qué hace:**
  - ✅ Compila y empaqueta
  - ✅ Publica a VS Code Marketplace
  - ✅ Publica a OpenVSX Registry
  - ✅ Adjunta .vsix al release

---

## 📋 8. Ejemplo de CHANGELOG Generado

```markdown
# Changelog

## [2.5.0] - 2026-02-05

### ✨ Features

- **assistant:** add git integration ([abc123](https://github.com/...))
- **dashboard:** add heatmap visualization ([def456](https://github.com/...))

### 🐛 Bug Fixes

- **storage:** fix data persistence issue ([ghi789](https://github.com/...))

### ♻️ Code Refactoring

- **xp:** simplify calculation logic ([jkl012](https://github.com/...))

### 📝 Documentation

- **readme:** update installation guide ([mno345](https://github.com/...))
```

---

## ✅ 9. Checklist de Configuración

- [ ] Dependencias instaladas (`npm install`)
- [ ] Husky inicializado (`npm run prepare`)
- [ ] Tokens creados (VSCE + OVSX)
- [ ] Tokens agregados a GitHub Secrets
- [ ] Workflows en `.github/workflows/`
- [ ] Primer commit con `npm run commit`
- [ ] Primer release con `npm run release`

---

## 🎓 10. Tips y Best Practices

### ✅ DO (Hacer)

- ✅ Usa `npm run commit` para commits interactivos
- ✅ Escribe mensajes descriptivos en inglés
- ✅ Un commit = un cambio lógico
- ✅ Haz PR pequeños y frecuentes
- ✅ Revisa el CHANGELOG antes de publicar

### ❌ DON'T (No hacer)

- ❌ No hagas commits directos a `main`
- ❌ No omitas el scope (ej: `feat: add feature` → mejor `feat(assistant): add feature`)
- ❌ No mezcles tipos (feat + fix en un commit)
- ❌ No hagas commits gigantes (>500 líneas)
- ❌ No uses `git commit --no-verify` (salta validaciones)

---

## 🆘 11. Troubleshooting

### Error: "commitlint failed"
```bash
# Verifica el formato del commit
git log -1

# Si está mal, haz amend:
git commit --amend
```

### Error: "VSCE_TOKEN invalid"
```bash
# Regenera el token en Azure DevOps
# Actualiza el secret en GitHub
```

### Error: "standard-version no tags found"
```bash
# Crea el primer tag manualmente:
git tag v2.4.2
git push --tags
```

### CHANGELOG no se actualiza
```bash
# Verifica que tus commits tengan formato correcto
git log --oneline

# Debe verse así:
# feat(scope): descripción
# fix(scope): descripción
```

---

## 📚 12. Referencias

- **Conventional Commits:** https://www.conventionalcommits.org/
- **Commitizen:** https://github.com/commitizen/cz-cli
- **Standard Version:** https://github.com/conventional-changelog/standard-version
- **VS Code Publishing:** https://code.visualstudio.com/api/working-with-extensions/publishing-extension
- **OpenVSX:** https://github.com/eclipse/openvsx/wiki/Publishing-Extensions

---

## 🎉 ¡Listo!

Ahora cada vez que hagas merge a `main`:
1. Se genera el CHANGELOG automáticamente
2. Se incrementa la versión
3. Se publica a ambos marketplaces
4. Se crea el GitHub Release

**Todo automático, sin intervención manual** 🚀
