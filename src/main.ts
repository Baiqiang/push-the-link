import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { t } from './i18n';
import { App } from './ui/app';
import { toast } from './ui/dom';

const app = new App();
void app.start();

const updateSW = registerSW({
  onNeedRefresh() {
    toast(t('updateReady'), { ms: 15000, onClick: () => void updateSW(true) });
  },
  onOfflineReady() {
    toast(t('offlineReady'));
  },
});
