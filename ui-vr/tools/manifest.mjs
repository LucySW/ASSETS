// O que o exportador gera além dos ícones soltos.

// Placas por tipo e estilo (cada uma sai em normal/hover/pressed/disabled + glow).
export const PLATE_KINDS = {
  square: ['control', 'primary', 'quiet', 'success', 'danger'],
  pill: ['primary', 'quiet', 'success', 'neutral'],
  card: ['control', 'violet', 'neutral'],
  badge: ['warning'],
};

// Botões quadrados já compostos (placa + ícone), um por ação do inventário.
export const BUTTONS = [
  { name: 'btn_seletor', icon: 'selector', style: 'quiet', label: 'Seletor' },
  { name: 'btn_seletor_confirmar', icon: 'selector', style: 'danger', label: 'Confirmar?' },
  { name: 'btn_reiniciar', icon: 'restart', style: 'quiet', label: 'Reiniciar' },
  { name: 'btn_reiniciar_confirmar', icon: 'restart', style: 'danger', label: 'Confirmar?' },
  { name: 'btn_dica', icon: 'bulb', style: 'primary', label: 'Dica' },
  { name: 'btn_comecar', icon: 'play', style: 'success', label: 'Começar' },
  { name: 'btn_pular', icon: 'skip', style: 'success', label: 'Pular' },
  { name: 'btn_pausar', icon: 'pause', style: 'control', label: 'Pausar' },
  { name: 'btn_continuar', icon: 'play', style: 'control', label: 'Continuar' },
  { name: 'btn_som', icon: 'sound', style: 'control', label: 'Som' },
  { name: 'btn_sem_som', icon: 'muted', style: 'control', label: 'Sem som' },
  { name: 'btn_legendas', icon: 'subtitles', style: 'control', label: 'Legendas' },
  { name: 'btn_sem_legendas', icon: 'subtitles_off', style: 'control', label: 'Sem legendas' },
  { name: 'btn_configuracoes', icon: 'settings', style: 'control', label: 'Configurações' },
  { name: 'btn_proximo', icon: 'next', style: 'primary', label: 'Próximo' },
  { name: 'btn_confirmar', icon: 'confirm', style: 'success', label: 'Confirmar' },
  { name: 'btn_voltar', icon: 'back', style: 'quiet', label: 'Voltar' },
];

const it = (b, extra = {}) => ({ icon: b.icon, style: b.style, label: b.label, ...extra });
const B = Object.fromEntries(BUTTONS.map((b) => [b.name, b]));

export const PREVIEWS = [
  {
    name: 'mesa_botoes', title: 'Mesa — controles da atividade', cols: 5, cell: 260,
    items: ['btn_seletor', 'btn_reiniciar', 'btn_dica', 'btn_comecar', 'btn_pular',
      'btn_pausar', 'btn_continuar', 'btn_som', 'btn_sem_som', 'btn_legendas',
      'btn_sem_legendas', 'btn_configuracoes', 'btn_proximo', 'btn_confirmar', 'btn_voltar'].map((n) => it(B[n])),
  },
  {
    name: 'estados', title: 'Estados: normal · hover · pressionado · desabilitado', cols: 4, cell: 260,
    items: ['btn_dica', 'btn_som', 'btn_seletor'].flatMap((n) => ['normal', 'hover', 'pressed', 'disabled']
      .map((state) => it(B[n], { state, label: `${B[n].label} · ${state}` }))),
  },
  {
    name: 'destrutivas', title: 'Ações destrutivas: 1º toque → "Confirmar?"', cols: 4, cell: 260,
    items: ['btn_seletor', 'btn_seletor_confirmar', 'btn_reiniciar', 'btn_reiniciar_confirmar'].map((n) => it(B[n])),
  },
  {
    name: 'informativos', title: 'Ícones informativos e ilustrações', cols: 5, cell: 260,
    items: [
      { icon: 'star', style: 'quiet', label: 'Estrela' },
      { icon: 'star_off', style: 'quiet', label: 'Estrela apagada' },
      { icon: 'target', style: 'quiet', label: 'Alvo (passo 1)' },
      { icon: 'hand', style: 'quiet', label: 'Mão (passo 2)' },
      { icon: 'check', style: 'quiet', label: 'Certo (passo 3)' },
      { icon: 'cube', style: 'control', label: 'Cubo' },
      { icon: 'axes', style: 'control', label: 'Eixos' },
      { icon: 'lock', style: 'quiet', label: 'Bloqueado' },
      { icon: 'prev', style: 'quiet', label: 'Anterior ‹' },
      { icon: 'next', style: 'primary', label: 'Próximo ›' },
      { icon: 'illus_coord', style: 'control', label: 'Coordenadas 3D' },
      { icon: 'illus_balance', style: 'violet', label: 'Balança' },
      { icon: 'illus_soon', style: 'neutral', label: 'Em breve' },
    ],
  },
];
