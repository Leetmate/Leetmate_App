(function () {
  'use strict';

  // ═══════════════════════════════════════════════════
  //  BACKGROUND MUSIC
  // ═══════════════════════════════════════════════════

  function startBattleMusic() {
    if (!window.LeetmateBGMusic) return;
    if (typeof window.LeetmateBGMusic.startBattle === 'function') {
      window.LeetmateBGMusic.startBattle();
      return;
    }
    window.LeetmateBGMusic.pause();
  }

  function stopBattleMusic() {
    if (!window.LeetmateBGMusic) return;
    if (typeof window.LeetmateBGMusic.stopBattle === 'function') {
      window.LeetmateBGMusic.stopBattle();
      return;
    }
    window.LeetmateBGMusic.resume();
  }

  // ═══════════════════════════════════════════════════
  //  BACKGROUND HELPER
  // ═══════════════════════════════════════════════════
  function setBattleBg(on) {
    var card = document.querySelector('.community-card');
    if (card) card.classList.toggle('battle-mode', !!on);

    // Always hide the nav-drawer during battle screens
    var navDrawer = document.getElementById('nav-drawer');
    if (navDrawer) navDrawer.style.display = on ? 'none' : '';
  }

  // ═══════════════════════════════════════════════════
  //  CPU POOL
  // ═══════════════════════════════════════════════════
  var CPU_PETS = [
    { name:'Cubic Bat',      sprite:'../../assets/spritesheets/CubicBatAdult.png' },
    { name:'Cubic Cat',      sprite:'../../assets/spritesheets/CubicCatAdult.png' },
    { name:'Cubic Fish',     sprite:'../../assets/spritesheets/CubicFishAdult.png' },
    { name:'Cubic Fox',      sprite:'../../assets/spritesheets/CubicFoxAdult.png' },
    { name:'Cubic Frog',     sprite:'../../assets/spritesheets/CubicFrogAdult.png' },
    { name:'Cubic Giraffe',  sprite:'../../assets/spritesheets/CubicGiraffeAdult.png' },
    { name:'Golden Tamarin', sprite:'../../assets/spritesheets/CubicMicoLeaoDouradoAdult.png' },
    { name:'Cubic Wolf',     sprite:'../../assets/spritesheets/CubicWolfAdult.png' },
  ];

  // ═══════════════════════════════════════════════════
  //  STATE
  // ═══════════════════════════════════════════════════
  var playerPet  = null;
  var cpuPet     = null;
  var animating  = false;
  var playerTurn = true;

  // ═══════════════════════════════════════════════════
  //  UTILS
  // ═══════════════════════════════════════════════════
  function sleep(ms){ return new Promise(function(r){ setTimeout(r,ms); }); }
  function randInt(a,b){ return Math.floor(Math.random()*(b-a+1))+a; }
  function randF(a,b)  { return a+Math.random()*(b-a); }
  function capitalize(s){ return s ? s.charAt(0).toUpperCase()+s.slice(1).toLowerCase() : ''; }
  function setText(id,val){ var e=document.getElementById(id); if(e) e.textContent=val; }

  // Fish and Jaguatirica spritesheets are 588×64 (single row).
  // All others are 588×128 (two rows). The battle CSS assumes two rows
  // (background-size:700% 200%, position 0% 100%), so single-row sheets
  // need overrides or they show empty bottom-row space.
  var SINGLE_ROW_RE = /CubicFish|CubicJaguatirica/;
  function isSingleRow(src) { return !!(src && SINGLE_ROW_RE.test(src)); }

  function applySprite(el, src, animated) {
    if (!el || !src) return;
    el.style.backgroundImage = 'url("' + src + '")';
    el.classList.toggle('sprite-single', isSingleRow(src));
    if (animated) el.classList.add('is-animated');
  }

  // ═══════════════════════════════════════════════════
  //  SCREEN MANAGEMENT
  // ═══════════════════════════════════════════════════
  var BATTLE_SCREENS = ['screen-matchmaking','screen-battle','screen-win','screen-lose'];

  function showScreen(id) {
    document.querySelectorAll('.battle-screen').forEach(function(s){ s.classList.remove('is-active'); });
    var el = document.getElementById(id);
    if (el) el.classList.add('is-active');
    // Toggle battle-mode class (hides header, switches background)
    setBattleBg(BATTLE_SCREENS.indexOf(id) !== -1);
  }

  function handleBack() {
    var active = document.querySelector('.battle-screen.is-active');
    if (!active || active.id === 'screen-lobby') {
      window.location.href = '../community-main/index.html';
    } else {
      goToLobby();
    }
  }

  function goToLobby() {
    stopBattleMusic();
    showScreen('screen-lobby'); // also calls setBattleBg(false) via showScreen
  }

  // ═══════════════════════════════════════════════════
  //  LOBBY — load player pet from storage
  // ═══════════════════════════════════════════════════
  function buildSpritePath(pet) {
    if (!pet || !pet.petRef) return null;
    var stage = (pet.stage || 'adult').toLowerCase();
    return '../../assets/spritesheets/Cubic' + pet.petRef + (stage === 'egg' ? 'Baby' : capitalize(stage)) + '.png';
  }

  function initLobby() {
    if (typeof storageGet !== 'function') return;
    storageGet(['activePetSnapshot','activePetSpritePath']).then(function(data) {
      var pet  = data.activePetSnapshot;
      var path = data.activePetSpritePath;
      if (!pet) return;

      var stage = (pet.stage || '').toLowerCase();
      var isAdult = stage === 'adult';
      var src  = path ? ('../../' + path) : buildSpritePath(pet);
      var name = (pet.customName || '').trim() || 'Cubic ' + (pet.petRef || 'Pet');

      var sp = document.getElementById('multi-pet-sprite');
      if (sp && src) {
        applySprite(sp, src, true);
        if (!isAdult) sp.style.filter = 'grayscale(.7) brightness(.7)';
      }
      setText('multi-pet-name', name);

      var statsCard = document.getElementById('multi-stats-card');
      var matchBtn  = document.getElementById('multi-match-btn');
      var lockedEl  = document.getElementById('multi-locked');
      var lockedDesc = document.getElementById('multi-locked-desc');

      if (isAdult) {
        // Unlock: show stats + button
        if (statsCard) statsCard.style.display = '';
        if (matchBtn)  matchBtn.style.display  = '';
        if (lockedEl)  lockedEl.style.display  = 'none';

        var stats = pet.stats || {};
        playerPet = {
          name: name, sprite: src,
          maxHp: (stats.hp  || 50) * 4, hp: (stats.hp  || 50) * 4,
          atk:  stats.atk  || 45, def:  stats.def  || 40,
          spAtk:stats.spAtk|| 40, spDef:stats.spDef|| 40,
          spd:  stats.spd  || 45,
          guarding: false, superCd: 0,
        };
        var m = { 'stat-hp':stats.hp,'stat-atk':stats.atk,'stat-def':stats.def,
                  'stat-spatk':stats.spAtk,'stat-spdef':stats.spDef,'stat-spd':stats.spd };
        Object.keys(m).forEach(function(id){ setText(id, m[id] != null ? m[id] : '—'); });

      } else {
        // Locked: hide stats + button, show message
        if (statsCard) statsCard.style.display = 'none';
        if (matchBtn)  matchBtn.style.display  = 'none';
        if (lockedEl)  lockedEl.style.display  = '';
        if (lockedDesc) {
          lockedDesc.textContent = stage === 'egg'
            ? name + ' hasn\'t hatched yet! Keep solving problems to hatch and evolve your pet.'
            : name + ' is still a baby! Keep solving problems to evolve and unlock multiplayer battles.';
        }
        playerPet = null;
      }
    }).catch(function(e){ console.warn('Multiplayer lobby:', e); });
  }

  // ═══════════════════════════════════════════════════
  //  CPU GENERATION
  // ═══════════════════════════════════════════════════
  function generateCpu() {
    var t = CPU_PETS[Math.floor(Math.random()*CPU_PETS.length)];
    var h = randInt(48,70);
    return { name:t.name, sprite:t.sprite,
      maxHp:h*4, hp:h*4,
      atk:randInt(44,72), def:randInt(38,66),
      spAtk:randInt(42,70), spDef:randInt(35,62),
      spd:randInt(40,70),
      guarding:false, superCd:0 };
  }

  // ═══════════════════════════════════════════════════
  //  MATCHMAKING
  // ═══════════════════════════════════════════════════
  function startMatchmaking() {
    if (!playerPet) return;
    setBattleBg(true);
    startBattleMusic();
    showScreen('screen-matchmaking');

    var sp = document.getElementById('mm-pet-sprite');
    if (sp && playerPet.sprite) { applySprite(sp, playerPet.sprite, true); }
    setText('mm-pet-name', playerPet.name);
    // Reset question mark side (CPU not known yet)
    var mmCpuSprite = document.getElementById('mm-cpu-sprite');
    if (mmCpuSprite) mmCpuSprite.style.backgroundImage = '';

    setTimeout(function() {
      cpuPet = generateCpu();
      initBattle();
    }, 2200);
  }

  // ═══════════════════════════════════════════════════
  //  BATTLE INIT
  // ═══════════════════════════════════════════════════
  function initBattle() {
    playerPet.hp=playerPet.maxHp; playerPet.guarding=false; playerPet.superCd=0;
    cpuPet.hp  =cpuPet.maxHp;    cpuPet.guarding  =false; cpuPet.superCd  =0;
    animating=false; playerTurn=true;

    var cpuEl = document.getElementById('cpu-sprite');
    if (cpuEl) { applySprite(cpuEl, cpuPet.sprite, true); }

    var plEl = document.getElementById('player-sprite');
    if (plEl) { applySprite(plEl, playerPet.sprite, true); }

    setText('cpu-name',    cpuPet.name);
    setText('player-name', playerPet.name);
    updateHpBar('cpu',    cpuPet.hp,    cpuPet.maxHp);
    updateHpBar('player', playerPet.hp, playerPet.maxHp);
    setLog('Your turn! Choose an action.');
    setActionsEnabled(true);
    showScreen('screen-battle');
  }

  // ═══════════════════════════════════════════════════
  //  BATTLE UI
  // ═══════════════════════════════════════════════════
  function setLog(msg){ setText('battle-log-text', msg); }

  function updateHpBar(who, cur, max) {
    var pct = Math.max(0, Math.min(1, cur/max)) * 100;
    var bar = document.getElementById(who+'-hp-bar');
    var txt = document.getElementById(who+'-hp-text');
    if (bar) {
      bar.style.width = pct+'%';
      bar.style.backgroundColor = pct>50 ? '#4caf50' : pct>25 ? '#ff9800' : '#f44336';
    }
    if (txt) txt.textContent = Math.max(0,Math.round(cur))+' / '+max;
  }

  function setActionsEnabled(on) {
    document.querySelectorAll('.battle-btn').forEach(function(b){ b.disabled=!on; });
    var sb  = document.getElementById('btn-super');
    var scd = document.getElementById('super-cd-text');
    if (sb && playerPet) {
      if (on && playerPet.superCd > 0) {
        sb.disabled=true; sb.classList.add('on-cooldown');
        if(scd){ scd.textContent=playerPet.superCd; scd.classList.add('visible'); }
      } else {
        sb.classList.remove('on-cooldown');
        if(scd){ scd.textContent=''; scd.classList.remove('visible'); }
      }
    }
  }

  // ═══════════════════════════════════════════════════
  //  DAMAGE FORMULAS
  // ═══════════════════════════════════════════════════
  function calcScratch(atk,def){ return Math.max(1, Math.round(Math.max(2, atk-def*0.50)*randF(0.85,1.15))); }
  function calcSuper(spA,spD)  { return Math.max(2, Math.round(Math.max(3, spA-spD*0.30)*randF(1.2,1.5))); }

  // ═══════════════════════════════════════════════════
  //  VISUAL EFFECTS
  // ═══════════════════════════════════════════════════
  function showFx(who, icon, type) {
    var el = document.getElementById(who+'-fx');
    if (!el) return;
    var img = el.querySelector('img');
    if (img) img.src = icon;
    el.classList.remove('pop','pop-scratch','pop-guard','pop-super');
    void el.offsetWidth;
    var cls = type==='scratch' ? 'pop-scratch' : type==='guard' ? 'pop-guard' : type==='super' ? 'pop-super' : 'pop';
    el.classList.add(cls);
  }

  function flashSprite(spriteId, type) {
    var el = document.getElementById(spriteId);
    if (!el) return;
    el.classList.remove('fx-hit','fx-guard','fx-super');
    void el.offsetWidth;
    el.classList.add(type==='hit'?'fx-hit': type==='guard'?'fx-guard':'fx-super');
    setTimeout(function(){ el.classList.remove('fx-hit','fx-guard','fx-super'); }, 700);
  }

  function flashArena() {
    var arena = document.querySelector('.battle-arena-zone');
    if (!arena) return;
    var f = document.createElement('div');
    f.style.cssText = 'position:absolute;inset:0;z-index:98;pointer-events:none;border-radius:8px;background:rgba(255,220,30,.55);animation:battle-flash-fade .55s ease forwards;';
    arena.appendChild(f);
    setTimeout(function(){ if (f.parentNode) f.parentNode.removeChild(f); }, 620);
  }

  // ═══════════════════════════════════════════════════
  //  ACTION RESOLUTION
  // ═══════════════════════════════════════════════════
  function resolveAction(action, attacker, defender, atkWho, defWho) {
    return new Promise(function(resolve) {
      var dmg=0, log='';

      if (action==='scratch') {
        dmg = calcScratch(attacker.atk, defender.def);
        if (defender.guarding){ dmg=Math.floor(dmg*0.5); defender.guarding=false; }
        showFx(defWho, '../../assets/icons/scratch.png', 'scratch');
        flashSprite(defWho+'-sprite', 'hit');
        defender.hp -= dmg;
        log = attacker.name+' scratched for '+dmg+' damage!';

      } else if (action==='guard') {
        attacker.guarding = true;
        showFx(atkWho, '../../assets/icons/guard.png', 'guard');
        flashSprite(atkWho+'-sprite', 'guard');
        log = attacker.name+' braced for impact!';

      } else if (action==='super') {
        attacker.superCd = 2;
        dmg = calcSuper(attacker.spAtk, defender.spDef);
        if (defender.guarding){ dmg=Math.floor(dmg*0.5); defender.guarding=false; }
        showFx(defWho, '../../assets/icons/SuperAttack.png', 'super');
        flashSprite(defWho+'-sprite', 'super');
        flashArena();
        defender.hp -= dmg;
        log = attacker.name+' unleashed Super Attack! ('+dmg+' dmg)';
      }

      setLog(log);
      setTimeout(resolve, 680);
    });
  }

  // ═══════════════════════════════════════════════════
  //  PLAYER TURN
  // ═══════════════════════════════════════════════════
  function playerAction(type) {
    if (animating || !playerTurn) return;
    if (type==='super' && playerPet.superCd>0) return;
    animating=true; playerTurn=false;
    setActionsEnabled(false);

    resolveAction(type, playerPet, cpuPet, 'player', 'cpu').then(function() {
      updateHpBar('cpu', cpuPet.hp, cpuPet.maxHp);
      if (cpuPet.hp <= 0) { setTimeout(showWin, 400); return; }

      setLog(cpuPet.name+' is thinking...');
      return sleep(800).then(function() {
        return resolveAction(cpuChooseAction(), cpuPet, playerPet, 'cpu', 'player');
      }).then(function() {
        updateHpBar('player', playerPet.hp, playerPet.maxHp);
        if (playerPet.hp <= 0) { setTimeout(showLose, 400); return; }

        if (playerPet.superCd > 0) playerPet.superCd--;
        if (cpuPet.superCd    > 0) cpuPet.superCd--;

        animating=false; playerTurn=true;
        setLog('Your turn! Choose an action.');
        setActionsEnabled(true);
      });
    });
  }

  // ═══════════════════════════════════════════════════
  //  CPU AI
  // ═══════════════════════════════════════════════════
  function cpuChooseAction() {
    var r = Math.random();
    var hpPct = cpuPet.hp / cpuPet.maxHp;

    // Critical: go offensive
    if (hpPct < 0.25) {
      if (cpuPet.superCd === 0 && r < 0.42) return 'super';
      return r < 0.72 ? 'scratch' : 'guard';
    }

    // Low HP: balanced mix
    if (hpPct < 0.5) {
      if (r < 0.18) return 'guard';
      if (cpuPet.superCd === 0 && r < 0.40) return 'super';
      return 'scratch';
    }

    // Healthy: mostly scratch, moderate super usage
    if (cpuPet.superCd === 0 && r < 0.26) return 'super';
    if (r < 0.70) return 'scratch';
    return 'guard';
  }

  // ═══════════════════════════════════════════════════
  //  RESULT SCREENS
  // ═══════════════════════════════════════════════════
  function showWin() {
    var el = document.getElementById('win-sprite');
    if (el && playerPet && playerPet.sprite) { applySprite(el, playerPet.sprite, false); }
    showScreen('screen-win');
  }

  function showLose() {
    var el = document.getElementById('lose-sprite');
    if (el && playerPet && playerPet.sprite) { applySprite(el, playerPet.sprite, false); }
    showScreen('screen-lose');
  }

  // ═══════════════════════════════════════════════════
  //  INIT
  // ═══════════════════════════════════════════════════
  document.addEventListener('DOMContentLoaded', function() {
    initLobby();

    document.getElementById('community-back-btn')?.addEventListener('click', handleBack);
    document.getElementById('battle-exit-btn')?.addEventListener('click', goToLobby);
    document.getElementById('multi-match-btn')?.addEventListener('click', startMatchmaking);

    document.getElementById('btn-scratch')?.addEventListener('click', function(){ playerAction('scratch'); });
    document.getElementById('btn-guard')  ?.addEventListener('click', function(){ playerAction('guard');   });
    document.getElementById('btn-super')  ?.addEventListener('click', function(){ playerAction('super');   });

    // Win screen
    document.getElementById('win-again-btn')?.addEventListener('click', startMatchmaking);
    document.getElementById('win-home-btn') ?.addEventListener('click', goToLobby);

    // Lose screen
    document.getElementById('lose-again-btn')?.addEventListener('click', startMatchmaking);
    document.getElementById('lose-home-btn') ?.addEventListener('click', goToLobby);
  });

})();
