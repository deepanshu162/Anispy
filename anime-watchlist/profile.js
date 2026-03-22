document.addEventListener('DOMContentLoaded', () => {
    // Supabase Initialization
    const SUPABASE_URL = 'https://klxbsnywxpchrqavxjcd.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGJzbnl3eHBjaHJxYXZ4amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNzE4NDEsImV4cCI6MjA4OTY0Nzg0MX0.wxmFEKE0FMiUrZluQWnNoxWMAwHTwFDK7kJ83Rtu3mg';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    let currentUser = null;
    let watchlist = [];

    // DOM Elements
    const profileName = document.getElementById('profileName');
    const profileImage = document.getElementById('profileImage');
    const loadingProfile = document.getElementById('loadingProfile');
    const profileContent = document.getElementById('profileContent');
    const statEpisodes = document.getElementById('statEpisodes');
    const statHours = document.getElementById('statHours');
    const statScore = document.getElementById('statScore');
    const statLevel = document.getElementById('statLevel');
    const genreContainer = document.getElementById('genreContainer');
    const tagsContainer = document.getElementById('tagsContainer');
    const logoutBtn = document.getElementById('logoutBtn');
    
    // Edit Profile Elements
    const profileDisplayContainer = document.getElementById('profileDisplayContainer');
    const topGearBtn = document.getElementById('topGearBtn');
    const gearDropdown = document.getElementById('gearDropdown');
    const dropdownEditProfileBtn = document.getElementById('dropdownEditProfileBtn');
    const dropdownLogoutBtn = document.getElementById('dropdownLogoutBtn');
    const editProfileContainer = document.getElementById('editProfileContainer');
    const editNameInput = document.getElementById('editNameInput');
    const editEmailInput = document.getElementById('editEmailInput');
    const editAvatarInput = document.getElementById('editAvatarInput');
    const editPasswordInput = document.getElementById('editPasswordInput');
    const togglePasswordBtn = document.getElementById('togglePasswordBtn');
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    const cancelProfileBtn = document.getElementById('cancelProfileBtn');
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    const profileTitle = document.getElementById('profileTitle');
    const profileEmailDisplay = document.getElementById('profileEmailDisplay');

    // Chart elements
    const totalAnimeCount = document.getElementById('totalAnimeCount');
    const barCompleted = document.getElementById('barCompleted');
    const barPlan = document.getElementById('barPlan');
    const barDropped = document.getElementById('barDropped');
    const statCompletedCount = document.getElementById('statCompletedCount');
    const statPlanCount = document.getElementById('statPlanCount');
    const statDroppedCount = document.getElementById('statDroppedCount');

    // Color palette mapping to native style vars (Red, Teal, Yellow, Gray)
    const genreColors = ['var(--accent-red)', 'var(--accent-teal)', '#fcd34d', '#a0a0a0', '#38bdf8'];

    // Auth flow
    async function initProfile() {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            window.location.href = 'login.html';
            return;
        }
        
        currentUser = session.user;
        const email = currentUser.email;
        const username = currentUser.user_metadata?.username || email.split('@')[0];
        const avatarUrl = currentUser.user_metadata?.avatar_url || '';
        
        profileName.textContent = username;
        profileEmailDisplay.textContent = email;
        // Using native theme darker colors for the avatar generator
        profileImage.src = avatarUrl ? avatarUrl : `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=1e1e1e&color=ffffff&size=300`;

        await fetchWatchlist();
        calculateAndRenderStats();

        loadingProfile.classList.add('hidden');
        profileContent.classList.remove('hidden');
    }

    async function fetchWatchlist() {
        const { data, error } = await supabase
            .from('watchlist')
            .select('*')
            .eq('user_id', currentUser.id);

        if (error) {
            console.error('Error fetching watchlist:', error);
            return;
        }
        
        watchlist = data || [];
    }

    function parseDurationStr(durationStr) {
        if (!durationStr || durationStr === 'Unknown') return 0;
        let totalMinutes = 0;
        const hrMatch = durationStr.match(/(\d+)\s*hr/i);
        const minMatch = durationStr.match(/(\d+)\s*min/i);
        if (hrMatch) totalMinutes += parseInt(hrMatch[1], 10) * 60;
        if (minMatch) totalMinutes += parseInt(minMatch[1], 10);
        return totalMinutes;
    }

    function calculateAndRenderStats() {
        if (watchlist.length === 0) return;

        let totalMinutesWatched = 0;
        let totalEpisodesWatched = 0;
        let totalScoreGiven = 0;
        let ratedCount = 0;
        let genreCounts = {};
        let statusCounts = { completed: 0, plan_to_watch: 0, dropped: 0 };
        let allThemes = new Set();
        let allDemographics = new Set();

        watchlist.forEach(item => {
            const durationMins = parseDurationStr(item.duration);
            let epsWatched = item.episodes_watched || 0;
            totalMinutesWatched += (epsWatched * durationMins);
            totalEpisodesWatched += epsWatched;

            if (item.user_rating && !isNaN(item.user_rating)) {
                totalScoreGiven += parseInt(item.user_rating, 10);
                ratedCount++;
            }

            if (statusCounts[item.status] !== undefined) {
                statusCounts[item.status]++;
            } else {
                statusCounts.plan_to_watch++;
            }

            if (item.genres && Array.isArray(item.genres)) {
                item.genres.forEach(g => {
                    if (g.type === "Demographics" || item.type === "Demographic") {
                        allDemographics.add(g.name);
                    } else if (g.type === "Themes" || item.type === "Theme") {
                        allThemes.add(g.name);
                    } else {
                        genreCounts[g.name] = (genreCounts[g.name] || 0) + 1;
                    }
                });
            }
        });

        const totalHours = totalMinutesWatched / 60;
        const otakuLevel = Math.floor(totalHours / 12) + 1; // 1 level per 12 hours watched
        
        let dynamicTitle = "NOVICE WEEB";
        if (otakuLevel >= 6 && otakuLevel <= 15) dynamicTitle = "ANIME ENTHUSIAST";
        else if (otakuLevel >= 16 && otakuLevel <= 30) dynamicTitle = "SEASONED WATCHER";
        else if (otakuLevel >= 31 && otakuLevel <= 50) dynamicTitle = "VETERAN ARCHIVIST";
        else if (otakuLevel > 50) dynamicTitle = "ARCHIVIST EXTRAORDINAIRE";
        
        profileTitle.textContent = dynamicTitle;

        statEpisodes.textContent = totalEpisodesWatched;
        statHours.textContent = totalHours.toFixed(1);
        statLevel.textContent = otakuLevel;

        const avgScore = ratedCount > 0 ? (totalScoreGiven / ratedCount).toFixed(1) : parseFloat('0').toFixed(1);
        statScore.textContent = avgScore;

        totalAnimeCount.textContent = `${watchlist.length} Total Anime`;
        
        statCompletedCount.textContent = statusCounts.completed;
        statPlanCount.textContent = statusCounts.plan_to_watch;
        statDroppedCount.textContent = statusCounts.dropped;

        const maxStatus = Math.max(...Object.values(statusCounts), 1);
        barCompleted.style.height = `${Math.max((statusCounts.completed / maxStatus) * 100, 5)}%`;
        barPlan.style.height = `${Math.max((statusCounts.plan_to_watch / maxStatus) * 100, 5)}%`;
        barDropped.style.height = `${Math.max((statusCounts.dropped / maxStatus) * 100, 5)}%`;

        const sortedGenres = Object.entries(genreCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4);
            
        if (sortedGenres.length > 0) {
            genreContainer.innerHTML = '';
            const totalGenresCounted = Object.values(genreCounts).reduce((a, b) => a + b, 0);
            
            sortedGenres.forEach((genreEntry, index) => {
                const genreName = genreEntry[0];
                const genreCount = genreEntry[1];
                const percent = Math.round((genreCount / totalGenresCounted) * 100);
                const color = genreColors[index % genreColors.length];
                
                genreContainer.innerHTML += `
                <div class="genre-item">
                    <div class="genre-item-flex">
                        <span class="genre-name">${genreName}</span>
                        <span class="genre-pct">${percent}%</span>
                    </div>
                    <div class="genre-track">
                        <div class="genre-fill" style="width: ${Math.max(percent, 2)}%; background: ${color};"></div>
                    </div>
                </div>
                `;
            });
        }

        const tags = Array.from(allThemes).slice(0, 5); 
        if (tags.length < 5) {
            tags.push(...Array.from(allDemographics).slice(0, 5 - tags.length));
        }
        
        if (tags.length > 0) {
            tagsContainer.innerHTML = tags.map(tag => 
                `<span class="tag-pill">${tag}</span>`
            ).join('');
        }
    }

    logoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });

    topGearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        gearDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!gearDropdown.classList.contains('hidden') && !gearDropdown.contains(e.target) && e.target !== topGearBtn) {
            gearDropdown.classList.add('hidden');
        }
    });

    dropdownLogoutBtn.addEventListener('click', async () => {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    });

    dropdownEditProfileBtn.addEventListener('click', () => {
        gearDropdown.classList.add('hidden');
        profileDisplayContainer.classList.add('hidden');
        editProfileContainer.classList.remove('hidden');
        editNameInput.value = profileName.textContent;
        editEmailInput.value = profileEmailDisplay.textContent;
        editAvatarInput.value = currentUser.user_metadata?.avatar_url || '';
        editPasswordInput.value = '';
        editPasswordInput.setAttribute('type', 'password');
        togglePasswordBtn.innerHTML = '<i class="fa-solid fa-eye"></i>';
        editNameInput.focus();
    });

    cancelProfileBtn.addEventListener('click', () => {
        profileDisplayContainer.classList.remove('hidden');
        editProfileContainer.classList.add('hidden');
    });

    togglePasswordBtn.addEventListener('click', () => {
        const isPassword = editPasswordInput.getAttribute('type') === 'password';
        editPasswordInput.setAttribute('type', isPassword ? 'text' : 'password');
        togglePasswordBtn.innerHTML = isPassword ? '<i class="fa-solid fa-eye-slash"></i>' : '<i class="fa-solid fa-eye"></i>';
    });

    saveProfileBtn.addEventListener('click', async () => {
        const newName = editNameInput.value.trim();
        const newEmail = editEmailInput.value.trim();
        const newAvatar = editAvatarInput.value.trim();
        const newPassword = editPasswordInput.value.trim();
        
        if (!newName || !newEmail || !currentUser) {
            cancelProfileBtn.click();
            return;
        }

        const oldAvatar = currentUser.user_metadata?.avatar_url || '';
        const nameChanged = newName !== profileName.textContent;
        const emailChanged = newEmail !== profileEmailDisplay.textContent;
        const avatarChanged = newAvatar !== oldAvatar;
        const passwordChanged = newPassword.length > 0;

        if (!nameChanged && !emailChanged && !avatarChanged && !passwordChanged) {
            cancelProfileBtn.click();
            return;
        }

        saveProfileBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        saveProfileBtn.disabled = true;

        const updateData = {};
        if (nameChanged || avatarChanged) {
            updateData.data = { ...currentUser.user_metadata };
            if (nameChanged) updateData.data.username = newName;
            if (avatarChanged) updateData.data.avatar_url = newAvatar;
        }
        if (emailChanged) updateData.email = newEmail;
        if (passwordChanged) updateData.password = newPassword;

        const { data, error } = await supabase.auth.updateUser(updateData);

        saveProfileBtn.innerHTML = 'Save';
        saveProfileBtn.disabled = false;

        if (error) {
            alert('Error updating profile: ' + error.message);
        } else {
            currentUser = data.user;
            if (nameChanged) profileName.textContent = newName;
            if (nameChanged || avatarChanged) {
                profileImage.src = newAvatar ? newAvatar : `https://ui-avatars.com/api/?name=${encodeURIComponent(newName)}&background=1e1e1e&color=ffffff&size=300`;
            }
            if (emailChanged) {
                alert('Email change initiated. Check both inboxes for confirmation links if Secure Email Change is enabled.');
                profileEmailDisplay.textContent = newEmail;
            }
            if (passwordChanged) {
                alert('Password successfully changed!');
            }
            profileDisplayContainer.classList.remove('hidden');
            editProfileContainer.classList.add('hidden');
        }
    });

    deleteAccountBtn.addEventListener('click', async () => {
        const confirmDelete = confirm("🚨 DANGER ZONE 🚨\n\nAre you absolutely sure you want to completely delete your account?\nAll your watchlist data will be permanently wiped.\n\nThis action CANNOT be undone.");
        if (!confirmDelete) return;

        deleteAccountBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        deleteAccountBtn.disabled = true;

        try {
            const response = await fetch('/api/admin/delete_user', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ user_id: currentUser.id })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || 'Backend failed to delete user');
            }

            alert('Your account has been deleted permanently. We are sad to see you go!');
            await supabase.auth.signOut();
            window.location.href = 'login.html';

        } catch (error) {
            alert("Error deleting account from server:\n" + error.message + "\n\nMake sure your FastAPI server is running and .env is configured with your Supabase Service Role Key!");
            deleteAccountBtn.innerHTML = 'Delete Final Account';
            deleteAccountBtn.disabled = false;
        }
    });

    initProfile();
});
