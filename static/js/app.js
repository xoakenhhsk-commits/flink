// Lumina Social Network Pro — Enhanced Engine
document.addEventListener('DOMContentLoaded', () => {
    // --- STATE ---
    let currentUser = null;
    let token = localStorage.getItem('lumina_token');
    let storyGroups = [];
    let currentStoryGroupIndex = 0;
    let currentStoryIndex = 0;
    let storyTimer = null;
    let viewedPosts = new Set();
    let currentMediaFile = null;
    let activeTag = null;

    // --- ELEMENTS ---
    const navItems = document.querySelectorAll('.nav-item[data-view], .mobile-nav-item[data-view]');
    const viewSections = document.querySelectorAll('.view-section');
    const userPill = document.getElementById('userPill');
    const pillAvatar = document.getElementById('pillAvatar');
    const pillName = document.getElementById('pillName');
    const pillUsername = document.getElementById('pillUsername');
    const logoutBtn = document.getElementById('logoutBtn');
    const loginPromptBtn = document.getElementById('loginPromptBtn');
    const adminNavBtn = document.getElementById('adminNavBtn');
    const mobileAdminBtn = document.getElementById('mobileAdminBtn');

    // Branding Elements
    const sidebarBrandName = document.getElementById('sidebarBrandName');
    const sidebarBrandIcon = document.getElementById('sidebarBrandIcon');
    const mobileBrandName = document.getElementById('mobileBrandName');
    const mobileBrandIcon = document.getElementById('mobileBrandIcon');

    // Modals
    const authModal = document.getElementById('authModal');
    const closeAuthModal = document.getElementById('closeAuthModal');
    const authTabs = document.querySelectorAll('.auth-tab');
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');

    // Create Post Elements
    const quickPostText = document.getElementById('quickPostText');
    const quickPostAvatar = document.getElementById('quickPostAvatar');
    const publishPostBtn = document.getElementById('publishPostBtn');
    const postPrivacySelect = document.getElementById('postPrivacySelect');
    const postImageInput = document.getElementById('postImageInput');
    const postVideoInput = document.getElementById('postVideoInput');
    const postAudioInput = document.getElementById('postAudioInput');
    const quickMediaPreview = document.getElementById('quickMediaPreview');
    const mediaPreviewContent = document.getElementById('mediaPreviewContent');
    const removeMediaBtn = document.getElementById('removeMediaBtn');

    // Tag Filter
    const activeTagBanner = document.getElementById('activeTagBanner');
    const currentTagName = document.getElementById('currentTagName');
    const clearTagFilterBtn = document.getElementById('clearTagFilterBtn');
    const trendingList = document.getElementById('trendingList');

    // Story Elements
    const storiesList = document.getElementById('storiesList');
    const addStoryTrigger = document.getElementById('addStoryTrigger');
    const openCreateStoryBtn = document.getElementById('openCreateStoryBtn');
    const createStoryModal = document.getElementById('createStoryModal');
    const closeStoryModal = document.getElementById('closeStoryModal');
    const storyFileInput = document.getElementById('storyFileInput');
    const storyDropzone = document.getElementById('storyDropzone');
    const storyFilePreview = document.getElementById('storyFilePreview');
    const createStoryForm = document.getElementById('createStoryForm');
    const storyCaption = document.getElementById('storyCaption');

    // Story Viewer Elements
    const storyViewerModal = document.getElementById('storyViewerModal');
    const closeStoryViewer = document.getElementById('closeStoryViewer');
    const storyProgressBars = document.getElementById('storyProgressBars');
    const viewerAvatar = document.getElementById('viewerAvatar');
    const viewerUsername = document.getElementById('viewerUsername');
    const viewerTime = document.getElementById('viewerTime');
    const storyViewsTag = document.getElementById('storyViewsTag');
    const storyViewerMedia = document.getElementById('storyViewerMedia');
    const storyViewerCaption = document.getElementById('storyViewerCaption');
    const storyPrevBtn = document.getElementById('storyPrevBtn');
    const storyNextBtn = document.getElementById('storyNextBtn');

    // Feed & Profile Elements
    const postsFeed = document.getElementById('postsFeed');
    const feedLoader = document.getElementById('feedLoader');
    const profileAvatar = document.getElementById('profileAvatar');
    const avatarLoadingOverlay = document.getElementById('avatarLoadingOverlay');
    const avatarFileInput = document.getElementById('avatarFileInput');
    const profileDisplayName = document.getElementById('profileDisplayName');
    const profileRole = document.getElementById('profileRole');
    const profileUsername = document.getElementById('profileUsername');
    const profileJoinDate = document.getElementById('profileJoinDate');
    const profileBio = document.getElementById('profileBio');
    const profilePostsCount = document.getElementById('profilePostsCount');
    const profileFollowersCount = document.getElementById('profileFollowersCount');
    const profileFollowingCount = document.getElementById('profileFollowingCount');
    const userPostsFeed = document.getElementById('userPostsFeed');
    const openEditProfileBtn = document.getElementById('openEditProfileBtn');
    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const profileLogoutBtn = document.getElementById('profileLogoutBtn');
    const profileTabItems = document.querySelectorAll('.profile-tab-item');
    const editProfileModal = document.getElementById('editProfileModal');
    const closeEditProfileModal = document.getElementById('closeEditProfileModal');
    const editProfileForm = document.getElementById('editProfileForm');
    const editDisplayName = document.getElementById('editDisplayName');
    const editBio = document.getElementById('editBio');

    // Settings Modal Elements
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModal = document.getElementById('closeSettingsModal');
    const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');
    const settingsTabContents = document.querySelectorAll('.settings-tab-content');
    const settingsProfileForm = document.getElementById('settingsProfileForm');
    const settingsDisplayName = document.getElementById('settingsDisplayName');
    const settingsBio = document.getElementById('settingsBio');
    const settingsAvatarPreview = document.getElementById('settingsAvatarPreview');
    const settingsAvatarFile = document.getElementById('settingsAvatarFile');
    const settingsProfileMsg = document.getElementById('settingsProfileMsg');
    const changePasswordForm = document.getElementById('changePasswordForm');
    const oldPasswordInput = document.getElementById('oldPasswordInput');
    const newPasswordInput = document.getElementById('newPasswordInput');
    const confirmNewPasswordInput = document.getElementById('confirmNewPasswordInput');
    const changePasswordMsg = document.getElementById('changePasswordMsg');
    const confirmLogoutBtn = document.getElementById('confirmLogoutBtn');

    // Toast Elements
    const appToast = document.getElementById('appToast');
    const toastIcon = document.getElementById('toastIcon');
    const toastText = document.getElementById('toastText');

    // Lightbox Elements
    const imageLightboxModal = document.getElementById('imageLightboxModal');
    const lightboxImg = document.getElementById('lightboxImg');
    const lightboxTitle = document.getElementById('lightboxTitle');
    const lightboxCaptionBar = document.getElementById('lightboxCaptionBar');
    const lightboxCaptionText = document.getElementById('lightboxCaptionText');
    const lightboxOpenTabBtn = document.getElementById('lightboxOpenTabBtn');
    const lightboxDownloadBtn = document.getElementById('lightboxDownloadBtn');
    const closeImageLightbox = document.getElementById('closeImageLightbox');
    const lightboxBody = document.getElementById('lightboxBody');

    // --- API HELPER ---
    async function apiFetch(url, options = {}) {
        options.headers = options.headers || {};
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        const res = await fetch(url, options);
        if (res.status === 401 && token) {
            localStorage.removeItem('lumina_token');
            token = null;
            currentUser = null;
            updateAuthUI();
        }
        return res;
    }

    // --- 1. INITIALIZE & BRAND SETTINGS ---
    async function initApp() {
        await loadSettings();
        await checkAuth();
        await loadStories();
        await loadTrending();
        await loadSuggestions();
        await loadPosts();
    }

    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            const s = await res.json();
            if (s.site_name) {
                document.title = `${s.site_name} — Mạng Xã Hội Đẳng Cấp`;
                if (sidebarBrandName) sidebarBrandName.textContent = s.site_name;
                if (mobileBrandName) mobileBrandName.textContent = s.site_name;
            }
            if (s.site_logo_url) {
                const imgHtml = `<img src="${s.site_logo_url}" alt="Logo">`;
                if (sidebarBrandIcon) sidebarBrandIcon.innerHTML = imgHtml;
                if (mobileBrandIcon) mobileBrandIcon.innerHTML = imgHtml;
            } else if (s.site_logo_icon) {
                const iconHtml = `<i class="${s.site_logo_icon}"></i>`;
                if (sidebarBrandIcon) sidebarBrandIcon.innerHTML = iconHtml;
                if (mobileBrandIcon) mobileBrandIcon.innerHTML = iconHtml;
            }
        } catch (e) {
            console.error('Settings load err', e);
        }
    }

    async function checkAuth() {
        try {
            const res = await apiFetch('/api/auth/me');
            const data = await res.json();
            currentUser = data.user;
            updateAuthUI();
        } catch (e) {
            currentUser = null;
            updateAuthUI();
        }
    }

    function getVerifiedBadge(isVerified, size = 18) {
        if (!isVerified) return '';
        return `<span class="verified-badge-wrap" title="Tài khoản đã xác minh chính chủ" style="display: inline-flex; align-items: center; justify-content: center; vertical-align: middle; margin-left: 5px; flex-shrink: 0; line-height: 1;">
            <svg viewBox="0 0 24 24" width="${size}" height="${size}" style="display: block; overflow: visible;">
                <circle cx="12" cy="12" r="10.5" fill="#0866FF"/>
                <path d="M10.2 15.8L6.4 12l1.4-1.4 2.4 2.4 6-6 1.4 1.4-7.4 7.4z" fill="#FFFFFF"/>
            </svg>
        </span>`;
    }

    function updateAuthUI() {
        const sidebarSettingsBtn = document.getElementById('sidebarSettingsBtn');
        if (currentUser) {
            userPill.style.display = 'flex';
            loginPromptBtn.style.display = 'none';
            pillAvatar.src = currentUser.avatar_url;
            pillName.innerHTML = `${escapeHtml(currentUser.display_name)} ${getVerifiedBadge(currentUser.is_verified, 15)}`;
            pillUsername.textContent = '@' + currentUser.username;
            quickPostAvatar.src = currentUser.avatar_url;
            if (sidebarSettingsBtn) sidebarSettingsBtn.style.display = 'flex';

            if (currentUser.role === 'admin') {
                if (adminNavBtn) adminNavBtn.style.display = 'flex';
                if (mobileAdminBtn) mobileAdminBtn.style.display = 'flex';
            } else {
                if (adminNavBtn) adminNavBtn.style.display = 'none';
                if (mobileAdminBtn) mobileAdminBtn.style.display = 'none';
            }
        } else {
            userPill.style.display = 'none';
            loginPromptBtn.style.display = 'block';
            quickPostAvatar.src = '/static/default-avatar.svg';
            if (sidebarSettingsBtn) sidebarSettingsBtn.style.display = 'none';
            if (adminNavBtn) adminNavBtn.style.display = 'none';
            if (mobileAdminBtn) mobileAdminBtn.style.display = 'none';
        }
    }

    // --- 2. NAVIGATION (SPA VIEWS) ---
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const viewName = item.getAttribute('data-view');
            switchView(viewName);
        });
    });

    function switchView(viewName) {
        navItems.forEach(n => {
            if (n.getAttribute('data-view') === viewName) {
                n.classList.add('active');
            } else {
                n.classList.remove('active');
            }
        });

        viewSections.forEach(sec => sec.style.display = 'none');

        if (viewName === 'feed' || viewName === 'explore') {
            document.getElementById('feedView').style.display = 'block';
            loadPosts();
        } else if (viewName === 'profile') {
            if (!currentUser) {
                openAuth('login');
                return;
            }
            viewUserProfile(currentUser.id);
        }
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    // Mobile Bottom Nav Triggers
    document.getElementById('mobileBottomCreateBtn').addEventListener('click', () => {
        switchView('feed');
        quickPostText.focus();
    });
    document.getElementById('mobileBottomStoryBtn').addEventListener('click', () => {
        if (!currentUser) return openAuth('login');
        createStoryModal.style.display = 'flex';
    });

    // --- 3. AUTHENTICATION MODAL ---
    function openAuth(tab = 'login') {
        authModal.style.display = 'flex';
        switchAuthTab(tab);
    }

    loginPromptBtn.addEventListener('click', () => openAuth('login'));
    document.getElementById('mobileAuthBtn').addEventListener('click', () => {
        if (currentUser) {
            switchView('profile');
        } else {
            openAuth('login');
        }
    });

    closeAuthModal.addEventListener('click', () => authModal.style.display = 'none');

    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const target = tab.dataset.tab;
            switchAuthTab(target === 'loginTab' ? 'login' : 'register');
        });
    });

    function switchAuthTab(type) {
        authTabs.forEach(t => t.classList.remove('active'));
        loginError.style.display = 'none';
        registerError.style.display = 'none';

        if (type === 'login') {
            document.querySelector('.auth-tab[data-tab="loginTab"]').classList.add('active');
            loginForm.style.display = 'block';
            registerForm.style.display = 'none';
        } else {
            document.querySelector('.auth-tab[data-tab="registerTab"]').classList.add('active');
            loginForm.style.display = 'none';
            registerForm.style.display = 'block';
        }
    }

    // Login Form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.style.display = 'none';
        const account = document.getElementById('loginAccount').value.trim();
        const password = document.getElementById('loginPassword').value;

        const formData = new FormData();
        formData.append('account', account);
        formData.append('password', password);

        try {
            const res = await fetch('/api/auth/login', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Đăng nhập thất bại');

            token = data.token;
            currentUser = data.user;
            localStorage.setItem('lumina_token', token);
            updateAuthUI();
            authModal.style.display = 'none';
            loadPosts();
        } catch (err) {
            loginError.textContent = err.message;
            loginError.style.display = 'block';
        }
    });

    // Register Form
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.style.display = 'none';
        const displayName = document.getElementById('regDisplayName').value.trim();
        const username = document.getElementById('regUsername').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const password = document.getElementById('regPassword').value;

        const formData = new FormData();
        formData.append('display_name', displayName);
        formData.append('username', username);
        formData.append('email', email);
        formData.append('password', password);

        try {
            const res = await fetch('/api/auth/register', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Đăng ký thất bại');

            token = data.token;
            currentUser = data.user;
            localStorage.setItem('lumina_token', token);
            updateAuthUI();
            authModal.style.display = 'none';
            loadPosts();
        } catch (err) {
            registerError.textContent = err.message;
            registerError.style.display = 'block';
        }
    });

    logoutBtn.addEventListener('click', async () => {
        if (!confirm('Bạn có chắc chắn muốn đăng xuất không?')) return;
        await apiFetch('/api/auth/logout', { method: 'POST' });
        token = null;
        currentUser = null;
        localStorage.removeItem('lumina_token');
        updateAuthUI();
        switchView('feed');
    });

    // --- 4. STORIES SYSTEM (24h) ---
    async function loadStories() {
        try {
            const res = await apiFetch('/api/stories');
            const data = await res.json();
            storyGroups = data.story_groups || [];
            renderStories();
        } catch (e) {
            console.error('Lỗi tải stories', e);
        }
    }

    let isStoryMuted = false;
    let isStoryPaused = false;

    function renderStories() {
        storiesList.innerHTML = '';
        if (storyGroups.length === 0) return;

        storyGroups.forEach((group, groupIdx) => {
            const item = document.createElement('div');
            item.className = 'story-item';
            item.innerHTML = `
                <div class="story-ring">
                    <img src="${group.avatar_url}" class="story-thumb" alt="${group.username}">
                </div>
                <span class="story-author">${escapeHtml(group.display_name)}</span>
            `;
            item.addEventListener('click', () => openStoryViewer(groupIdx, 0));
            storiesList.appendChild(item);
        });
    }

    function openStoryViewer(groupIdx, storyIdx) {
        currentStoryGroupIndex = groupIdx;
        currentStoryIndex = storyIdx;
        isStoryPaused = false;
        storyViewerModal.style.display = 'flex';
        showStory();
    }

    function showStory() {
        clearTimeout(storyTimer);
        const group = storyGroups[currentStoryGroupIndex];
        if (!group || !group.stories || group.stories.length === 0) {
            closeStoryViewerModal();
            return;
        }

        const story = group.stories[currentStoryIndex];
        const isOwner = currentUser && (currentUser.id === story.user_id || currentUser.role === 'admin');

        viewerAvatar.src = group.avatar_url;
        viewerUsername.innerHTML = `${escapeHtml(group.display_name)}${getVerifiedBadge(group.is_verified, 15)}`;
        viewerTime.textContent = formatTime(story.created_at);

        // Header User Info click -> view profile
        const headerInfo = document.getElementById('storyHeaderUserInfo');
        if (headerInfo) {
            headerInfo.onclick = () => {
                closeStoryViewerModal();
                viewUserProfile(group.user_id);
            };
        }

        // Privacy tag
        const viewerPrivacyTag = document.getElementById('viewerPrivacyTag');
        if (viewerPrivacyTag) {
            if (story.privacy === 'followers') {
                viewerPrivacyTag.innerHTML = '<i class="fa-solid fa-user-group" style="color:#eab308;"></i> Bạn bè';
                viewerPrivacyTag.title = 'Chỉ người theo dõi / bạn bè mới xem được Story này';
            } else {
                viewerPrivacyTag.innerHTML = '<i class="fa-solid fa-globe" style="color:#38bdf8;"></i> Công khai';
                viewerPrivacyTag.title = 'Story công khai với tất cả mọi người';
            }
        }

        // Sound & Delete Buttons
        const soundBtn = document.getElementById('storySoundBtn');
        const deleteBtn = document.getElementById('deleteStoryBtn');
        if (deleteBtn) {
            deleteBtn.style.display = isOwner ? 'inline-flex' : 'none';
            deleteBtn.onclick = async (e) => {
                e.stopPropagation();
                if (!confirm('Bạn có chắc chắn muốn xóa Story này không?')) return;
                clearTimeout(storyTimer);
                try {
                    const res = await apiFetch(`/api/stories/${story.id}`, { method: 'DELETE' });
                    if (res.ok) {
                        showToast('Đã xóa Story thành công!');
                        closeStoryViewerModal();
                        await loadStories();
                    } else {
                        showToast('Lỗi khi xóa Story', false);
                    }
                } catch (err) {
                    showToast('Lỗi kết nối máy chủ', false);
                }
            };
        }

        // Viewers count trigger button
        const viewersBtn = document.getElementById('storyViewersBtn');
        const viewersCountText = document.getElementById('storyViewersCountText');
        if (viewersBtn && viewersCountText) {
            if (isOwner) {
                viewersBtn.style.display = 'inline-flex';
                viewersCountText.textContent = story.views_count || 0;
                viewersBtn.onclick = (e) => {
                    e.stopPropagation();
                    openStoryViewersModal(story.id);
                };
            } else {
                viewersBtn.style.display = 'none';
            }
        }

        storyViewerCaption.textContent = story.caption || '';
        storyViewerCaption.style.display = story.caption ? 'block' : 'none';

        // Setup Media (Image or Video)
        storyViewerMedia.innerHTML = '';
        let storyDurationMs = 5000; // default 5s for image

        if (story.media_type === 'video') {
            if (soundBtn) {
                soundBtn.style.display = 'inline-flex';
                soundBtn.innerHTML = isStoryMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
                soundBtn.onclick = (e) => {
                    e.stopPropagation();
                    isStoryMuted = !isStoryMuted;
                    soundBtn.innerHTML = isStoryMuted ? '<i class="fa-solid fa-volume-xmark"></i>' : '<i class="fa-solid fa-volume-high"></i>';
                    const activeVideo = storyViewerMedia.querySelector('video');
                    if (activeVideo) activeVideo.muted = isStoryMuted;
                };
            }

            const video = document.createElement('video');
            video.src = story.media_url;
            video.playsInline = true;
            video.setAttribute('playsinline', '');
            video.setAttribute('webkit-playsinline', '');
            video.autoplay = true;
            video.muted = isStoryMuted;
            video.style.maxWidth = '100%';
            video.style.maxHeight = '100%';
            video.style.objectFit = 'contain';
            storyViewerMedia.appendChild(video);

            const startProgress = (durSec) => {
                const totalSec = Math.max(3, Math.min(durSec || 7, 300));
                storyDurationMs = totalSec * 1000;
                renderProgressBars(group.stories.length, currentStoryIndex, totalSec);
                clearTimeout(storyTimer);
                storyTimer = setTimeout(() => {
                    nextStory();
                }, storyDurationMs);
            };

            video.onloadedmetadata = () => {
                if (video.duration && !isNaN(video.duration)) {
                    startProgress(video.duration);
                } else {
                    startProgress(7);
                }
            };

            video.onended = () => {
                clearTimeout(storyTimer);
                nextStory();
            };

            // Start immediately with fallback in case metadata is slow
            startProgress(7);
        } else {
            if (soundBtn) soundBtn.style.display = 'none';
            const img = document.createElement('img');
            img.src = story.media_url;
            img.style.maxWidth = '100%';
            img.style.maxHeight = '100%';
            img.style.objectFit = 'contain';
            storyViewerMedia.appendChild(img);

            renderProgressBars(group.stories.length, currentStoryIndex, 5);
            clearTimeout(storyTimer);
            storyTimer = setTimeout(() => {
                nextStory();
            }, storyDurationMs);
        }

        // Record real view in database
        apiFetch(`/api/stories/${story.id}/view`, { method: 'POST' });
    }

    function renderProgressBars(totalStories, activeIdx, durationSec) {
        storyProgressBars.innerHTML = '';
        for (let idx = 0; idx < totalStories; idx++) {
            const track = document.createElement('div');
            track.className = 'story-prog-track';
            const fill = document.createElement('div');
            fill.className = 'story-prog-fill';
            if (idx < activeIdx) {
                fill.style.width = '100%';
            } else if (idx === activeIdx) {
                fill.style.width = '0%';
                setTimeout(() => {
                    fill.style.transition = `width ${durationSec}s linear`;
                    fill.style.width = '100%';
                }, 40);
            } else {
                fill.style.width = '0%';
            }
            track.appendChild(fill);
            storyProgressBars.appendChild(track);
        }
    }

    function nextStory() {
        const group = storyGroups[currentStoryGroupIndex];
        if (currentStoryIndex < group.stories.length - 1) {
            currentStoryIndex++;
            showStory();
        } else if (currentStoryGroupIndex < storyGroups.length - 1) {
            currentStoryGroupIndex++;
            currentStoryIndex = 0;
            showStory();
        } else {
            closeStoryViewerModal();
        }
    }

    function prevStory() {
        if (currentStoryIndex > 0) {
            currentStoryIndex--;
            showStory();
        } else if (currentStoryGroupIndex > 0) {
            currentStoryGroupIndex--;
            currentStoryIndex = storyGroups[currentStoryGroupIndex].stories.length - 1;
            showStory();
        }
    }

    storyNextBtn.addEventListener('click', (e) => { e.stopPropagation(); nextStory(); });
    storyPrevBtn.addEventListener('click', (e) => { e.stopPropagation(); prevStory(); });
    closeStoryViewer.addEventListener('click', closeStoryViewerModal);

    function closeStoryViewerModal() {
        clearTimeout(storyTimer);
        const video = storyViewerMedia.querySelector('video');
        if (video) {
            video.pause();
            video.src = '';
        }
        storyViewerModal.style.display = 'none';
        storyViewerMedia.innerHTML = '';
    }

    // --- STORY VIEWERS LIST MODAL ---
    const storyViewersModal = document.getElementById('storyViewersModal');
    const closeStoryViewersModal = document.getElementById('closeStoryViewersModal');
    const storyViewersList = document.getElementById('storyViewersList');
    const viewersModalTotal = document.getElementById('viewersModalTotal');

    async function openStoryViewersModal(storyId) {
        clearTimeout(storyTimer);
        const video = storyViewerMedia.querySelector('video');
        if (video) video.pause();

        storyViewersList.innerHTML = `
            <div style="text-align: center; padding: 24px; color: var(--text-secondary);">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--primary);"></i>
                <p style="margin-top: 8px; font-size: 13px;">Đang tải danh sách người xem...</p>
            </div>
        `;
        if (storyViewersModal) storyViewersModal.style.display = 'flex';

        try {
            const res = await apiFetch(`/api/stories/${storyId}/viewers`);
            const data = await res.json();
            const viewers = data.viewers || [];
            if (viewersModalTotal) viewersModalTotal.textContent = viewers.length;

            if (viewers.length === 0) {
                storyViewersList.innerHTML = `
                    <div style="text-align: center; padding: 30px; color: var(--text-muted);">
                        <i class="fa-regular fa-eye-slash" style="font-size: 32px; margin-bottom: 8px; opacity: 0.5;"></i>
                        <p style="font-size: 13px;">Chưa có người dùng nào xem Story này.</p>
                    </div>
                `;
                return;
            }

            storyViewersList.innerHTML = '';
            viewers.forEach(v => {
                const row = document.createElement('div');
                row.className = 'story-viewer-user-row';
                row.innerHTML = `
                    <div class="story-viewer-user-left">
                        <img src="${v.avatar_url || '/static/default-avatar.svg'}" alt="${v.username}">
                        <div>
                            <div class="story-viewer-user-name">
                                <span>${escapeHtml(v.display_name)}</span>
                                ${getVerifiedBadge(v.is_verified, 14)}
                            </div>
                            <div class="story-viewer-user-handle">@${v.username}</div>
                        </div>
                    </div>
                    <div class="story-viewer-viewed-time">
                        ${formatTime(v.viewed_at)}
                    </div>
                `;
                row.onclick = () => {
                    storyViewersModal.style.display = 'none';
                    closeStoryViewerModal();
                    viewUserProfile(v.user_id);
                };
                storyViewersList.appendChild(row);
            });
        } catch (err) {
            storyViewersList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--danger); font-size: 13px;">
                    Lỗi tải danh sách người xem
                </div>
            `;
        }
    }

    if (closeStoryViewersModal) {
        closeStoryViewersModal.addEventListener('click', () => {
            if (storyViewersModal) storyViewersModal.style.display = 'none';
            // Resume video if applicable
            const video = storyViewerMedia.querySelector('video');
            if (video) video.play();
        });
    }

    // --- CREATE STORY MODAL ---
    addStoryTrigger.addEventListener('click', () => {
        if (!currentUser) return openAuth('login');
        createStoryModal.style.display = 'flex';
    });
    openCreateStoryBtn.addEventListener('click', () => {
        if (!currentUser) return openAuth('login');
        createStoryModal.style.display = 'flex';
    });
    closeStoryModal.addEventListener('click', () => createStoryModal.style.display = 'none');

    storyDropzone.addEventListener('click', () => storyFileInput.click());
    storyFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
            const file = e.target.files[0];
            const isVideo = file.type.startsWith('video/');
            const url = URL.createObjectURL(file);
            storyFilePreview.innerHTML = isVideo 
                ? `<video src="${url}" controls playsinline webkit-playsinline style="max-height: 200px; width: 100%; object-fit: contain; border-radius: 8px; background: #000;"></video>`
                : `<img src="${url}" style="max-height: 200px; width: 100%; object-fit: contain; border-radius: 8px; cursor: zoom-in;" title="Xem trước ảnh">`;
            if (!isVideo) {
                const sImg = storyFilePreview.querySelector('img');
                if (sImg) sImg.onclick = () => openImageLightbox(url, 'Xem trước ảnh Story');
            }
        }
    });

    createStoryForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!storyFileInput.files[0]) return alert('Vui lòng chọn ảnh hoặc video');
        const submitBtn = document.getElementById('submitStoryBtn');
        const privacySelect = document.getElementById('storyPrivacySelect');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang tải lên Story...';

        const formData = new FormData();
        formData.append('media', storyFileInput.files[0]);
        formData.append('caption', storyCaption.value);
        formData.append('privacy', privacySelect ? privacySelect.value : 'public');

        try {
            const res = await apiFetch('/api/stories', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Lỗi khi đăng Story');
            showToast('Đã đăng Story thành công!');
            createStoryModal.style.display = 'none';
            createStoryForm.reset();
            storyFilePreview.innerHTML = '';
            await loadStories();
        } catch (err) {
            alert(err.message);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đăng Story 24h';
        }
    });

    // --- 5. HASHTAGS & TRENDING ---
    async function loadTrending() {
        try {
            const res = await fetch('/api/trending');
            const d = await res.json();
            renderTrending(d.trending || []);
        } catch (e) {
            console.error('Trending err', e);
        }
    }

    function renderTrending(tags) {
        trendingList.innerHTML = '';
        if (tags.length === 0) {
            trendingList.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Chưa có chủ đề nổi bật.</p>';
            return;
        }

        tags.forEach(t => {
            const item = document.createElement('div');
            item.className = 'trend-item';
            item.innerHTML = `
                <span class="trend-tag">${t.tag}</span>
                <span class="trend-count">${t.count} bài viết</span>
            `;
            item.addEventListener('click', () => {
                filterByTag(t.raw);
            });
            trendingList.appendChild(item);
        });
    }

    function filterByTag(tagName) {
        activeTag = tagName;
        currentTagName.textContent = `#${tagName}`;
        activeTagBanner.style.display = 'flex';
        loadPosts();
    }

    clearTagFilterBtn.addEventListener('click', () => {
        activeTag = null;
        activeTagBanner.style.display = 'none';
        loadPosts();
    });

    // --- 6. POST CREATION WITH PRIVACY & HASHTAGS ---
    [postImageInput, postVideoInput, postAudioInput].forEach(input => {
        input.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                currentMediaFile = e.target.files[0];
                renderMediaPreview(currentMediaFile);
            }
        });
    });

    function renderMediaPreview(file) {
        quickMediaPreview.style.display = 'block';
        mediaPreviewContent.innerHTML = '';
        const url = URL.createObjectURL(file);

        if (file.type.startsWith('image/')) {
            mediaPreviewContent.innerHTML = `<img src="${url}" style="max-height: 240px; border-radius: 8px; object-fit: contain; cursor: zoom-in;" title="Nhấp để xem ảnh đầy đủ">`;
            const pImg = mediaPreviewContent.querySelector('img');
            if (pImg) pImg.onclick = () => openImageLightbox(url, 'Xem trước ảnh tải lên');
        } else if (file.type.startsWith('video/')) {
            mediaPreviewContent.innerHTML = `<video src="${url}" controls playsinline webkit-playsinline style="max-height: 240px; border-radius: 8px; width: 100%;"></video>`;
        } else if (file.type.startsWith('audio/')) {
            mediaPreviewContent.innerHTML = `
                <div style="padding: 16px; background: rgba(99, 102, 241, 0.15); border-radius: 8px;">
                    <div style="margin-bottom: 8px; font-weight: 700; color: #a855f7;"><i class="fa-solid fa-music"></i> ${file.name}</div>
                    <audio src="${url}" controls style="width: 100%;"></audio>
                </div>
            `;
        }
    }

    removeMediaBtn.addEventListener('click', () => {
        currentMediaFile = null;
        postImageInput.value = '';
        postVideoInput.value = '';
        postAudioInput.value = '';
        quickMediaPreview.style.display = 'none';
        mediaPreviewContent.innerHTML = '';
    });

    publishPostBtn.addEventListener('click', async () => {
        if (!currentUser) return openAuth('login');
        const content = quickPostText.value.trim();
        const privacy = postPrivacySelect.value;

        if (!content && !currentMediaFile) {
            return alert('Vui lòng viết nội dung hoặc chọn tệp đính kèm');
        }

        publishPostBtn.disabled = true;
        publishPostBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang đăng...';

        const formData = new FormData();
        formData.append('content', content);
        formData.append('privacy', privacy);
        if (currentMediaFile) {
            formData.append('media', currentMediaFile);
        }

        try {
            const res = await apiFetch('/api/posts', { method: 'POST', body: formData });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Lỗi khi đăng bài');

            quickPostText.value = '';
            removeMediaBtn.click();
            await loadPosts();
            await loadTrending();
        } catch (err) {
            alert(err.message);
        } finally {
            publishPostBtn.disabled = false;
            publishPostBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Đăng';
        }
    });

    document.getElementById('openCreatePostBtn').addEventListener('click', () => {
        switchView('feed');
        quickPostText.focus();
    });
    document.getElementById('mobileCreateBtn').addEventListener('click', () => {
        switchView('feed');
        quickPostText.focus();
    });

    // --- 7. POSTS FEED & COMMENTS WITH REPLY ---
    async function loadPosts() {
        feedLoader.style.display = 'block';
        try {
            let url = '/api/posts';
            if (activeTag) url += `?tag=${encodeURIComponent(activeTag)}`;
            const res = await apiFetch(url);
            const data = await res.json();
            renderFeed(data.posts || []);
        } catch (e) {
            postsFeed.innerHTML = '<p style="text-align:center;color:var(--text-muted)">Không thể tải bài viết.</p>';
        } finally {
            feedLoader.style.display = 'none';
        }
    }

    // Real View Observer
    const postObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const postEl = entry.target;
                const postId = postEl.dataset.postId;
                if (postId && !viewedPosts.has(postId)) {
                    viewedPosts.add(postId);
                    apiFetch(`/api/posts/${postId}/view`, { method: 'POST' })
                        .then(r => r.json())
                        .then(d => {
                            if (d.views !== undefined) {
                                const countEl = postEl.querySelector('.view-count-num');
                                if (countEl) countEl.textContent = formatNumber(d.views);
                            }
                        })
                        .catch(() => {});
                }
            }
        });
    }, { threshold: 0.5 });

    function renderFeed(posts) {
        postsFeed.innerHTML = '';
        if (posts.length === 0) {
            postsFeed.innerHTML = `
                <div class="glass-card" style="padding: 40px; text-align: center; color: var(--text-secondary);">
                    <i class="fa-solid fa-feather" style="font-size: 40px; margin-bottom: 12px; color: var(--primary);"></i>
                    <p>Chưa có bài viết nào phù hợp. Hãy là người đầu tiên đăng bài!</p>
                </div>
            `;
            return;
        }

        posts.forEach(post => {
            const postCard = createPostCard(post);
            postsFeed.appendChild(postCard);
            postObserver.observe(postCard);
        });
    }

    function createPostCard(post) {
        const card = document.createElement('div');
        card.className = 'post-card glass-card';
        card.dataset.postId = post.id;

        const isAuthor = currentUser && currentUser.id === post.user_id;
        const isAdmin = currentUser && currentUser.role === 'admin';
        const canDelete = isAuthor || isAdmin;

        // Media Element
        let mediaHtml = '';
        if (post.media_type === 'image') {
            mediaHtml = `<div class="post-media-container"><img src="${post.media_url}" class="post-media-img" loading="lazy" alt="Media" title="Nhấp để xem ảnh đầy đủ"></div>`;
        } else if (post.media_type === 'video') {
            mediaHtml = `<div class="post-media-container"><video src="${post.media_url}" controls playsinline webkit-playsinline preload="metadata" class="post-media-video"></video></div>`;
        } else if (post.media_type === 'audio') {
            mediaHtml = `
                <div class="post-media-container">
                    <div class="post-media-audio">
                        <div class="audio-header">
                            <i class="fa-solid fa-circle-play" style="color:#a855f7; font-size:22px;"></i>
                            <span>${post.media_name || 'Bản ghi âm thanh / Nhạc'}</span>
                        </div>
                        <audio src="${post.media_url}" controls></audio>
                    </div>
                </div>
            `;
        }

        // Highlight Hashtags
        const formattedContent = formatPostContent(post.content);

        card.innerHTML = `
            <div class="post-header">
                <div class="post-user clickable-user" title="Xem trang cá nhân của ${post.display_name}">
                    <img src="${post.avatar_url}" class="avatar-small" alt="${post.username}">
                    <div>
                        <div style="display:flex;align-items:center;">
                            <span class="post-meta-name">${escapeHtml(post.display_name)}</span>${getVerifiedBadge(post.is_verified, 16)}
                            ${post.role === 'admin' ? '<span class="role-badge admin">Admin</span>' : ''}
                            ${post.privacy === 'private' ? '<span class="privacy-badge"><i class="fa-solid fa-lock"></i> Chỉ mình tôi</span>' : ''}
                        </div>
                        <span class="post-meta-handle">@${post.username} · <span class="post-time">${formatTime(post.created_at)}</span></span>
                    </div>
                </div>
                ${canDelete ? `<button class="delete-post-btn" title="Xóa bài viết"><i class="fa-solid fa-trash-can"></i></button>` : ''}
            </div>

            ${post.content ? `<div class="post-content">${formattedContent}</div>` : ''}
            ${mediaHtml}

            <div class="post-actions-bar">
                <div class="action-buttons-group">
                    <button class="action-btn like-btn ${post.is_liked ? 'liked' : ''}">
                        <i class="${post.is_liked ? 'fa-solid' : 'fa-regular'} fa-heart"></i>
                        <span class="like-count">${post.likes_count}</span>
                    </button>
                    <button class="action-btn comment-btn">
                        <i class="fa-regular fa-comment"></i>
                        <span class="comment-count">${post.comments_count}</span>
                    </button>
                    <span class="real-views-badge" title="Lượt xem thật từ người dùng">
                        <i class="fa-solid fa-eye"></i> <span class="view-count-num">${formatNumber(post.views_count)}</span>
                    </span>
                </div>
            </div>

            <!-- Comments Accordion with Collapse & Rep -->
            <div class="comments-accordion">
                <div class="comments-header-row">
                    <span style="font-size:12px;font-weight:700;color:var(--text-secondary);">Bình luận</span>
                    <button class="collapse-comments-btn"><i class="fa-solid fa-chevron-up"></i> Thu gọn</button>
                </div>

                <div class="comments-list"></div>

                <!-- Replying indicator -->
                <div class="replying-indicator" style="display: none;">
                    <span><i class="fa-solid fa-reply"></i> Đang trả lời <strong class="reply-target-name">@user</strong></span>
                    <button class="cancel-reply-btn"><i class="fa-solid fa-xmark"></i></button>
                </div>

                <div class="comment-input-bar">
                    <input type="text" placeholder="Viết bình luận thật của bạn...">
                    <button class="btn-primary send-comment-btn" style="padding: 7px 16px;"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>
        `;

        // Clickable Hashtags in Post
        card.querySelectorAll('.hashtag-link').forEach(hl => {
            hl.addEventListener('click', (e) => {
                e.preventDefault();
                filterByTag(hl.dataset.tag);
            });
        });

        // Click to open image in Lightbox
        if (post.media_type === 'image') {
            const imgEl = card.querySelector('.post-media-img');
            if (imgEl) {
                imgEl.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openImageLightbox(post.media_url, post.content, post.display_name, post.username);
                });
            }
        }

        // Like Button
        const likeBtn = card.querySelector('.like-btn');
        likeBtn.addEventListener('click', async () => {
            if (!currentUser) return openAuth('login');
            try {
                const res = await apiFetch(`/api/posts/${post.id}/like`, { method: 'POST' });
                const d = await res.json();
                likeBtn.classList.toggle('liked', d.liked);
                likeBtn.querySelector('i').className = d.liked ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
                likeBtn.querySelector('.like-count').textContent = d.likes_count;
            } catch (err) {
                console.error(err);
            }
        });

        // Delete Button
        if (canDelete) {
            const delBtn = card.querySelector('.delete-post-btn');
            delBtn.addEventListener('click', async () => {
                if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;
                try {
                    const res = await apiFetch(`/api/posts/${post.id}`, { method: 'DELETE' });
                    if (res.ok) {
                        card.remove();
                        loadTrending();
                        showToast('Đã xóa bài viết thành công!');
                    } else {
                        const err = await res.json().catch(() => ({}));
                        const msg = err.error || err.detail || (res.status === 401 ? 'Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại' : 'Lỗi khi xóa bài');
                        alert(msg);
                    }
                } catch (e) {
                    alert('Lỗi kết nối khi xóa bài');
                }
            });
        }

        // Comments System & Reply
        const commentBtn = card.querySelector('.comment-btn');
        const commentsAccordion = card.querySelector('.comments-accordion');
        const collapseCommentsBtn = card.querySelector('.collapse-comments-btn');
        const commentsList = card.querySelector('.comments-list');
        const commentInput = card.querySelector('.comment-input-bar input');
        const sendCommentBtn = card.querySelector('.send-comment-btn');
        const replyingIndicator = card.querySelector('.replying-indicator');
        const replyTargetName = card.querySelector('.reply-target-name');
        const cancelReplyBtn = card.querySelector('.cancel-reply-btn');

        let activeParentId = null;

        commentBtn.addEventListener('click', () => {
            commentsAccordion.classList.toggle('active');
            if (commentsAccordion.classList.contains('active')) {
                loadPostComments(post.id, commentsList, (c) => startReply(c));
            }
        });

        collapseCommentsBtn.addEventListener('click', () => {
            commentsAccordion.classList.remove('active');
        });

        function startReply(comment) {
            if (!currentUser) return openAuth('login');
            activeParentId = comment.id;
            replyTargetName.textContent = `@${comment.username}`;
            replyingIndicator.style.display = 'flex';
            commentInput.focus();
        }

        cancelReplyBtn.addEventListener('click', () => {
            activeParentId = null;
            replyingIndicator.style.display = 'none';
        });

        const submitComment = async () => {
            if (!currentUser) return openAuth('login');
            const text = commentInput.value.trim();
            if (!text) return;

            const fd = new FormData();
            fd.append('content', text);
            if (activeParentId) {
                fd.append('parent_id', activeParentId);
            }

            try {
                const res = await apiFetch(`/api/posts/${post.id}/comments`, { method: 'POST', body: fd });
                const d = await res.json();
                if (res.ok && d.comment) {
                    commentInput.value = '';
                    activeParentId = null;
                    replyingIndicator.style.display = 'none';
                    appendSingleComment(d.comment, commentsList, (c) => startReply(c));
                    const cc = card.querySelector('.comment-count');
                    cc.textContent = parseInt(cc.textContent || 0) + 1;
                }
            } catch (e) {
                alert('Lỗi khi gửi bình luận');
            }
        };

        sendCommentBtn.addEventListener('click', submitComment);
        commentInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') submitComment();
        });

        const postUserBtn = card.querySelector('.post-user');
        if (postUserBtn) {
            postUserBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                viewUserProfile(post.user_id);
            });
        }

        return card;
    }

    async function loadPostComments(postId, container, onReply) {
        container.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Đang tải bình luận...</p>';
        try {
            const res = await apiFetch(`/api/posts/${postId}/comments`);
            const data = await res.json();
            container.innerHTML = '';
            if (!data.comments || data.comments.length === 0) {
                container.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Chưa có bình luận nào. Hãy là người đầu tiên!</p>';
                return;
            }
            data.comments.forEach(c => appendSingleComment(c, container, onReply));
        } catch (e) {
            container.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Lỗi tải bình luận</p>';
        }
    }

    function appendSingleComment(c, container, onReply) {
        const item = document.createElement('div');
        item.className = `comment-item ${c.parent_id ? 'is-reply' : ''}`;
        
        let replyHeader = '';
        if (c.parent_username) {
            replyHeader = `<span class="reply-badge">↳ Trả lời @${c.parent_username}</span>`;
        }

        item.innerHTML = `
            <img src="${c.avatar_url}" class="avatar-small clickable-user" style="width:30px;height:30px;cursor:pointer;" title="Xem trang cá nhân của ${c.display_name}">
            <div class="comment-body">
                <div class="comment-author-row">
                    <span class="comment-author clickable-user" title="Xem trang cá nhân" style="cursor:pointer; display:inline-flex; align-items:center;"><strong>${escapeHtml(c.display_name)}</strong>${getVerifiedBadge(c.is_verified, 14)} <span style="font-weight:400;color:var(--text-muted);font-size:11px; margin-left:4px;">@${c.username}</span></span>
                    <span style="font-size:11px;color:var(--text-muted);">${formatTime(c.created_at)}</span>
                </div>
                <p class="comment-text">${replyHeader}${escapeHtml(c.content)}</p>
                <div class="comment-actions">
                    <button class="reply-trigger-btn"><i class="fa-solid fa-reply"></i> Trả lời</button>
                </div>
            </div>
        `;

        item.querySelectorAll('.clickable-user').forEach(el => {
            el.addEventListener('click', (e) => {
                e.stopPropagation();
                viewUserProfile(c.user_id);
            });
        });

        item.querySelector('.reply-trigger-btn').addEventListener('click', () => {
            onReply(c);
        });

        container.appendChild(item);
    }

    // --- 8. PROFILE VIEW LOGIC & SETTINGS ---
    let currentProfileTab = 'all';

    // Toast Helper
    let toastTimeout = null;
    function showToast(text, isSuccess = true) {
        if (!appToast) return;
        toastText.textContent = text;
        if (isSuccess) {
            toastIcon.className = 'fa-solid fa-circle-check';
            toastIcon.style.color = 'var(--success)';
        } else {
            toastIcon.className = 'fa-solid fa-triangle-exclamation';
            toastIcon.style.color = 'var(--danger)';
        }
        appToast.style.display = 'block';
        clearTimeout(toastTimeout);
        toastTimeout = setTimeout(() => {
            appToast.style.display = 'none';
        }, 3000);
    }

    // Unified Logout Handler
    async function handleLogout() {
        try {
            await apiFetch('/api/auth/logout', { method: 'POST' });
        } catch (e) {}
        localStorage.removeItem('lumina_token');
        token = null;
        currentUser = null;
        updateAuthUI();
        if (settingsModal) settingsModal.style.display = 'none';
        if (editProfileModal) editProfileModal.style.display = 'none';
        switchView('feed');
        showToast('Đã đăng xuất tài khoản thành công!');
    }

    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);
    if (profileLogoutBtn) profileLogoutBtn.addEventListener('click', handleLogout);
    if (confirmLogoutBtn) confirmLogoutBtn.addEventListener('click', handleLogout);

    // Profile Post Tabs
    let activeProfileUserId = null;

    profileTabItems.forEach(tab => {
        tab.addEventListener('click', () => {
            profileTabItems.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentProfileTab = tab.getAttribute('data-ptab') || 'all';
            loadProfilePosts(currentProfileTab);
        });
    });

    async function loadProfilePosts(tab = 'all') {
        const targetId = activeProfileUserId || (currentUser ? currentUser.id : null);
        if (!targetId) return;
        userPostsFeed.innerHTML = '<div class="spinner"></div>';

        let url = `/api/posts?limit=50`;
        if (tab === 'all') {
            url += `&user_id=${targetId}`;
        } else if (tab === 'media') {
            url += `&user_id=${targetId}&filter_type=media`;
        } else if (tab === 'liked') {
            url += `&filter_type=liked`;
        }

        try {
            const res = await apiFetch(url);
            const data = await res.json();
            userPostsFeed.innerHTML = '';
            const posts = data.posts || [];
            if (posts.length === 0) {
                let emptyMsg = 'Chưa có bài viết nào.';
                if (tab === 'media') emptyMsg = 'Chưa có ảnh hoặc video nào được đăng.';
                if (tab === 'liked') emptyMsg = 'Chưa có bài viết đã thích.';
                userPostsFeed.innerHTML = `
                    <div style="text-align:center;color:var(--text-muted);padding:40px 20px;font-size:14px;">
                        <i class="fa-regular fa-folder-open" style="font-size:32px;display:block;margin-bottom:10px;opacity:0.6;"></i>
                        <p>${emptyMsg}</p>
                    </div>
                `;
            } else {
                posts.forEach(p => {
                    const card = createPostCard(p);
                    userPostsFeed.appendChild(card);
                });
            }
        } catch (e) {
            userPostsFeed.innerHTML = '<p style="text-align:center;color:var(--danger);padding:20px;">Lỗi tải bài viết.</p>';
        }
    }

    async function viewUserProfile(userId) {
        if (!userId) return;
        activeProfileUserId = userId;

        // Switch view section to profileView
        viewSections.forEach(sec => sec.style.display = 'none');
        document.getElementById('profileView').style.display = 'block';
        window.scrollTo({ top: 0, behavior: 'smooth' });

        // Update Nav Menu active state
        navItems.forEach(n => {
            if (n.getAttribute('data-view') === 'profile' && currentUser && currentUser.id === userId) {
                n.classList.add('active');
            } else {
                n.classList.remove('active');
            }
        });

        const isSelf = currentUser && currentUser.id === userId;
        const profileBackNav = document.getElementById('profileBackNav');
        const avatarCameraBtn = document.getElementById('avatarCameraBtn');
        const selfProfileActions = document.getElementById('selfProfileActions');
        const profileFollowBtn = document.getElementById('profileFollowBtn');

        if (isSelf) {
            if (profileBackNav) profileBackNav.style.display = 'none';
            if (avatarCameraBtn) avatarCameraBtn.style.display = 'flex';
            if (selfProfileActions) selfProfileActions.style.display = 'inline-flex';
            if (profileFollowBtn) profileFollowBtn.style.display = 'none';
            renderProfileData(currentUser, true);
        } else {
            if (profileBackNav) profileBackNav.style.display = 'block';
            if (avatarCameraBtn) avatarCameraBtn.style.display = 'none';
            if (selfProfileActions) selfProfileActions.style.display = 'none';
            if (profileFollowBtn) profileFollowBtn.style.display = 'inline-flex';

            try {
                const res = await apiFetch(`/api/users/${userId}`);
                const data = await res.json();
                if (res.ok && data.user) {
                    renderProfileData(data.user, false);
                } else {
                    showToast(data.error || 'Không tìm thấy người dùng', false);
                    switchView('feed');
                    return;
                }
            } catch (e) {
                showToast('Lỗi tải thông tin người dùng', false);
                switchView('feed');
                return;
            }
        }

        loadProfilePosts(currentProfileTab);
    }

    function renderProfileData(user, isSelf) {
        profileDisplayName.innerHTML = `${escapeHtml(user.display_name)}${getVerifiedBadge(user.is_verified, 22)}`;
        profileUsername.textContent = '@' + user.username;
        profileAvatar.src = user.avatar_url;
        profileAvatar.style.cursor = 'zoom-in';
        profileAvatar.title = 'Nhấp để xem ảnh đại diện';
        profileAvatar.onclick = () => {
            if (user.avatar_url) {
                openImageLightbox(user.avatar_url, `Ảnh đại diện của ${user.display_name}`, user.display_name, user.username);
            }
        };
        profileBio.textContent = user.bio || (isSelf ? 'Chưa có tiểu sử giới thiệu. Nhấn Chỉnh sửa để thêm!' : 'Người dùng này chưa cập nhật tiểu sử.');
        if (user.role === 'admin') {
            profileRole.textContent = 'Quản trị viên';
            profileRole.className = 'role-badge admin';
            profileRole.style.display = 'inline-block';
        } else {
            profileRole.style.display = 'none';
        }

        if (profileJoinDate) {
            if (user.created_at) {
                const date = new Date(user.created_at.replace(' ', 'T') + 'Z');
                const month = date.getMonth() + 1;
                const year = date.getFullYear();
                profileJoinDate.innerHTML = `<i class="fa-regular fa-calendar-days"></i> Thành viên từ tháng ${month}/${year}`;
            } else {
                profileJoinDate.innerHTML = `<i class="fa-regular fa-calendar-days"></i> Thành viên Lumina`;
            }
        }

        profilePostsCount.textContent = user.posts_count || 0;
        profileFollowersCount.textContent = user.followers_count || 0;
        profileFollowingCount.textContent = user.following_count || 0;

        if (!isSelf) {
            updateFollowButtonState(user.is_following);
        }
    }

    function updateFollowButtonState(isFollowing) {
        const profileFollowBtn = document.getElementById('profileFollowBtn');
        const profileFollowIcon = document.getElementById('profileFollowIcon');
        const profileFollowText = document.getElementById('profileFollowText');
        if (!profileFollowBtn) return;

        if (isFollowing) {
            profileFollowBtn.className = 'btn-secondary profile-btn is-following';
            if (profileFollowIcon) profileFollowIcon.className = 'fa-solid fa-check';
            if (profileFollowText) profileFollowText.textContent = 'Bạn bè / Đang theo dõi';
        } else {
            profileFollowBtn.className = 'btn-primary profile-btn';
            if (profileFollowIcon) profileFollowIcon.className = 'fa-solid fa-user-plus';
            if (profileFollowText) profileFollowText.textContent = 'Kết bạn / Theo dõi';
        }
    }

    // Follow Toggle Handler
    const profileFollowBtn = document.getElementById('profileFollowBtn');
    if (profileFollowBtn) {
        profileFollowBtn.addEventListener('click', async () => {
            if (!currentUser) {
                openAuth('login');
                return;
            }
            if (!activeProfileUserId || activeProfileUserId === currentUser.id) return;

            try {
                const res = await apiFetch(`/api/users/${activeProfileUserId}/follow`, { method: 'POST' });
                const data = await res.json();
                if (res.ok) {
                    const isFollowing = data.is_following;
                    updateFollowButtonState(isFollowing);
                    profileFollowersCount.textContent = data.followers_count;
                    if (isFollowing) {
                        showToast('Đã kết bạn & theo dõi người dùng thành công!');
                    } else {
                        showToast('Đã hủy theo dõi');
                    }
                    loadSuggestions();
                } else {
                    showToast(data.error || 'Lỗi thao tác', false);
                }
            } catch (e) {
                showToast('Không thể kết nối đến máy chủ', false);
            }
        });
    }

    // Back from profile button
    const backFromProfileBtn = document.getElementById('backFromProfileBtn');
    if (backFromProfileBtn) {
        backFromProfileBtn.addEventListener('click', () => {
            switchView('feed');
        });
    }

    // Suggestions List Loader
    async function loadSuggestions() {
        const suggestionsList = document.getElementById('suggestionsList');
        if (!suggestionsList) return;

        try {
            const res = await apiFetch('/api/users/suggestions');
            const data = await res.json();
            suggestionsList.innerHTML = '';
            const users = data.users || [];
            if (users.length === 0) {
                suggestionsList.innerHTML = '<p style="color:var(--text-muted);font-size:12px;padding:6px 0;">Chưa có gợi ý mới.</p>';
                return;
            }

            users.forEach(u => {
                const item = document.createElement('div');
                item.className = 'suggestion-item';
                item.innerHTML = `
                    <div class="suggestion-user-info" title="Xem hồ sơ của ${u.display_name}">
                        <img src="${u.avatar_url}" class="avatar-small" style="width:34px;height:34px;border-radius:50%;object-fit:cover;" alt="${u.username}">
                        <div style="min-width:0;">
                            <div class="suggestion-name" style="display:inline-flex; align-items:center;">${escapeHtml(u.display_name)}${getVerifiedBadge(u.is_verified, 14)}</div>
                            <div class="suggestion-handle">@${u.username}</div>
                        </div>
                    </div>
                    <button class="btn-follow-mini ${u.is_following ? 'is-following' : ''}" data-uid="${u.id}">
                        <i class="fa-solid ${u.is_following ? 'fa-check' : 'fa-plus'}"></i>
                        <span>${u.is_following ? 'Bạn bè' : 'Kết bạn'}</span>
                    </button>
                `;

                item.querySelector('.suggestion-user-info').addEventListener('click', () => {
                    viewUserProfile(u.id);
                });

                const followBtn = item.querySelector('.btn-follow-mini');
                followBtn.addEventListener('click', async (e) => {
                    e.stopPropagation();
                    if (!currentUser) return openAuth('login');
                    try {
                        const res = await apiFetch(`/api/users/${u.id}/follow`, { method: 'POST' });
                        const d = await res.json();
                        if (res.ok) {
                            u.is_following = d.is_following;
                            followBtn.className = `btn-follow-mini ${u.is_following ? 'is-following' : ''}`;
                            followBtn.querySelector('i').className = `fa-solid ${u.is_following ? 'fa-check' : 'fa-plus'}`;
                            followBtn.querySelector('span').textContent = u.is_following ? 'Bạn bè' : 'Kết bạn';
                            showToast(u.is_following ? `Đã kết bạn với ${u.display_name}` : `Đã hủy theo dõi ${u.display_name}`);
                            if (activeProfileUserId === u.id) {
                                updateFollowButtonState(u.is_following);
                                profileFollowersCount.textContent = d.followers_count;
                            }
                        }
                    } catch (err) {
                        showToast('Lỗi thao tác kết bạn', false);
                    }
                });

                suggestionsList.appendChild(item);
            });
        } catch (e) {
            suggestionsList.innerHTML = '<p style="color:var(--text-muted);font-size:12px;">Lỗi tải gợi ý.</p>';
        }
    }

    // Direct Avatar Upload
    async function uploadAvatarFile(file) {
        if (!file) return;
        if (avatarLoadingOverlay) avatarLoadingOverlay.style.display = 'flex';
        const fd = new FormData();
        fd.append('avatar', file);

        try {
            const res = await apiFetch('/api/auth/avatar', {
                method: 'POST',
                body: fd
            });
            const data = await res.json();
            if (res.ok && data.user) {
                currentUser = data.user;
                updateAuthUI();
                if (profileAvatar) profileAvatar.src = currentUser.avatar_url;
                if (settingsAvatarPreview) settingsAvatarPreview.src = currentUser.avatar_url;
                showToast('Đã cập nhật ảnh đại diện thành công!');
            } else {
                showToast(data.error || 'Lỗi cập nhật ảnh đại diện', false);
            }
        } catch (e) {
            showToast('Không thể kết nối đến máy chủ', false);
        } finally {
            if (avatarLoadingOverlay) avatarLoadingOverlay.style.display = 'none';
        }
    }

    if (avatarFileInput) {
        avatarFileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) uploadAvatarFile(e.target.files[0]);
        });
    }
    if (settingsAvatarFile) {
        settingsAvatarFile.addEventListener('change', (e) => {
            if (e.target.files.length > 0) uploadAvatarFile(e.target.files[0]);
        });
    }

    // Function loadProfile wrapper for backwards compatibility
    function loadProfile() {
        if (currentUser) {
            viewUserProfile(currentUser.id);
        }
    }

    // Edit Profile Modal
    if (openEditProfileBtn) {
        openEditProfileBtn.addEventListener('click', () => {
            editDisplayName.value = currentUser.display_name;
            editBio.value = currentUser.bio || '';
            editProfileModal.style.display = 'flex';
        });
    }
    if (closeEditProfileModal) {
        closeEditProfileModal.addEventListener('click', () => editProfileModal.style.display = 'none');
    }

    if (editProfileForm) {
        editProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = editProfileForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            const fd = new FormData();
            fd.append('display_name', editDisplayName.value.trim());
            fd.append('bio', editBio.value.trim());

            try {
                const res = await apiFetch('/api/auth/update-profile', { method: 'POST', body: fd });
                const d = await res.json();
                if (res.ok && d.user) {
                    currentUser = d.user;
                    updateAuthUI();
                    loadProfile();
                    editProfileModal.style.display = 'none';
                    showToast('Đã lưu thông tin hồ sơ thành công!');
                } else {
                    showToast(d.error || 'Lỗi cập nhật hồ sơ', false);
                }
            } catch (err) {
                console.error('Update profile err:', err);
                showToast('Lỗi cập nhật hồ sơ', false);
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    // Settings Modal
    function openSettingsModal(targetTab = 'tabProfile') {
        if (!currentUser) return openAuth('login');
        settingsDisplayName.value = currentUser.display_name;
        settingsBio.value = currentUser.bio || '';
        settingsAvatarPreview.src = currentUser.avatar_url;
        if (settingsProfileMsg) settingsProfileMsg.style.display = 'none';
        if (changePasswordMsg) changePasswordMsg.style.display = 'none';
        if (oldPasswordInput) oldPasswordInput.value = '';
        if (newPasswordInput) newPasswordInput.value = '';
        if (confirmNewPasswordInput) confirmNewPasswordInput.value = '';
        
        settingsTabBtns.forEach(b => b.classList.remove('active'));
        settingsTabContents.forEach(c => c.style.display = 'none');
        
        const targetBtn = document.querySelector(`.settings-tab-btn[data-stab="${targetTab}"]`);
        if (targetBtn) targetBtn.classList.add('active');
        const targetContent = document.getElementById(targetTab);
        if (targetContent) targetContent.style.display = 'block';

        if (targetTab === 'tabVerification') {
            loadVerificationStatus();
        }

        settingsModal.style.display = 'flex';
    }

    if (openSettingsBtn) {
        openSettingsBtn.addEventListener('click', () => {
            openSettingsModal('tabProfile');
        });
    }

    const openVerificationProfileBtn = document.getElementById('openVerificationProfileBtn');
    if (openVerificationProfileBtn) {
        openVerificationProfileBtn.addEventListener('click', () => {
            openSettingsModal('tabVerification');
        });
    }

    const sidebarSettingsBtn = document.getElementById('sidebarSettingsBtn');
    if (sidebarSettingsBtn) {
        sidebarSettingsBtn.addEventListener('click', () => {
            openSettingsModal('tabVerification');
        });
    }

    if (closeSettingsModal) {
        closeSettingsModal.addEventListener('click', () => {
            settingsModal.style.display = 'none';
        });
    }

    settingsTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            settingsTabBtns.forEach(b => b.classList.remove('active'));
            settingsTabContents.forEach(c => c.style.display = 'none');
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-stab');
            const contentEl = document.getElementById(targetId);
            if (contentEl) contentEl.style.display = 'block';

            if (targetId === 'tabVerification') {
                loadVerificationStatus();
            }
        });
    });

    async function loadVerificationStatus() {
        const statusBox = document.getElementById('verificationStatusBox');
        const requestBox = document.getElementById('verificationRequestBox');
        if (!statusBox) return;

        statusBox.innerHTML = `
            <div style="text-align: center; padding: 20px;">
                <i class="fa-solid fa-spinner fa-spin" style="font-size: 24px; color: var(--primary);"></i>
                <p style="margin-top: 8px; font-size: 13px; color: var(--text-secondary);">Đang kiểm tra trạng thái xác minh...</p>
            </div>
        `;

        try {
            const res = await apiFetch('/api/verification/status');
            const data = await res.json();
            
            if (data.is_verified) {
                statusBox.innerHTML = `
                    <div class="verification-card verified">
                        <div class="verification-card-icon"><i class="fa-solid fa-circle-check"></i></div>
                        <h4 style="font-size: 17px; font-weight: 800; color: #38bdf8; margin-bottom: 6px;">Đã Được Cấp Tích Xanh Chính Chủ</h4>
                        <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
                            Tài khoản của bạn đã được Quản trị viên (Admin) xét duyệt và bật huy hiệu chính chủ. Dấu tích xanh <i class="fa-solid fa-circle-check" style="color: #38bdf8;"></i> sẽ hiển thị bên cạnh tên bạn trên toàn bộ bài viết, bình luận và trang cá nhân.
                        </p>
                    </div>
                `;
                if (requestBox) requestBox.style.display = 'none';
            } else if (data.latest_request && data.latest_request.status === 'pending') {
                const reqDate = new Date(data.latest_request.created_at).toLocaleString('vi-VN');
                statusBox.innerHTML = `
                    <div class="verification-card pending">
                        <div class="verification-card-icon"><i class="fa-solid fa-hourglass-half"></i></div>
                        <h4 style="font-size: 17px; font-weight: 800; color: #eab308; margin-bottom: 6px;">Yêu Cầu Đang Chờ Admin Phê Duyệt</h4>
                        <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5; margin-bottom: 12px;">
                            Yêu cầu xin cấp tích xanh của bạn đã được chuyển tới Ban Quản Trị hệ thống vào lúc <strong>${reqDate}</strong>. Quản trị viên sẽ kiểm tra hồ sơ và bật tích xanh cho bạn sớm nhất có thể.
                        </p>
                        <div style="background: rgba(0,0,0,0.3); border-radius: 8px; padding: 12px; font-size: 12.5px; text-align: left;">
                            <span style="color: var(--text-muted); font-size: 11px;">Lý do bạn đã gửi:</span>
                            <p style="color: var(--text-primary); margin-top: 4px; font-style: italic;">"${escapeHtml(data.latest_request.reason || 'Không ghi lý do')}"</p>
                        </div>
                    </div>
                `;
                if (requestBox) requestBox.style.display = 'none';
            } else {
                let noteHtml = '';
                if (data.latest_request && data.latest_request.status === 'rejected') {
                    noteHtml = `
                        <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px; margin-top: 12px; font-size: 12px; color: #fca5a5; text-align: left;">
                            <i class="fa-solid fa-triangle-exclamation"></i> <strong>Lưu ý:</strong> Yêu cầu trước đó bị từ chối (${escapeHtml(data.latest_request.admin_note || 'Chưa đủ điều kiện')}). Bạn có thể bổ sung thông tin chi tiết hơn và gửi lại bên dưới.
                        </div>
                    `;
                }

                statusBox.innerHTML = `
                    <div class="verification-card unverified">
                        <div class="verification-card-icon"><i class="fa-solid fa-circle-check"></i></div>
                        <h4 style="font-size: 16px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Chưa Kích Hoạt Tích Xanh</h4>
                        <p style="font-size: 12.5px; color: var(--text-secondary); line-height: 1.5;">
                            Tài khoản của bạn hiện chưa có huy hiệu xác minh chính chủ. Hãy gửi yêu cầu hỗ trợ bên dưới để Admin xem xét cấp cho bạn.
                        </p>
                        ${noteHtml}
                    </div>
                `;
                if (requestBox) {
                    requestBox.style.display = 'block';
                    const reasonInput = document.getElementById('verificationReasonText');
                    if (reasonInput) reasonInput.value = '';
                    const actionMsg = document.getElementById('verificationActionMsg');
                    if (actionMsg) actionMsg.style.display = 'none';
                }
            }
        } catch (err) {
            console.error('Lỗi kiểm tra trạng thái tích xanh:', err);
            statusBox.innerHTML = `
                <div class="verification-card unverified">
                    <p style="color: var(--danger); font-size: 13px;">Không thể kiểm tra trạng thái xác minh lúc này.</p>
                </div>
            `;
        }
    }

    const verificationRequestForm = document.getElementById('verificationRequestForm');
    if (verificationRequestForm) {
        verificationRequestForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const reasonInput = document.getElementById('verificationReasonText');
            const submitBtn = document.getElementById('submitVerificationBtn');
            const msgEl = document.getElementById('verificationActionMsg');

            if (!reasonInput || !reasonInput.value.trim()) {
                if (msgEl) {
                    msgEl.className = 'form-feedback-msg error';
                    msgEl.textContent = 'Vui lòng nhập lý do xin cấp tích xanh';
                    msgEl.style.display = 'block';
                }
                return;
            }

            if (submitBtn) submitBtn.disabled = true;
            const fd = new FormData();
            fd.append('reason', reasonInput.value.trim());

            try {
                const res = await apiFetch('/api/verification/request', { method: 'POST', body: fd });
                const d = await res.json();
                if (res.ok) {
                    showToast('Đã gửi yêu cầu xin cấp tích xanh tới Admin thành công!');
                    loadVerificationStatus();
                } else {
                    if (msgEl) {
                        msgEl.className = 'form-feedback-msg error';
                        msgEl.textContent = d.error || 'Lỗi gửi yêu cầu';
                        msgEl.style.display = 'block';
                    }
                }
            } catch (err) {
                console.error('Submit verification err:', err);
                if (msgEl) {
                    msgEl.className = 'form-feedback-msg error';
                    msgEl.textContent = 'Lỗi kết nối tới máy chủ';
                    msgEl.style.display = 'block';
                }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    if (settingsProfileForm) {
        settingsProfileForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const submitBtn = settingsProfileForm.querySelector('button[type="submit"]');
            if (submitBtn) submitBtn.disabled = true;

            const fd = new FormData();
            fd.append('display_name', settingsDisplayName.value.trim());
            fd.append('bio', settingsBio.value.trim());

            try {
                const res = await apiFetch('/api/auth/update-profile', { method: 'POST', body: fd });
                const d = await res.json();
                if (res.ok && d.user) {
                    currentUser = d.user;
                    updateAuthUI();
                    loadProfile();
                    if (settingsProfileMsg) {
                        settingsProfileMsg.className = 'form-feedback-msg success';
                        settingsProfileMsg.textContent = 'Đã lưu thay đổi hồ sơ thành công!';
                        settingsProfileMsg.style.display = 'block';
                    }
                    showToast('Đã lưu hồ sơ thành công!');
                    setTimeout(() => {
                        settingsModal.style.display = 'none';
                    }, 1000);
                } else {
                    if (settingsProfileMsg) {
                        settingsProfileMsg.className = 'form-feedback-msg error';
                        settingsProfileMsg.textContent = d.error || 'Lỗi lưu thông tin';
                        settingsProfileMsg.style.display = 'block';
                    }
                }
            } catch (err) {
                console.error('Settings profile err:', err);
                if (settingsProfileMsg) {
                    settingsProfileMsg.className = 'form-feedback-msg error';
                    settingsProfileMsg.textContent = 'Lỗi lưu thông tin';
                    settingsProfileMsg.style.display = 'block';
                }
            } finally {
                if (submitBtn) submitBtn.disabled = false;
            }
        });
    }

    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const oldPass = oldPasswordInput.value;
            const newPass = newPasswordInput.value;
            const confirmPass = confirmNewPasswordInput.value;

            if (newPass !== confirmPass) {
                if (changePasswordMsg) {
                    changePasswordMsg.className = 'form-feedback-msg error';
                    changePasswordMsg.textContent = 'Mật khẩu mới nhập lại không khớp!';
                    changePasswordMsg.style.display = 'block';
                }
                return;
            }

            const fd = new FormData();
            fd.append('old_password', oldPass);
            fd.append('new_password', newPass);

            try {
                const res = await apiFetch('/api/auth/change-password', { method: 'POST', body: fd });
                const d = await res.json();
                if (res.ok) {
                    if (changePasswordMsg) {
                        changePasswordMsg.className = 'form-feedback-msg success';
                        changePasswordMsg.textContent = 'Đã đổi mật khẩu thành công!';
                        changePasswordMsg.style.display = 'block';
                    }
                    oldPasswordInput.value = '';
                    newPasswordInput.value = '';
                    confirmNewPasswordInput.value = '';
                    showToast('Đã đổi mật khẩu thành công!');
                    setTimeout(() => {
                        settingsModal.style.display = 'none';
                    }, 1400);
                } else {
                    if (changePasswordMsg) {
                        changePasswordMsg.className = 'form-feedback-msg error';
                        changePasswordMsg.textContent = d.error || 'Lỗi đổi mật khẩu';
                        changePasswordMsg.style.display = 'block';
                    }
                }
            } catch (err) {
                if (changePasswordMsg) {
                    changePasswordMsg.className = 'form-feedback-msg error';
                    changePasswordMsg.textContent = 'Không thể kết nối đến máy chủ';
                    changePasswordMsg.style.display = 'block';
                }
            }
        });
    }

    // --- IMAGE LIGHTBOX VIEWER ---
    function openImageLightbox(url, caption = '', author = '', handle = '') {
        if (!url || !imageLightboxModal) return;
        lightboxImg.src = url;
        if (lightboxOpenTabBtn) lightboxOpenTabBtn.href = url;
        
        if (lightboxDownloadBtn) {
            lightboxDownloadBtn.href = url;
            const filename = (url.split('/').pop() || 'lumina-photo.jpg').split('?')[0];
            lightboxDownloadBtn.setAttribute('download', filename);
        }

        if (lightboxTitle) {
            if (author) {
                lightboxTitle.textContent = `${author}${handle ? ' (@' + handle + ')' : ''}`;
            } else {
                lightboxTitle.textContent = 'Xem ảnh chi tiết';
            }
        }

        if (lightboxCaptionBar && lightboxCaptionText) {
            if (caption && caption.trim()) {
                lightboxCaptionText.textContent = caption.trim();
                lightboxCaptionBar.style.display = 'block';
            } else {
                lightboxCaptionBar.style.display = 'none';
            }
        }

        imageLightboxModal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }

    function closeImageLightboxModal() {
        if (!imageLightboxModal) return;
        imageLightboxModal.style.display = 'none';
        if (lightboxImg) lightboxImg.src = '';
        document.body.style.overflow = '';
    }

    if (closeImageLightbox) {
        closeImageLightbox.addEventListener('click', closeImageLightboxModal);
    }
    if (imageLightboxModal) {
        imageLightboxModal.addEventListener('click', (e) => {
            if (e.target === imageLightboxModal || e.target === lightboxBody || (e.target && e.target.id === 'lightboxContainer')) {
                closeImageLightboxModal();
            }
        });
    }
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && imageLightboxModal && imageLightboxModal.style.display === 'flex') {
            closeImageLightboxModal();
        }
    });

    // Global click listener for any post media image
    document.addEventListener('click', (e) => {
        const imgTarget = e.target.closest('.post-media-img');
        if (imgTarget && imgTarget.tagName === 'IMG') {
            const src = imgTarget.src || imgTarget.getAttribute('src');
            if (src && (!imageLightboxModal || imageLightboxModal.style.display !== 'flex')) {
                const card = imgTarget.closest('.post-card');
                let caption = '';
                let author = '';
                let handle = '';
                if (card) {
                    const postContent = card.querySelector('.post-content');
                    if (postContent) caption = postContent.innerText;
                    const metaName = card.querySelector('.post-meta-name');
                    if (metaName) author = metaName.innerText;
                    const metaHandle = card.querySelector('.post-meta-handle');
                    if (metaHandle) handle = metaHandle.innerText.split('·')[0].replace('@', '').trim();
                }
                openImageLightbox(src, caption, author, handle);
            }
        }
    });

    // --- UTILITIES ---
    function formatPostContent(rawText) {
        if (!rawText) return '';
        const escaped = escapeHtml(rawText);
        // Thay thế các #hashtag thành liên kết có thể nhấp được
        return escaped.replace(/#([A-Za-z0-9_À-ỹ]+)/g, '<a href="#" class="hashtag-link" data-tag="$1">#$1</a>');
    }

    function formatTime(timestamp) {
        if (!timestamp) return 'vừa xong';
        const date = new Date(timestamp.replace(' ', 'T') + 'Z');
        const now = new Date();
        const diffMs = now - date;
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffDay > 7) return date.toLocaleDateString('vi-VN');
        if (diffDay > 0) return `${diffDay} ngày trước`;
        if (diffHour > 0) return `${diffHour} giờ trước`;
        if (diffMin > 0) return `${diffMin} phút trước`;
        return 'vừa xong';
    }

    function formatNumber(num) {
        num = parseInt(num) || 0;
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // Launch App
    initApp();
});
