'use strict';

const LOCALES = {
  'pt-BR': {
    waiting:       'Aguardando dados…',
    authMsg:       'Faça login no Claude para<br>monitorar seu uso.',
    loginBtn:      'Entrar no Claude',
    loadingMsg:    'Carregando dados de uso…',
    errorMsg:      'Erro ao carregar dados.',
    retryBtn:      'Tentar novamente',
    emptyMsg:      'Nenhum dado de uso encontrado.<br>Pode levar alguns segundos.',
    reconnectBtn:  'Reconectar',
    refreshTitle:  'Atualizar agora',
    closeTitle:    'Fechar',
    minimizeTitle: 'Minimizar',
    restoreTitle:  'Restaurar',
    settingsTitle: 'Configurações',
    back:          'Voltar',
    updatedAt:     'Atualizado às',
    errorAt:       'Erro às',
    nextReset:     'Próximo reset em',
    soon:          'em breve',
    langLabel:     'Idioma',
    themeLabel:    'Tema',
    themeDark:     'Escuro',
    themeLight:    'Claro',
    opacityLabel:  'Transparência',
    intervalLabel: 'Recarga da página',
    intervalHint:  'DOM relido a cada 2s. Recarga busca dados novos do servidor.',
    filtersLabel:  'Consumos exibidos',
    filtersHint:   'Carregue os dados de uso para configurar os filtros.',
    saveBtn:       'Salvar',
    alertsLabel:   'Alertas',
    alertThreshold:'Uso alto',
    alertNearReset:'Próximo ao reset',
    alertPlanReset:'Reset do plano',
    alertSpike:    'Pico de uso',
    opt5s:  '5 segundos',
    opt15s: '15 segundos',
    opt30s: '30 segundos',
    opt1m:  '1 minuto',
    opt2m:  '2 minutos',
    opt5m:  '5 minutos',
    startupLabel:  'Inicialização',
    startupDesc:   'Iniciar com o sistema',
    positionLabel:  'Posição',
    posTopLeft:     '↖ Sup. Esq.',
    posTopRight:    '↗ Sup. Dir.',
    posBottomLeft:  '↙ Inf. Esq.',
    posBottomRight: '↘ Inf. Dir.',
    posMonitor1:    'Monitor 1',
    posMonitor2:    'Monitor 2',
    catAppearance:  'Aparência',
    catPosition:    'Posição',
    catData:        'Dados',
    catAlerts:      'Alertas',
    catSystem:      'Sistema',
  },
  'en': {
    waiting:       'Waiting for data…',
    authMsg:       'Sign in to Claude to<br>monitor your usage.',
    loginBtn:      'Sign in to Claude',
    loadingMsg:    'Loading usage data…',
    errorMsg:      'Error loading data.',
    retryBtn:      'Try again',
    emptyMsg:      'No usage data found.<br>This may take a few seconds.',
    reconnectBtn:  'Reconnect',
    refreshTitle:  'Refresh now',
    closeTitle:    'Close',
    minimizeTitle: 'Minimize',
    restoreTitle:  'Restore',
    settingsTitle: 'Settings',
    back:          'Back',
    updatedAt:     'Updated at',
    errorAt:       'Error at',
    nextReset:     'Next reset in',
    soon:          'soon',
    langLabel:     'Language',
    themeLabel:    'Theme',
    themeDark:     'Dark',
    themeLight:    'Light',
    opacityLabel:  'Transparency',
    intervalLabel: 'Page reload',
    intervalHint:  'DOM re-read every 2s. Reload fetches fresh data from server.',
    filtersLabel:  'Shown metrics',
    filtersHint:   'Load usage data first to configure filters.',
    saveBtn:       'Save',
    alertsLabel:   'Alerts',
    alertThreshold:'High usage',
    alertNearReset:'Near reset',
    alertPlanReset:'Plan reset',
    alertSpike:    'Usage spike',
    opt5s:  '5 seconds',
    opt15s: '15 seconds',
    opt30s: '30 seconds',
    opt1m:  '1 minute',
    opt2m:  '2 minutes',
    opt5m:  '5 minutes',
    startupLabel:  'Startup',
    startupDesc:   'Start with system',
    positionLabel:  'Position',
    posTopLeft:     '↖ Top Left',
    posTopRight:    '↗ Top Right',
    posBottomLeft:  '↙ Bottom Left',
    posBottomRight: '↘ Bottom Right',
    posMonitor1:    'Monitor 1',
    posMonitor2:    'Monitor 2',
    catAppearance:  'Appearance',
    catPosition:    'Position',
    catData:        'Data',
    catAlerts:      'Alerts',
    catSystem:      'System',
  },
};

let currentLang = 'en';

function t(key) {
  return LOCALES[currentLang]?.[key] ?? LOCALES['pt-BR'][key] ?? key;
}

function setLang(lang) {
  currentLang = LOCALES[lang] ? lang : 'pt-BR';
}

function applyTranslations() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.innerHTML = t(el.dataset.i18n);
  });
  document.querySelectorAll('[data-i18n-text]').forEach(el => {
    el.textContent = t(el.dataset.i18nText);
  });
  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    el.title = t(el.dataset.i18nTitle);
  });
}
