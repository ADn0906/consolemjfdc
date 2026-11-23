(() => {
 const storageKey = 'fdc:sceau-des-cinq:active-pin';
 const storedPin = () => {
  try { return sessionStorage.getItem(storageKey); }
  catch { return null; }
 };
 let pin = storedPin();
 let launchedFullscreen = false;

 const style = document.createElement('style');
 style.textContent = `
 #fdcSceauStage{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;padding:0;margin:0;border:0;background:#29251d;overflow:hidden}
 #fdcSceauStage iframe{display:block;width:100%;height:100%;border:0}
 #fdcSceauClose{position:absolute;right:max(12px,env(safe-area-inset-right,0px));top:max(12px,env(safe-area-inset-top,0px));background:#201b15e8;color:#fff}
 #fdcSceauPin{width:min(330px,calc(100% - 32px));color:#ece5d7;background:#24211e;border:1px solid #625a4a;border-radius:9px}
 #fdcSceauPin::backdrop{background:#000a}
 #fdcSceauPin form{display:grid;gap:12px}
 #fdcSceauPin h2,#fdcSceauPin p{margin:0}
 #fdcSceauPin [role="alert"]{color:#ffb2a6}
 `;
 document.head.append(style);

 const launch = document.createElement('button');
 launch.type = 'button';
 launch.className = 'small';
 launch.textContent = 'Lancer le Sceau des Cinq';
 document.querySelector('#scenario .head .actions').prepend(launch);
 const renderScenario = fdcRenderScenarioLinks;
 fdcRenderScenarioLinks = function () {
  renderScenario();
  launch.hidden = fdcScenarioFold(state.campaign) !== "l'heritage des silences";
 };
 fdcRenderScenarioLinks();

 const stage = document.createElement('dialog');
 stage.id = 'fdcSceauStage';
 stage.setAttribute('aria-label', 'Le Sceau des Cinq');
 stage.innerHTML = '<button id="fdcSceauClose" type="button">Fermer</button>';
 const close = stage.querySelector('button');

 const access = document.createElement('dialog');
 access.id = 'fdcSceauPin';
 access.setAttribute('aria-labelledby', 'fdcSceauPinTitle');
 access.innerHTML = `<form>
  <h2 id="fdcSceauPinTitle">Code MJ</h2>
  <label for="fdcSceauPinInput"></label>
  <input id="fdcSceauPinInput" type="password" inputmode="numeric" pattern="[0-9]{4,8}" required autocomplete="off">
  <p role="alert"></p>
  <div class="row"><button type="submit"></button><button type="button">Annuler</button></div>
 </form>`;
 // Keep the access form inside the fullscreen element when it is active.
 stage.append(access);
 document.body.append(stage);
 const form = access.querySelector('form');
 const input = access.querySelector('input');
 const error = access.querySelector('[role="alert"]');
 let closing = false;

 function askCode(isClosing) {
  closing = isClosing;
  (isClosing ? stage : document.body).append(access);
  access.querySelector('label').textContent = isClosing ? 'Saisis le code MJ pour revenir à la console.' : 'Choisis un code de 4 à 8 chiffres pour fermer le jeu.';
  form.querySelector('[type="submit"]').textContent = isClosing ? 'Fermer le jeu' : 'Ouvrir le jeu';
  error.textContent = '';
  input.value = '';
  access.showModal();
  input.focus();
 }

 function showGame(fullscreen) {
  const frame = document.createElement('iframe');
  frame.title = 'Énigme du Mont Chaud';
  frame.setAttribute('sandbox', 'allow-scripts');
  frame.setAttribute('allow', 'autoplay *');
  frame.src = './assets/sceau/index.html';
  stage.prepend(frame);
  stage.showModal();
  if (fullscreen && !document.fullscreenElement && stage.requestFullscreen) {
   stage.requestFullscreen().then(() => { launchedFullscreen = true; }).catch(() => {});
  }
 }

 launch.addEventListener('click', () => askCode(false));
 close.addEventListener('click', () => askCode(true));
 stage.addEventListener('cancel', event => event.preventDefault());
 access.querySelector('[type="button"]').addEventListener('click', () => access.close());
 form.addEventListener('submit', event => {
  event.preventDefault();
  if (closing) {
   if (input.value !== pin) {
    error.textContent = 'Code incorrect.';
    input.select();
    return;
   }
   access.close();
   pin = null;
   try { sessionStorage.removeItem(storageKey); } catch {}
   stage.querySelector('iframe').remove();
   if (launchedFullscreen && document.fullscreenElement === stage) document.exitFullscreen().catch(() => {});
   launchedFullscreen = false;
   stage.close();
   launch.focus();
   return;
  }
  pin = input.value;
  try { sessionStorage.setItem(storageKey, pin); } catch {}
  access.close();
  showGame(true);
 });
 if (pin && /^[0-9]{4,8}$/.test(pin)) showGame(false);
})();
