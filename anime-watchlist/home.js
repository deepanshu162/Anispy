document.addEventListener('DOMContentLoaded', () => {
    // Top-Level DOM
    const topSearchBtn = document.getElementById('topSearchBtn');
    const navSearchTrigger = document.getElementById('navSearchTrigger');
    const homeSearchTrigger = document.getElementById('homeSearchTrigger');
    const searchOverlay = document.getElementById('searchOverlay');
    const closeSearchBtn = document.getElementById('closeSearchBtn');
    const globalSearchInput = document.getElementById('globalSearchInput');
    const searchResults = document.getElementById('searchResults');
    const loadingIndicator = document.getElementById('loadingIndicator');

    // Hero DOM
    const heroBg = document.getElementById('heroBg');
    const heroTitle = document.getElementById('heroTitle');
    const heroDesc = document.getElementById('heroDesc');
    const heroDetailBtn = document.getElementById('heroDetailBtn');
    
    // Modal Elements
    const animeModal = document.getElementById('animeModal');
    const closeModalBtn = document.getElementById('closeDetailsBtn');
    const statusSelect = document.getElementById('statusSelect');
    const saveToListBtn = document.getElementById('saveToListBtn');
    const episodesInputWrapper = document.getElementById('episodesInputWrapper');
    const episodesWatchedInput = document.getElementById('episodesWatched');
    const userRatingSelect = document.getElementById('userRatingSelect');
    const toastContainer = document.getElementById('toastContainer');

    // Grids
    const trendingScroll = document.getElementById('trendingScroll');
    const upcomingGrid = document.getElementById('upcomingGrid');
    const trendingLeftBtn = document.getElementById('trendingLeftBtn');
    const trendingRightBtn = document.getElementById('trendingRightBtn');

    const newEpisodesScroll = document.getElementById('newEpisodesScroll');
    const newEpsLeftBtn = document.getElementById('newEpsLeftBtn');
    const newEpsRightBtn = document.getElementById('newEpsRightBtn');

    if (newEpsLeftBtn) {
        newEpsLeftBtn.addEventListener('click', () => {
            newEpisodesScroll.scrollBy({ left: -300, behavior: 'smooth' });
        });
    }
    if (newEpsRightBtn) {
        newEpsRightBtn.addEventListener('click', () => {
            newEpisodesScroll.scrollBy({ left: 300, behavior: 'smooth' });
        });
    }

    if (trendingLeftBtn) {
        trendingLeftBtn.addEventListener('click', () => {
            trendingScroll.scrollBy({ left: -300, behavior: 'smooth' });
        });
    }
    if (trendingRightBtn) {
        trendingRightBtn.addEventListener('click', () => {
            trendingScroll.scrollBy({ left: 300, behavior: 'smooth' });
        });
    }

    let currentHeroAnime = null;
    let apiSearchTimeout = null;
    
    // Modal State
    let currentUser = null;
    let watchlist = [];
    let currentAnime = null;

    // Supabase init (For nav profile handling / basic checks if needed)
    const SUPABASE_URL = 'https://klxbsnywxpchrqavxjcd.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGJzbnl3eHBjaHJxYXZ4amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNzE4NDEsImV4cCI6MjA4OTY0Nzg0MX0.wxmFEKE0FMiUrZluQWnNoxWMAwHTwFDK7kJ83Rtu3mg';
    let supabaseUrlClient = null;
    if(window.supabase) {
        supabaseUrlClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        supabaseUrlClient.auth.getSession().then(({data:{session}}) => {
            if(session) {
                currentUser = session.user;
                document.getElementById('navProfileText').textContent = 'PROFILE';
                loadWatchlist();
            } else {
                document.getElementById('navProfileText').textContent = 'LOGIN';
            }
        });
    }

    async function loadWatchlist() {
        if (!currentUser || !supabaseUrlClient) return;
        const { data, error } = await supabaseUrlClient.from('watchlist').select('*').eq('user_id', currentUser.id);
        if (data) {
            watchlist = data.map(item => ({
                id: item.anime_id,
                title: item.title,
                status: item.status,
                episodesWatched: item.episodes_watched || 0,
                userRating: item.user_rating || ''
            }));
        }
    }

    // --- Search Handlers ---
    function openSearch() {
        searchOverlay.classList.remove('hidden');
        globalSearchInput.focus();
    }
    
    function closeSearch() {
        searchOverlay.classList.add('hidden');
        globalSearchInput.value = '';
        searchResults.innerHTML = '';
    }

    if(topSearchBtn) topSearchBtn.addEventListener('click', openSearch);
    if(navSearchTrigger) navSearchTrigger.addEventListener('click', (e) => { e.preventDefault(); openSearch(); });
    if(homeSearchTrigger) homeSearchTrigger.addEventListener('click', openSearch);
    if(closeSearchBtn) closeSearchBtn.addEventListener('click', closeSearch);

    globalSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(apiSearchTimeout);
        
        if (query.length < 3) {
            searchResults.innerHTML = '';
            loadingIndicator.classList.add('hidden');
            return;
        }

        loadingIndicator.classList.remove('hidden');
        
        apiSearchTimeout = setTimeout(async () => {
            try {
                // Use backend search if available, fallback to Jikan API directly if cors isn't an issue
                // The main app.js uses `/api/search`
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=15`);
                if(!response.ok) throw new Error('Network error');
                const data = await response.json();
                renderApiResults(data.data);
            } catch (error) {
                console.error('Search error:', error);
                // Fallback to Jikan directly just in case backend is offline
                searchJikanDirect(query);
            } finally {
                loadingIndicator.classList.add('hidden');
            }
        }, 600);
    });

    async function searchJikanDirect(query) {
        try {
            const res = await fetch(`https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=15`);
            const data = await res.json();
            // Wrap in group format expected by renderApiResults
            const mockedGroups = data.data.map(anime => ({
                main: {
                    mal_id: anime.mal_id,
                    title: anime.title_english || anime.title,
                    image: anime.images.jpg.image_url,
                    large_image: anime.images.jpg.large_image_url,
                    score: anime.score,
                    type: anime.type,
                    year: anime.year,
                    genres: anime.genres
                },
                seasons: []
            }));
            renderApiResults(mockedGroups);
        } catch(e) {
            searchResults.innerHTML = '<div style="color:red; text-align:center; padding: 2rem;">Error fetching results</div>';
        }
    }

    function renderApiResults(groups) {
        searchResults.innerHTML = '';
        if (!groups || groups.length === 0) {
            searchResults.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding: 2rem;">No results found</div>';
            return;
        }
        groups.forEach(g => {
            const anime = g.main;
            const el = document.createElement('div');
            el.className = 'api-result-item';
            el.style = "display: flex; gap: 1rem; padding: 0.75rem; background: #1e1e1e; border-radius: 0.5rem; cursor: pointer; align-items: center;";
            
            const title = anime.title_english || anime.title;
            const year = anime.year || 'N/A';
            
            el.innerHTML = `
                <img src="${anime.image}" alt="${title}" style="width: 40px; height: 60px; object-fit: cover; border-radius: 0.25rem;">
                <div style="flex:1;">
                    <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.25rem;">${title}</div>
                    <div style="font-size: 0.8rem; color: #a0a0a0;">${anime.type || 'TV'} • ${year} • ★ ${anime.score || 'N/A'}</div>
                </div>
            `;
            el.addEventListener('click', () => {
                openModalFromApi(anime);
                searchOverlay.classList.add('hidden');
            });
            searchResults.appendChild(el);
        });
    }

    // --- Data Fetching for Home Page ---

    async function fetchRandomAnimeForHero() {
        try {
            const res = await fetch('https://api.jikan.moe/v4/random/anime');
            const data = await res.json();
            const anime = data.data;
            
            // If the random anime is NSFW, maybe try again? (Jikan v4 filters sfw by default unless explicitly disabled, but just to be sure)
            if(anime.rating && anime.rating.includes('Rx')) {
                return fetchRandomAnimeForHero();
            }

            currentHeroAnime = anime;
            const title = anime.title_english || anime.title;
            const synopsis = anime.synopsis ? anime.synopsis.split('. ')[0] + '.' : 'No synopsis available.';
            
            let initialImage = anime.trailer?.images?.maximum_image_url;
            const fallbackImage = anime.trailer?.images?.large_image_url || anime.images.webp.large_image_url || anime.images.jpg.large_image_url;

            if (initialImage) {
                const imgLoader = new Image();
                imgLoader.onload = () => {
                    // YouTube sometimes returns a 120x90 grey camera icon for maxresdefault instead of 404
                    if (imgLoader.width <= 120) {
                        heroBg.style.backgroundImage = `url('${fallbackImage}')`;
                    }
                };
                imgLoader.onerror = () => {
                    heroBg.style.backgroundImage = `url('${fallbackImage}')`;
                };
                imgLoader.src = initialImage;
            } else {
                initialImage = fallbackImage;
            }

            heroBg.classList.remove('skeleton-bg');
            heroBg.style.backgroundImage = `url('${initialImage}')`;
            heroTitle.textContent = title;
            heroDesc.textContent = synopsis;
        } catch (error) {
            console.error('Error fetching random anime:', error);
            heroTitle.textContent = 'EXPLORE ANIME';
            heroDesc.textContent = 'Discover vast worlds and incredible stories right here on Anispy.';
            heroBg.classList.remove('skeleton-bg');
        }
    }

    async function fetchTrending() {
        try {
            const res = await fetch('https://api.jikan.moe/v4/top/anime?filter=airing&limit=8');
            const data = await res.json();
            renderTrending(data.data);
        } catch (error) {
            console.error('Error fetching trending:', error);
            trendingScroll.innerHTML = '<span style="color:#757575;">Failed to load trending anime.</span>';
        }
    }

    async function fetchNewEpisodes() {
        try {
            const res = await fetch('https://api.jikan.moe/v4/seasons/now?limit=8');
            const data = await res.json();
            renderNewEpisodes(data.data);
        } catch (error) {
            console.error('Error fetching new episodes:', error);
            if(newEpisodesScroll) newEpisodesScroll.innerHTML = '<span style="color:#757575;">Failed to load new episodes.</span>';
        }
    }

    function renderNewEpisodes(animeList) {
        if(!newEpisodesScroll) return;
        newEpisodesScroll.innerHTML = '';
        animeList.forEach(anime => {
            const title = anime.title_english || anime.title;
            const score = anime.score || 'N/A';
            const studio = anime.studios && anime.studios.length > 0 ? anime.studios[0].name : 'Unknown';
            
            let broadcastDay = 'This Week';
            if (anime.broadcast && anime.broadcast.day && anime.broadcast.day !== 'Unknown') {
                const dayRaw = anime.broadcast.day.split(' ')[0];
                broadcastDay = dayRaw.endsWith('s') ? dayRaw.slice(0, -1) : dayRaw;
            }
            
            const card = document.createElement('div');
            card.className = 'trending-card';
            card.innerHTML = `
                <img src="${anime.images.jpg.large_image_url}" alt="${title}" class="trending-img">
                <div class="trending-gradient">
                    <div class="trending-score" style="color: #6ee7b7;"><i class="fa-solid fa-calendar-day"></i> ${broadcastDay}</div>
                    <div class="trending-title">${title}</div>
                    <div class="trending-meta">${studio} • ★ ${score}</div>
                </div>
            `;
            
            card.addEventListener('click', () => { openModalFromApi(anime); });
            newEpisodesScroll.appendChild(card);
        });
    }

    async function fetchUpcoming() {
        try {
            const res = await fetch('https://api.jikan.moe/v4/seasons/upcoming?limit=4');
            const data = await res.json();
            renderUpcoming(data.data);
        } catch (error) {
            console.error('Error fetching upcoming:', error);
            upcomingGrid.innerHTML = '<span style="color:#757575;">Failed to load upcoming anime.</span>';
        }
    }

    function renderTrending(animeList) {
        trendingScroll.innerHTML = '';
        animeList.forEach(anime => {
            const title = anime.title_english || anime.title;
            const score = anime.score || 'N/A';
            const studio = anime.studios && anime.studios.length > 0 ? anime.studios[0].name : 'Unknown';
            const eps = anime.episodes ? `${anime.episodes} EPS` : 'ONGOING';
            
            const card = document.createElement('div');
            card.className = 'trending-card';
            card.innerHTML = `
                <img src="${anime.images.jpg.large_image_url}" alt="${title}" class="trending-img">
                <div class="trending-gradient">
                    <div class="trending-score"><i class="fa-solid fa-star"></i> ${score}</div>
                    <div class="trending-title">${title}</div>
                    <div class="trending-meta">${studio} • ${eps}</div>
                </div>
            `;
            
            card.addEventListener('click', () => { openModalFromApi(anime); });
            trendingScroll.appendChild(card);
        });
    }

    function renderUpcoming(animeList) {
        if(animeList.length < 3) return; // Need at least 3 for nicely formatted grid
        
        upcomingGrid.innerHTML = '';

        // First item -> Large Banner
        const largeAnime1 = animeList[0];
        upcomingGrid.appendChild(createUpcomingLargeBanner(largeAnime1, 'EXCLUSIVE PREMIERE'));

        // Next 2 items -> Small Grid
        if (animeList.length >= 3) {
            const smallGrid = document.createElement('div');
            smallGrid.className = 'upcoming-small-grid';
            smallGrid.appendChild(createUpcomingSmallCard(animeList[1], 'fa-bolt'));
            smallGrid.appendChild(createUpcomingSmallCard(animeList[2], 'fa-wand-magic-sparkles'));
            upcomingGrid.appendChild(smallGrid);
        }

        // Fourth item -> Medium/Large Banner
        if (animeList.length >= 4) {
            upcomingGrid.appendChild(createUpcomingLargeBanner(animeList[3], 'HIGHLY ANTICIPATED'));
        }
    }

    function createUpcomingLargeBanner(anime, exclusiveText) {
        const title = anime.title_english || anime.title;
        const studio = anime.studios && anime.studios.length > 0 ? anime.studios[0].name : 'Unknown Studio';
        // Try getting a horizontal image if available, else fallback
        const img = anime.trailer?.images?.maximum_image_url || anime.images.jpg.large_image_url;
        const season = anime.season && anime.year ? `${anime.season} ${anime.year}` : 'TBA';

        const wrapper = document.createElement('div');
        wrapper.className = 'upcoming-banner';
        wrapper.innerHTML = `
            <img src="${img}" class="upcoming-banner-img" style="object-position: center 30%;">
            <div class="upcoming-banner-gradient">
                <div class="upcoming-exclusive">${exclusiveText}</div>
                <div class="upcoming-banner-title">${title}</div>
                <div class="upcoming-tags">
                    <span class="upcoming-tag">${season}</span>
                    <span class="upcoming-tag">${studio}</span>
                </div>
            </div>
        `;
        wrapper.addEventListener('click', () => { openModalFromApi(anime); });
        return wrapper;
    }

    function createUpcomingSmallCard(anime, iconClass) {
        const title = anime.title_english || anime.title;
        const date = anime.season && anime.year ? `Coming ${anime.season.substring(0,3)} ${anime.year}` : 'In Production';

        const card = document.createElement('div');
        card.className = 'upcoming-card';
        card.innerHTML = `
            <div class="upcoming-card-icon"><i class="fa-solid ${iconClass}"></i></div>
            <div class="upcoming-card-title">${title}</div>
            <div class="upcoming-card-date">${date}</div>
        `;
        card.addEventListener('click', () => { openModalFromApi(anime); });
        return card;
    }

    if (heroDetailBtn) {
        heroDetailBtn.addEventListener('click', () => {
            if (currentHeroAnime) openModalFromApi(currentHeroAnime);
        });
    }

    // Modal Functions
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (animeModal) animeModal.addEventListener('click', (e) => {
        if (e.target === animeModal) closeModal();
    });

    if (statusSelect) {
        statusSelect.addEventListener('change', (e) => {
            if (e.target.value === 'completed' || e.target.value === 'dropped') {
                episodesInputWrapper.classList.remove('hidden');
                if(e.target.value === 'completed' && currentAnime && currentAnime.episodes) {
                    episodesWatchedInput.value = currentAnime.episodes;
                }
            } else {
                episodesInputWrapper.classList.add('hidden');
            }
        });
    }

    if (saveToListBtn) saveToListBtn.addEventListener('click', saveCurrentAnime);

    function showToast(message) {
        if (!toastContainer) return;
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fa-solid fa-check" style="color:var(--accent-red)"></i> <span>${message}</span>`;
        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    function openModalFromApi(anime) {
        currentAnime = {
            id: anime.mal_id || anime.anime_id || anime.id,
            title: anime.title_english || anime.title,
            image: anime.large_image || anime.image || anime.images?.jpg?.large_image_url || anime.images?.webp?.large_image_url,
            score: anime.score || 'N/A',
            episodes: anime.episodes,
            status_api: anime.status || anime.status_api,
            synopsis: anime.synopsis,
            popularity: anime.popularity,
            type: anime.type,
            duration: anime.duration,
            genres: anime.genres,
            studios: anime.studios,
            aired: anime.aired?.string || anime.aired,
            producers: anime.producers,
            themes: anime.themes
        };
        
        if (!currentAnime.genres || !currentAnime.duration || !currentAnime.aired) {
            if(document.getElementById('modalTitle')) document.getElementById('modalTitle').textContent = "Loading...";
            if(animeModal) animeModal.classList.remove('hidden');
            fetch(`https://api.jikan.moe/v4/anime/${currentAnime.id}`)
                .then(res => res.json())
                .then(data => {
                    if(!data || !data.data) return populateAndShowModal();
                    const fullAnime = data.data;
                    currentAnime.popularity = fullAnime.popularity;
                    currentAnime.type = fullAnime.type;
                    currentAnime.duration = fullAnime.duration;
                    currentAnime.genres = fullAnime.genres;
                    currentAnime.studios = fullAnime.studios;
                    currentAnime.aired = fullAnime.aired?.string || fullAnime.aired;
                    currentAnime.producers = fullAnime.producers;
                    currentAnime.themes = fullAnime.themes;
                    currentAnime.episodes = fullAnime.episodes;
                    currentAnime.synopsis = fullAnime.synopsis;
                    // Provide fallback image if missing
                    if (!currentAnime.image && fullAnime.images) {
                        currentAnime.image = fullAnime.images.jpg?.large_image_url || fullAnime.images.webp?.large_image_url;
                    }
                    populateAndShowModal();
                })
                .catch(err => {
                    populateAndShowModal();
                });
        } else {
            populateAndShowModal();
        }
    }

    function populateAndShowModal() {
        if (!currentAnime) return;
        
        document.getElementById('modalImage').src = currentAnime.image || '';
        document.getElementById('modalTitle').textContent = currentAnime.title || 'Unknown';
        document.getElementById('modalScore').textContent = currentAnime.score || 'N/A';
        document.getElementById('modalEpisodes').textContent = currentAnime.episodes || '?';
        document.getElementById('modalDuration').textContent = currentAnime.duration || 'Unknown';
        
        let synopsis = currentAnime.synopsis || 'No synopsis available.';
        document.getElementById('modalSynopsis').textContent = synopsis;
        
        document.getElementById('totalEpsSpan').textContent = currentAnime.episodes || '?';
        
        document.getElementById('modalTagTop').textContent = currentAnime.popularity ? `TRENDING #${currentAnime.popularity}` : 'ANIME';
        document.getElementById('modalTagType').textContent = currentAnime.type || 'TV';

        const genresContainer = document.getElementById('modalGenres');
        genresContainer.innerHTML = '';
        if (currentAnime.genres && currentAnime.genres.length > 0) {
            currentAnime.genres.slice(0, 3).forEach(g => {
                const span = document.createElement('span');
                span.className = 'genre-pill';
                span.textContent = g.name.toUpperCase();
                genresContainer.appendChild(span);
            });
        }

        document.getElementById('modalStudio').textContent = currentAnime.studios && currentAnime.studios.length > 0 ? currentAnime.studios[0].name : 'Unknown';
        document.getElementById('modalAired').textContent = currentAnime.aired || 'Unknown';
        document.getElementById('modalProducers').textContent = currentAnime.producers && currentAnime.producers.length > 0 ? currentAnime.producers.map(p => p.name).slice(0,2).join(', ') : 'Unknown';
        document.getElementById('modalTheme').textContent = currentAnime.themes && currentAnime.themes.length > 0 ? currentAnime.themes[0].name : 'None';
        
        const existingEntry = watchlist.find(item => item.id === currentAnime.id);
        if (existingEntry) {
            statusSelect.value = existingEntry.status;
            episodesWatchedInput.value = existingEntry.episodesWatched || 0;
            if(userRatingSelect) userRatingSelect.value = existingEntry.userRating || '';
            saveToListBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Update Watchlist';
        } else {
            statusSelect.value = 'plan_to_watch';
            episodesWatchedInput.value = 0;
            if(userRatingSelect) userRatingSelect.value = '';
            saveToListBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Add to Watchlist';
        }
        
        statusSelect.dispatchEvent(new Event('change'));
        animeModal.classList.remove('hidden');

        const charContainer = document.getElementById('modalCharacters');
        charContainer.innerHTML = '<span style="color:#aaa; font-size:0.8rem; padding: 1rem;">Loading characters...</span>';
        
        fetch(`https://api.jikan.moe/v4/anime/${currentAnime.id}/characters`)
            .then(res => res.json())
            .then(data => {
                const chars = data.data.slice(0, 8);
                charContainer.innerHTML = '';
                if (chars.length === 0) charContainer.innerHTML = '<span style="color:#aaa; font-size:0.8rem;">No characters found.</span>';
                chars.forEach(c => {
                    const card = document.createElement('div');
                    card.className = 'character-card';
                    card.innerHTML = `
                        <img src="${c.character.images.jpg.image_url}" class="character-img" alt="${c.character.name}">
                        <div class="character-name">${c.character.name}</div>
                        <div class="character-role">${c.role}</div>
                    `;
                    charContainer.appendChild(card);
                });
            })
            .catch(err => {
                console.error(err);
                charContainer.innerHTML = '<span style="color:#fca5a5; font-size:0.8rem;">Failed to load characters.</span>';
            });
            
        // Hide seasons for now to avoid duplicating massive logic
        const seasonsContainer = document.getElementById('modalSeasonsContainer');
        if (seasonsContainer) seasonsContainer.classList.add('hidden');
    }

    function closeModal() {
        if(animeModal) animeModal.classList.add('hidden');
        currentAnime = null;
    }

    async function saveCurrentAnime() {
        if (!currentAnime) return;
        if (!currentUser) {
            showToast('Please login to save anime');
            return;
        }
        if (!supabaseUrlClient) return;
        
        saveToListBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
        
        const status = statusSelect.value;
        const epsWatched = parseInt(episodesWatchedInput.value) || 0;
        const userRating = userRatingSelect ? userRatingSelect.value : '';
        
        const dbEntry = {
            user_id: currentUser.id,
            anime_id: currentAnime.id,
            title: currentAnime.title,
            image: currentAnime.image,
            score: currentAnime.score,
            episodes: currentAnime.episodes,
            status_api: currentAnime.status_api,
            synopsis: currentAnime.synopsis,
            popularity: currentAnime.popularity,
            type: currentAnime.type,
            duration: currentAnime.duration,
            status: status,
            episodes_watched: status === 'plan_to_watch' ? 0 : epsWatched,
            user_rating: userRating,
            genres: currentAnime.genres || []
        };
        
        const { error } = await supabaseUrlClient
            .from('watchlist')
            .upsert(dbEntry, { onConflict: 'user_id, anime_id' });
            
        if (error) {
            console.error(error);
            showToast('Failed to save to cloud.');
            saveToListBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Try Again';
            return;
        }

        const existingIndex = watchlist.findIndex(item => item.id === currentAnime.id);
        if (existingIndex >= 0) {
            watchlist[existingIndex].status = status;
            watchlist[existingIndex].episodesWatched = dbEntry.episodes_watched;
            watchlist[existingIndex].userRating = userRating;
            showToast('Item updated');
        } else {
            watchlist.push({
                id: currentAnime.id,
                title: currentAnime.title,
                status: status,
                episodesWatched: dbEntry.episodes_watched,
                userRating: userRating
            });
            showToast('Added to watchlist');
        }
        
        closeModal();
    }

    // Init Fetches
    fetchRandomAnimeForHero();
    fetchTrending();
    fetchNewEpisodes();
    fetchUpcoming();
});
