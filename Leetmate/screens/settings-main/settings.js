const MUSIC_STORAGE_VOLUME = 'leetmate_music_volume';
const MUSIC_STORAGE_MUTED = 'leetmate_music_muted';
const MUSIC_DEFAULT_VOLUME = 0.14;
const MUSIC_ICON_SOUND = '../../assets/icons/sound.png';
const MUSIC_ICON_MUTE = '../../assets/icons/mute.png';

// Simple sign out and navigation logic for the settings page
function initEasyModeInfoModal() {
    const openBtn = document.getElementById('easy-mode-info-btn');
    const modal = document.getElementById('easy-mode-info-modal');
    const closeBtn = document.getElementById('easy-mode-info-close');
    const backdrop = modal && modal.querySelector('.settings-modal__backdrop');
    if (!openBtn || !modal || !closeBtn || !backdrop) return;

    function openModal() {
        modal.hidden = false;
        closeBtn.focus();
    }

    function closeModal() {
        modal.hidden = true;
        openBtn.focus();
    }

    openBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openModal();
    });

    closeBtn.addEventListener('click', () => closeModal());
    backdrop.addEventListener('click', () => closeModal());

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !modal.hidden) {
            closeModal();
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    if (window.LeetmateEasyMode && typeof window.LeetmateEasyMode.initEasyModeToggle === 'function') {
        window.LeetmateEasyMode.initEasyModeToggle();
    }

    initEasyModeInfoModal();

    const volumeSlider = document.getElementById('music-volume-slider');
    const muteBtn = document.getElementById('music-mute-btn');
    const volumeIcon = document.getElementById('music-volume-icon');
    if (volumeSlider && muteBtn && typeof storageGet === 'function' && typeof storageSet === 'function') {
        let musicVolume = MUSIC_DEFAULT_VOLUME;
        let musicMuted = false;

        /** True when no audible output: explicit mute or volume at minimum. */
        function isEffectivelySilent() {
            return musicMuted || musicVolume <= 0;
        }

        function syncMusicUI() {
            volumeSlider.value = String(Math.round(musicVolume * 100));
            volumeSlider.style.setProperty('--volume-pct', String(musicVolume));
            const silent = isEffectivelySilent();
            muteBtn.classList.toggle('is-muted', silent);
            muteBtn.setAttribute('aria-pressed', silent ? 'true' : 'false');
            muteBtn.setAttribute(
                'aria-label',
                silent ? 'Unmute background music' : 'Mute background music'
            );
            if (volumeIcon) {
                volumeIcon.src = silent ? MUSIC_ICON_MUTE : MUSIC_ICON_SOUND;
            }
        }

        storageGet([MUSIC_STORAGE_VOLUME, MUSIC_STORAGE_MUTED]).then((data) => {
            if (typeof data[MUSIC_STORAGE_VOLUME] === 'number') {
                musicVolume = Math.max(0, Math.min(1, data[MUSIC_STORAGE_VOLUME]));
            }
            musicMuted = !!data[MUSIC_STORAGE_MUTED];
            syncMusicUI();
        });

        volumeSlider.addEventListener('input', () => {
            musicVolume = Number(volumeSlider.value) / 100;
            musicMuted = false;
            storageSet({
                [MUSIC_STORAGE_VOLUME]: musicVolume,
                [MUSIC_STORAGE_MUTED]: false,
            });
            syncMusicUI();
        });

        muteBtn.addEventListener('click', () => {
            musicMuted = !musicMuted;
            storageSet({
                [MUSIC_STORAGE_VOLUME]: musicVolume,
                [MUSIC_STORAGE_MUTED]: musicMuted,
            });
            syncMusicUI();
        });
    }

    // Handle Sign Out Button
    const signoutBtn = document.getElementById('signout-btn');
    if (signoutBtn) {
        signoutBtn.addEventListener('click', async () => {
            if (firebase && firebase.auth) {
                try {
                    await clearAppStorage(); // clear all chrome storage
                    await storageSet({
                        uid: null,
                        leetcodeUsername: null,
                        leetmate_easy_mode: false,
                        leetmate_happiness_easy_snapshot: null,
                    });

                    await firebase.auth().signOut();
                    window.location.replace('../start/index.html');
                } catch (error) {
                    console.error('Sign out error', error);
                }
            }
        });
    }
});

const notifButton = document.getElementById('notif-btn');
if (notifButton) {
    notifButton.addEventListener('click', function () {
        window.location.href = '/screens/settings-notifications/index.html';
    });
}

const accountButton = document.getElementById('acc-info-btn');
if (accountButton) {
    accountButton.addEventListener('click', function () {
        window.location.href = '/screens/settings-account/index.html';
    });
}