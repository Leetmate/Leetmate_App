// TODO: Replace hardcoded active pet and stage with actual values from Firestore 

const PET_ASSETS = {
    Bat: {
        egg: '../../assets/eggs/CubicBatEgg.png',
        baby: '../../assets/spritesheets/CubicBatBaby.png',
        adult: '../../assets/spritesheets/CubicBatAdult.png'
    },
    Cat: {
        egg: '../../assets/eggs/CubicCatEgg.png',
        baby: '../../assets/spritesheets/CubicCatBaby.png',
        adult: '../../assets/spritesheets/CubicCatAdult.png'
    },
    Fox: {
        egg: '../../assets/eggs/CubicFoxEgg.png',
        baby: '../../assets/spritesheets/CubicFoxBaby.png',
        adult: '../../assets/spritesheets/CubicFoxAdult.png'
    }
};

function getEvolutionStages(activeStage = 'egg') {
    const normalizedStage = String(activeStage || 'egg').toLowerCase();

    if (normalizedStage === 'egg') {
        return { fromStage: 'egg', toStage: 'baby' };
    }

    if (normalizedStage === 'baby' || normalizedStage === 'child') {
        return { fromStage: 'baby', toStage: 'adult' };
    }

    return { fromStage: 'egg', toStage: 'baby' };
}

function playEvolutionAnimation(petType, activeStage = 'egg') {
    const evolutionWrap = document.querySelector('.evolution-wrap');
    const eggStage = document.getElementById('egg-stage');
    const eggEl = document.getElementById('active-pet-egg');
    const fromPetSprite = document.getElementById('active-from-pet');
    const petSprite = document.getElementById('active-pet');
    const topBanner = document.getElementById('top-banner');
    const bottomBanner = document.getElementById('bottom-banner');

    const assetSet = PET_ASSETS[petType];
    const stages = getEvolutionStages(activeStage);

    if (!evolutionWrap || !eggStage || !eggEl || !fromPetSprite || !petSprite || !assetSet) {
        return;
    }

    const { fromStage, toStage } = stages;

    topBanner?.classList.add('hidden');
    bottomBanner?.classList.add('hidden');

    evolutionWrap.classList.remove('is-hatching');
    eggStage.classList.remove('hatching', 'evolving-child');
    eggStage.classList.remove('hidden');

    eggEl.classList.add('hidden');
    fromPetSprite.classList.add('hidden');
    petSprite.classList.add('hidden');
    petSprite.classList.remove('hatch-appear');

    petSprite.style.backgroundImage = `url("${assetSet[toStage]}")`;

    if (fromStage === 'egg') {
        eggEl.src = assetSet.egg;
        eggEl.classList.remove('hidden');

        void eggStage.offsetWidth;
        evolutionWrap.classList.add('is-hatching');
        eggStage.classList.add('hatching');
    } else {
        fromPetSprite.style.backgroundImage = `url("${assetSet.baby}")`;
        fromPetSprite.style.backgroundPosition = '0% 0%';
        fromPetSprite.classList.remove('hidden');

        void eggStage.offsetWidth;
        evolutionWrap.classList.add('is-hatching');
        eggStage.classList.add('evolving-child');
    }

    const revealDelay = fromStage === 'baby' ? 1000 : 1600;
    setTimeout(() => {
        eggStage.classList.add('hidden');
        petSprite.classList.remove('hidden');
        petSprite.classList.add('hatch-appear');
    }, revealDelay);

    setTimeout(() => {
        topBanner?.classList.remove('hidden');
        bottomBanner?.classList.remove('hidden');
    }, 2200);
}
  
function setupButtons() {
    const replayBtn = document.getElementById('replay-btn');
    const homeBtn = document.getElementById('home-btn');

    replayBtn?.addEventListener('click', () => {
    //   playEvolutionAnimation('Bat', 'egg');
    playEvolutionAnimation('Bat', 'child');
    });

    homeBtn?.addEventListener('click', () => {
        if (window.history.length > 1) {
        window.history.back();
        } else {
        window.location.href = '../../index.html';
        }
    });
}
  
window.addEventListener('load', () => {
    setupButtons();

    playEvolutionAnimation('Bat', 'egg');
    // playEvolutionAnimation('Bat', 'child');
});