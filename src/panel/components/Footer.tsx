import { STR } from '../lib/strings';

export function Footer() {
  return (
    <footer class="footer">
      <a
        href="https://pipeelo.com?utm_source=widget&utm_medium=powered-by"
        target="_blank"
        rel="noopener noreferrer"
      >
        {STR.poweredBy} <strong>Pipeelo</strong>
      </a>
    </footer>
  );
}
