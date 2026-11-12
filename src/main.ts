import './style.css';
import './ui/cardFrame.css';
import './ui/modals.css';
import './ui/screens.css';
import { mountBaliteApp } from './ui/app';

/**
 * Точка входа браузерного клиента Balite: монтирует приложение в корневой узел #app.
 */
function bootstrap(): void {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) {
    throw new Error('Не найден корневой элемент #app для монтирования Balite');
  }
  mountBaliteApp(root);
}

bootstrap();
