import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app';
import './styles.css';

render(<App />, document.getElementById('app')!);

registerSW({ immediate: true });
