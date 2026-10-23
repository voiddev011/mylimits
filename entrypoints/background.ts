import { startController } from '../src/platform/controller';
import { browser } from 'wxt/browser';

export default defineBackground(() => {
 if(__MYLIMITS_SPIKE__){
  // The diagnostic build never starts automatic production collection.
  void import('../src/platform/spike-runtime').then(m=>m.startSpikeRuntime(browser,(url,options)=>fetch(url,options))).catch(()=>{});
 }else startController();
});
