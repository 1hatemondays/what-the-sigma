import { cp, mkdir } from 'node:fs/promises';

await mkdir('public', { recursive: true });
for (const file of ['index.html', 'app.js', 'style.css']) await cp(file, 'public/' + file);
await cp('question-images', 'public/question-images', { recursive: true });
