document.addEventListener('DOMContentLoaded', () => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    const discoverRowsContainer = document.getElementById('discoverRowsContainer');
    const discoverEmptyState = document.getElementById('discoverEmptyState');
    
    // Top-Level DOM
    const topSearchBtn = document.getElementById('topSearchBtn');
    const navSearchTrigger = document.getElementById('navSearchTrigger');
    const searchOverlay = document.getElementById('searchOverlay');
    const closeSearchBtn = document.getElementById('closeSearchBtn');
    const globalSearchInput = document.getElementById('globalSearchInput');
    const searchResults = document.getElementById('searchResults');

    // Modal Elements
    const animeModal = document.getElementById('animeModal');
    const closeModalBtn = document.getElementById('closeDetailsBtn');
    const statusSelect = document.getElementById('statusSelect');
    const saveToListBtn = document.getElementById('saveToListBtn');
    const episodesInputWrapper = document.getElementById('episodesInputWrapper');
    const episodesWatchedInput = document.getElementById('episodesWatched');
    const userRatingSelect = document.getElementById('userRatingSelect');
    const toastContainer = document.getElementById('toastContainer');

    // State
    let currentUser = null;
    let watchlist = [];
    let currentAnime = null;

    // --- Swap Bench ---
    // Map of sectionKey -> { extras: [], scrollEl, type }
    const sectionBench = {};

    // Supabase init
    const SUPABASE_URL = 'https://klxbsnywxpchrqavxjcd.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGJzbnl3eHBjaHJxYXZ4amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNzE4NDEsImV4cCI6MjA4OTY0Nzg0MX0.wxmFEKE0FMiUrZluQWnNoxWMAwHTwFDK7kJ83Rtu3mg';
    let supabaseUrlClient = null;
    if(window.supabase) {
        supabaseUrlClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        supabaseUrlClient.auth.getSession().then(({data:{session}}) => {
            if(session) {
                currentUser = session.user;
                document.getElementById('navProfileText').textContent = 'PROFILE';
            } else {
                document.getElementById('navProfileText').textContent = 'LOGIN';
            }
        });
    }

    // --- Search Handlers ---
    let apiSearchTimeout;
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
    if(closeSearchBtn) closeSearchBtn.addEventListener('click', closeSearch);

    globalSearchInput.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        clearTimeout(apiSearchTimeout);
        if (query.length < 3) {
            searchResults.innerHTML = '';
            return;
        }
        searchResults.innerHTML = '<div style="text-align:center; padding: 2rem; color: #757575;">Searching...</div>';
        apiSearchTimeout = setTimeout(async () => {
            try {
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=15`);
                if(!response.ok) throw new Error('Network error');
                const data = await response.json();
                renderApiResults(data.data);
            } catch (error) {
                searchResults.innerHTML = '<div style="color:red; text-align:center; padding: 2rem;">Error fetching results</div>';
            }
        }, 600);
    });

    function renderApiResults(groups) {
        searchResults.innerHTML = '';
        if (!groups || groups.length === 0) {
            searchResults.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding: 2rem;">No results found</div>';
            return;
        }
        groups.forEach(g => {
            const anime = g.main;
            const el = document.createElement('div');
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

    // --- Recommendations Logic ---
    async function loadRecommendations() {
        if (!supabaseUrlClient) {
            showEmptyState("Database client not loaded.");
            return;
        }
        
        const { data: { session } } = await supabaseUrlClient.auth.getSession();
        if (!session) {
            showEmptyState("Please login to see personalized recommendations.");
            return;
        }

        try {
            const { data: watchlistData, error } = await supabaseUrlClient
                .from('watchlist')
                .select('*')
                .eq('user_id', session.user.id);
                
            if (watchlistData) {
                watchlist = watchlistData.map(item => ({
                    id: item.anime_id,
                    title: item.title,
                    status: item.status,
                    episodesWatched: item.episodes_watched || 0,
                    userRating: item.user_rating || ''
                }));
            }

            if (error || !watchlistData || watchlistData.length === 0) {
                showEmptyState("Add some anime to your watchlist to start getting recommendations!");
                return;
            }
            
            loadingOverlay.style.display = 'block';

            // 1. Prepare Top Matches
            const recentIds = [...watchlistData].reverse().slice(0, 10).map(item => item.anime_id);
            
            // 2. Determine Top Genres across entire watchlist
            let genreCounts = {};
            let allWatchedMalIds = new Set(watchlistData.map(i => i.anime_id));
            
            watchlistData.forEach(item => {
                if (item.genres && Array.isArray(item.genres)) {
                    item.genres.forEach(g => {
                        if (g.type !== "Demographics" && g.type !== "Themes") {
                            if (!genreCounts[g.name]) genreCounts[g.name] = { id: g.mal_id, count: 0 };
                            genreCounts[g.name].count++;
                        }
                    });
                }
            });
            
            const topGenres = Object.entries(genreCounts)
                .sort((a, b) => b[1].count - a[1].count)
                .slice(0, 2);

            // 3. Fetch genre rows sequentially with a delay to respect Jikan rate limits.
            // Fire the recommendations API call first (it hits our backend, not Jikan).
            const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

            let recResult = null;
            try {
                const recRes = await fetch('/api/recommendations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ anime_ids: recentIds, limit: 20 })
                });
                const recData = await recRes.json();
                recResult = { title: "TOP MATCHES FOR YOU", type: "mixed", data: recData.data };
            } catch(e) {
                console.error('Recommendations fetch failed:', e);
            }

            const genreResults = [];
            for (const [genreName, genreData] of topGenres) {
                if (genreData.id) {
                    // Wait 700ms between each genre's first request to avoid rate limiting
                    await sleep(700);
                    try {
                        let allItems = [];
                        // Fetch up to 3 pages until we have 20+ unwatched anime
                        for (let page = 1; page <= 3; page++) {
                            if (allItems.length >= 20) break;
                            if (page > 1) await sleep(700); // extra delay for additional pages
                            const url = `https://api.jikan.moe/v4/anime?genres=${genreData.id}&order_by=popularity&sort=asc&limit=25&page=${page}`;
                            const res = await fetch(url);
                            const d = await res.json();
                            const pageItems = (d.data || [])
                                .filter(a => !allWatchedMalIds.has(a.mal_id))
                                .map(a => ({
                                    title: a.title_english || a.title,
                                    image: a.images.jpg.image_url,
                                    large_image: a.images.jpg.large_image_url,
                                    score: a.score || 'N/A',
                                    mal_id: a.mal_id
                                }));
                            allItems = allItems.concat(pageItems);
                            // If Jikan returned fewer than 25 items, no more pages exist
                            if (!d.data || d.data.length < 25) break;
                        }
                        if (allItems.length > 0) {
                            genreResults.push({
                                title: `TRENDING IN ${genreName.toUpperCase()}`,
                                type: "genre",
                                data: allItems
                            });
                        }
                    } catch(e) {
                        console.error(`Genre fetch failed for ${genreName}:`, e);
                    }
                }
            }

            const results = [recResult, ...genreResults].filter(Boolean);

            loadingOverlay.style.display = 'none';
            if (discoverRowsContainer) discoverRowsContainer.innerHTML = '';
            
            results.forEach(section => {
                if (section.data && section.data.length > 0) {
                    renderHorizontalRow(section.title, section.data, section.type);
                }
            });
            
        } catch (error) {
            console.error('Error fetching recommendations:', error);
            showEmptyState("Failed to load recommendations. Make sure your backend server is running.");
        }
    }

    // Creates a card DOM element for a given anime object
    function createAnimeCard(anime, type) {
        const title = anime.title;
        const image = anime.large_image || anime.image || '';
        
        let scoreText = '';
        if (type === 'mixed') {
            scoreText = '★ ' + (anime.votes ? anime.votes + ' REC' : 'TOP');
        } else {
            scoreText = '★ ' + anime.score;
        }
        
        const card = document.createElement('div');
        card.className = 'trending-card discover-card';
        card.dataset.malId = anime.mal_id;
        card.innerHTML = `
            <img src="${image}" alt="${title}" class="trending-img">
            <div class="trending-gradient">
                <div class="trending-score" style="color: #10B981;"><i class="fa-solid fa-thumbs-up"></i> ${scoreText}</div>
                <div class="trending-title">${title}</div>
            </div>
        `;
        
        card.addEventListener('click', () => { openModalFromApi(anime); });
        return card;
    }

    function renderHorizontalRow(sectionTitle, animeList, type) {
        if (!discoverRowsContainer) return;

        // Split into shown (first 10) and bench (rest)
        const SHOW_COUNT = 10;
        const shown = animeList.slice(0, SHOW_COUNT);
        const bench = animeList.slice(SHOW_COUNT);

        const sectionKey = sectionTitle; // Use title as the map key
        
        const section = document.createElement('section');
        section.className = 'home-section';
        section.style.marginBottom = '0.5rem';
        
        const header = document.createElement('div');
        header.className = 'section-header';
        
        header.innerHTML = `
            <h2 class="section-title italic-title" style="font-size: 1.1rem;">${sectionTitle}</h2>
            <div class="scroll-controls">
                <button class="scroll-btn left-scroll"><i class="fa-solid fa-chevron-left"></i></button>
                <button class="scroll-btn right-scroll"><i class="fa-solid fa-chevron-right"></i></button>
            </div>
        `;
        
        const scrollContainer = document.createElement('div');
        scrollContainer.className = 'horizontal-scroll hide-scrollbar';
        scrollContainer.dataset.sectionKey = sectionKey;
        
        // Wire up scroll buttons
        const leftBtn = header.querySelector('.left-scroll');
        const rightBtn = header.querySelector('.right-scroll');
        
        if (leftBtn) leftBtn.addEventListener('click', () => { scrollContainer.scrollBy({ left: -300, behavior: 'smooth' }); });
        if (rightBtn) rightBtn.addEventListener('click', () => { scrollContainer.scrollBy({ left: 300, behavior: 'smooth' }); });
        
        shown.forEach(anime => {
            scrollContainer.appendChild(createAnimeCard(anime, type));
        });
        
        section.appendChild(header);
        section.appendChild(scrollContainer);
        discoverRowsContainer.appendChild(section);

        // Register section bench
        sectionBench[sectionKey] = { extras: bench, scrollEl: scrollContainer, type };
    }

    // Called after a successful save — removes the card with matching malId and swaps in a new one
    function swapCardOut(malId) {
        const cards = discoverRowsContainer ? discoverRowsContainer.querySelectorAll(`.discover-card[data-mal-id="${malId}"]`) : [];
        cards.forEach(card => {
            const scrollEl = card.closest('[data-section-key]');
            if (!scrollEl) {
                card.classList.add('card-fade-out');
                setTimeout(() => card.remove(), 350);
                return;
            }
            const sectionKey = scrollEl.dataset.sectionKey;
            const bench = sectionBench[sectionKey];

            card.classList.add('card-fade-out');
            setTimeout(() => {
                card.remove();
                // If we have an extra waiting on the bench, add it
                if (bench && bench.extras.length > 0) {
                    const next = bench.extras.shift();
                    const newCard = createAnimeCard(next, bench.type);
                    newCard.classList.add('card-fade-in');
                    scrollEl.appendChild(newCard);
                    // Remove the animation class after it completes
                    setTimeout(() => newCard.classList.remove('card-fade-in'), 500);
                }
            }, 350);
        });
    }

    function showEmptyState(message) {
        if (loadingOverlay) loadingOverlay.style.display = 'none';
        if (discoverEmptyState) {
            discoverEmptyState.innerHTML = `
                <i class="fa-solid fa-compass" style="font-size: 3rem; opacity: 0.5; margin-bottom: 1rem;"></i>
                <div>${message}</div>
                <button onclick="window.location.href='index.html'" style="margin-top: 1rem; padding: 0.75rem 1.5rem; background: #f31220; color: white; border: none; border-radius: 2rem; cursor: pointer; font-weight: 600;">Explore Home Page</button>
            `;
            discoverEmptyState.style.display = 'block';
        }
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
            image: anime.large_image || anime.image || anime.images?.jpg?.large_image_url,
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
            document.getElementById('modalTitle').textContent = "Loading...";
            animeModal.classList.remove('hidden');
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
            
        // Hide seasons for now
        const seasonsContainer = document.getElementById('modalSeasonsContainer');
        if (seasonsContainer) seasonsContainer.classList.add('hidden');
    }

    function closeModal() {
        animeModal.classList.add('hidden');
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

        const savedMalId = currentAnime.id;

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
            // Swap the card out from the discovery rows
            swapCardOut(savedMalId);
        }
        
        closeModal();
    }

    // Start loading
    loadRecommendations();
});
