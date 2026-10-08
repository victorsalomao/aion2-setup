/** Escapa HTML e transforma **texto** em <strong>. Só para strings do nosso próprio conteúdo. */
export function emphasize(text: string): string {
  const escaped = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}
