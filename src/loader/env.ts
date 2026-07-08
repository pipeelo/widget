// Única referência de env permitida no loader — o build lib inlina esse
// literal via `define` (nenhum `import.meta` pode sobrar em script clássico).
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'https://api.pipeelo.com/v1';
