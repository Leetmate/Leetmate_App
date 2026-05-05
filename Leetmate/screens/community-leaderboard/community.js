/**
 * Global leaderboard — frontend list + sorting.
 *
 * Ranking: higher trophies first.
 * Tie-break (same trophy count): earlier account creation wins (older accounts rank above newer).
 *   Same trophy count & same creation day/time: Alphabetical by username.
 *
 * Data: MOCK_LEADERBOARD for UI.
 */
(function () {
  'use strict';
  const db = firebase.firestore();
  let ascendingOrderTrophies = [];
  async function getTrophiesList() {
    let petIndex = 0;
    try {
      //works. create index first
      const snapshot = await db.collection("users")
        .orderBy("trophy", "desc")
        .orderBy("username", "asc")
        .get();

      if (snapshot.empty)
      {
        console.log("No matching documents found.");
        return;
      }

      snapshot.forEach(doc => {
        ascendingOrderTrophies.push(doc.data());

        //extract the type of pet the active pet is
        let petType = doc.data().activePetId.split("_")[0];
        //let petType = db.collection("users").(doc.data().uid).collection("pets").doc(doc.data().activePetId).petRef;
        console.log(petType);

        //add the petRef field to the object in the array so following functions work
        ascendingOrderTrophies[petIndex].petRef = petType;
        petIndex++;
        //console.log(typeof(doc.data()));
      });
    } catch (error) {
      console.error("Error getting trophy list:", error.message);
    }

    console.log(ascendingOrderTrophies);
  }

  var MOCK_LEADERBOARD = [
    {
      uid: 'mock-1',
      username: 'MasterOfPuppets',
      trophy: 1178,
      petRef: 'Wolf',
      equippedItemId: null,
      createdAtMs: 1704067200000,
    },
    {
      uid: 'mock-2',
      username: 'PrincessSparkles',
      trophy: 949,
      petRef: 'Cat',
      equippedItemId: 'acc-santahat',
      createdAtMs: 1706745600000,
    },
    {
      uid: 'mock-3',
      username: '.execute.',
      trophy: 203,
      petRef: 'Bat',
      equippedItemId: null,
      createdAtMs: 1709251200000,
    },
    {
      uid: 'mock-4',
      username: 'TheEightfoldPath',
      trophy: 48,
      petRef: 'Fox',
      equippedItemId: 'acc-greyhat',
      createdAtMs: 1711929600000,
    },
    {
      uid: 'mock-tie-a',
      username: 'OlderTieAccount',
      trophy: 5,
      petRef: 'Frog',
      equippedItemId: null,
      createdAtMs: 1609459200000,
    },
    {
      uid: 'mock-tie-b',
      username: 'YoungerTieAccount',
      trophy: 5,
      petRef: 'Giraffe',
      equippedItemId: null,
      createdAtMs: 1735689600000,
    },
  ];

  var PET_SPRITES = {
    Bat: '../../assets/spritesheets/CubicBatAdult.png',
    Cat: '../../assets/spritesheets/CubicCatAdult.png',
    Fish: '../../assets/spritesheets/CubicFishAdult.png',
    Fox: '../../assets/spritesheets/CubicFoxAdult.png',
    Frog: '../../assets/spritesheets/CubicFrogAdult.png',
    Jaguatirica: '../../assets/spritesheets/CubicJaguatiricaAdult.png',
    Wolf: '../../assets/spritesheets/CubicWolfAdult.png',
    Giraffe: '../../assets/spritesheets/CubicGiraffeAdult.png',
    MicoLeaoDourado: '../../assets/spritesheets/CubicMicoLeaoDouradoAdult.png',
  };

  var SINGLE_ROW_PETS = { Fish: true, Jaguatirica: true };

  var ACCESSORY_SUFFIX = {
    'acc-greyhat': 'GreyHat',
    'acc-brownhat': 'BrownHat',
    'acc-strawhat': 'StrawHat',
    'acc-tophat': 'TopHat',
    'acc-santahat': 'SantaHat',
    'acc-leprechaunhat': 'LeprechaunHat',
  };

  function resolveSpriteSrc(petRef, equippedItemId) {
    var suffix = equippedItemId && ACCESSORY_SUFFIX[equippedItemId];
    if (suffix && petRef) {
      return '../../assets/spritesheets/Cubic' + petRef + suffix + '.png';
    }
    return PET_SPRITES[petRef] || null;
  }

  function applyAvatarSprite(el, petRef, equippedItemId, emptyClass) {
    var sprite = resolveSpriteSrc(petRef, equippedItemId);
    if (!sprite) {
      if (emptyClass) el.classList.add(emptyClass);
      el.textContent = '🥚';
      return;
    }
    el.style.backgroundImage = 'url("' + sprite + '")';
    if (SINGLE_ROW_PETS[petRef]) {
      el.style.backgroundSize = '700% 100%';
      el.style.backgroundPosition = '0% 0%';
    }
  }

  /**
   * @param {{ trophy?: number, createdAtMs?: number, username?: string }} a
   * @param {{ trophy?: number, createdAtMs?: number, username?: string }} b
   */
  function compareEntries(a, b) {
    var ta = Number(a.trophy || 0);
    var tb = Number(b.trophy || 0);
    if (tb !== ta) return tb - ta;
    var ca = Number(a.createdAtMs || 0);
    var cb = Number(b.createdAtMs || 0);
    if (ca !== cb) return ca - cb;
    return String(a.username || '').localeCompare(String(b.username || ''));
  }

  function goToPublicProfile(uid) {
    if (!uid || String(uid).indexOf('mock-') === 0) return;
    window.location.href =
      '../community-friends-profile/index.html?uid=' + encodeURIComponent(uid);
  }

  function buildLeaderboardCard(entry, rank) {
    var li = document.createElement('li');
    var interactive = entry.uid && String(entry.uid).indexOf('mock-') !== 0;
    //var interactive = entry.uid;
    li.className = 'leaderboard-card';
    li.classList.add(interactive ? 'leaderboard-card--interactive' : 'leaderboard-card--static');
    li.setAttribute(
      'aria-label',
      'Rank ' + rank + ': ' + (entry.username || 'Player') + ', ' +
      Number(entry.trophy || 0).toLocaleString() + ' trophies'
    );

    var avatar = document.createElement('div');
    avatar.className = 'leaderboard-card__avatar';
    //let petRef = db.collection("users").doc(entry.uid).collection("pets").doc(entry.activePetId).get();
    //applyAvatarSprite(avatar, entry.petRef, entry.equippedItemId || null, 'leaderboard-card__avatar--empty');
    applyAvatarSprite(avatar, entry.petRef, entry.equippedItemId || null, 'leaderboard-card__avatar--empty');

    var name = document.createElement('span');
    name.className = 'leaderboard-card__name';
    name.textContent = entry.username || 'Unknown';

    var score = document.createElement('div');
    score.className = 'leaderboard-card__score';

    var trophyIcon = document.createElement('img');
    trophyIcon.src = '../../assets/icons/trophy.png';
    trophyIcon.className = 'leaderboard-card__trophy-icon';
    trophyIcon.alt = '';

    var trophyCount = document.createElement('span');
    trophyCount.className = 'leaderboard-card__trophy-count';
    trophyCount.textContent = Number(entry.trophy || 0).toLocaleString();

    score.appendChild(trophyIcon);
    score.appendChild(trophyCount);
    li.appendChild(avatar);
    li.appendChild(name);
    li.appendChild(score);

    if (interactive) {
      li.setAttribute('role', 'button');
      li.setAttribute('tabindex', '0');
      li.addEventListener('click', function () {
        goToPublicProfile(entry.uid);
      });
      li.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          goToPublicProfile(entry.uid);
        }
      });
    }

    return li;
  }

  var backBtn = document.getElementById('community-back-btn');
  var leaderboardList = document.getElementById('leaderboard-list');
  var leaderboardLoading = document.getElementById('leaderboard-loading');
  var leaderboardEmpty = document.getElementById('leaderboard-empty');

  if (backBtn) {
    backBtn.addEventListener('click', function () {
      window.location.href = '../community-main/index.html';
    });
  }

  function render(entries) {
    if (!leaderboardList || !leaderboardLoading || !leaderboardEmpty) return;

    //var sorted = (entries || []).slice().sort(compareEntries);
    var sorted = entries;

    leaderboardLoading.classList.add('hidden');
    if (!sorted.length) {
      leaderboardList.classList.add('hidden');
      leaderboardEmpty.classList.remove('hidden');
      return;
    }

    leaderboardEmpty.classList.add('hidden');
    leaderboardList.classList.remove('hidden');
    leaderboardList.innerHTML = '';
    sorted.forEach(function (entry, i) {
      leaderboardList.appendChild(buildLeaderboardCard(entry, i + 1));
    });
  }

  async function loadLeaderboard() {
    await getTrophiesList();

    leaderboardLoading.classList.remove('hidden');
    leaderboardList.classList.add('hidden');
    leaderboardEmpty.classList.add('hidden');

    /* Simulate async fetch — replace with Firestore snapshot when backend exists */
    window.setTimeout(function () {
      console.log(MOCK_LEADERBOARD);
      render(MOCK_LEADERBOARD);
    }, 280);

    window.setTimeout(function () {
      render(ascendingOrderTrophies);
    }, 280);
  }

  document.addEventListener('DOMContentLoaded', function () {
    loadLeaderboard();
  });
})();
