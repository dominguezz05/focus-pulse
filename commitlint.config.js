module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [
      2,
      'always',
      [
        'feat',     // Nueva funcionalidad
        'fix',      // Bug fix
        'docs',     // Cambios en documentación
        'style',    // Formato, espacios, etc.
        'refactor', // Refactorización
        'perf',     // Mejoras de rendimiento
        'test',     // Agregar tests
        'chore',    // Mantenimiento
        'revert',   // Revertir cambios
        'ci',       // Cambios en CI/CD
      ],
    ],
  },
};
