import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Stage } from './Stage';
import { ui } from './ui';
import { startHezFrame } from '../app/main.js';

const container = document.getElementById('root');
if (!container) throw new Error('Missing HezFrame root');
window.HezFrameUI = ui;
flushSync(() => createRoot(container).render(<Stage />));
startHezFrame();
