let original = '';
let applied: string | null = null;

export function setTitleCount(count: number): void {
  if (document.title !== applied) original = document.title;
  applied = count > 0 ? '(' + (count > 9 ? '9+' : count) + ') ' + original : original;
  if (document.title !== applied) document.title = applied;
}
