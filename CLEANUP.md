# Legacy File Cleanup Plan

## 🎯 Purpose
Limpiar archivos antiguos que ya no son necesarios después del refactor v2.1.

## 📋 Files to Remove

### Phase 1: Obsoletos Directos
- [ ] `src/extension.js` (compilado)
- [ ] `src/dashboard.ts` (monolítico - reemplazado por component system)
- [ ] `src/extension-refactored.js` (temporary development)

### Phase 2: Dependencies y Build
- [ ] `out/extension.js` (old compiled)
- [ ] `out/extension-refactored.js` (old compiled)
- [ ] Archivos temporales de desarrollo

### Phase 3: Documentación Antigua
- [ ] `CHANGELOG.md` (versión anterior - backup)
- [ ] `README.md` (versión original - backup)

## 🔄 Proceso de Cleanup

### 1. Backup Actual
```bash
# Crear carpeta de backup
mkdir -p backup/
cp -r src/ backup/
cp CHANGELOG.md backup/
cp README.md backup/
```

### 2. Identificar Legacy
```bash
# Archivos que pueden ser eliminados:
find src/ -name "*.ts" -not -path "src/events" -not -path "src/state" -not -path "src/utils" -not -path "src/webview"
```

### 3. Eliminar Gradual
```bash
# Eliminar archivos obsoletos
rm src/extension.ts
rm src/dashboard.ts
rm out/extension*.js
```

### 4. Validar Post-Cleanup
```bash
# Verificar que solo archivos necesarios queden
find src/ -name "*.ts" | grep -v -E "(events|state|utils|webview|extension-refactored)"

# Probar compilación
npm run compile
```

## ⚠️ Precauciones

### Archivos a PRESERVAR
Estos archivos deben mantenerse por compatibilidad:

```
src/events/           # ✅ Sistema de eventos v2.1
src/state/            # ✅ State management v2.1  
src/utils/            # ✅ Performance utilities v2.1
src/webview/          # ✅ Component architecture v2.1
src/extension-refactored.ts  # ✅ Main entry v2.1
src/dashboard-refactored.ts # ✅ Dashboard v2.1
README-v2.1.md       # ✅ Documentación v2.1
CHANGELOG.md           # ✅ Updated changelog
tsconfig.json          # ✅ Configuración actualizada
package.json           # ✅ Versión y main actualizado
```

### Archivos a ELIMINAR
```
src/extension.ts          # ❌ Reemplazado por extension-refactored.ts
src/dashboard.ts          # ❌ Reemplazado por component system
out/extension*.js        # ❌ Viejas compilaciones
```

## ✅ Validación Checklist

- [ ] `extension-refactored.ts` compila sin errores
- [ ] `dashboard-refactored.ts` compila sin errores
- [ ] Component system imports funcionan correctamente
- [ ] Event system funciona como esperado
- [ ] State management carga y persiste correctamente
- [ ] Package.json apunta a nuevo entry point
- [ ] VS Code puede cargar la extensión
- [ ] Funcionalidad v2.0 completamente preservada

## 🚀 Ejecución

```bash
# Ejecutar cleanup
./scripts/cleanup.sh

# O ejecución manual paso a paso
```

## 📊 Resultados Esperados

- **Size reduction:** ~50% menos archivos fuente
- **Compilation time:** 20-30% más rápido (sin HTML monolítico)
- **Maintainability:** Código más limpio y enfocado
- **Debugging:** Más fácil con arquitectura de componentes

---

**Nota:** Este cleanup reduce el technical debt y facilita el mantenimiento futuro.