document.addEventListener('DOMContentLoaded', () => {
    // Supabase
    const SUPABASE_URL = 'https://klxbsnywxpchrqavxjcd.supabase.co';
    const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtseGJzbnl3eHBjaHJxYXZ4amNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQwNzE4NDEsImV4cCI6MjA4OTY0Nzg0MX0.wxmFEKE0FMiUrZluQWnNoxWMAwHTwFDK7kJ83Rtu3mg';
    const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

    // State
    let watchlist = [];
    let currentUser = null;
    let currentFilter = 'all';
    let searchQuery = '';
    let apiSearchTimeout = null;
    let localFilterTimeout = null;
    let currentAnime = null;

    // DOM Elements - Auth
    const navProfileBtn = document.getElementById('navProfileBtn');
    const navProfileText = document.getElementById('navProfileText');

    // DOM Elements
    const topSearchBtn = document.getElementById('topSearchBtn');
    const searchOverlay = document.getElementById('searchOverlay');
    const closeSearchBtn = document.getElementById('closeSearchBtn');
    const globalSearchInput = document.getElementById('globalSearchInput');
    const searchResults = document.getElementById('searchResults');
    const loadingIndicator = document.getElementById('loadingIndicator');
    
    const filterInput = document.getElementById('filterInput');
    const watchlistContainer = document.getElementById('watchlistContainer');
    const emptyState = document.getElementById('emptyState');
    const statusTabs = document.querySelectorAll('.status-tab');
    const clearAllBtn = document.getElementById('clearAllBtn');
    const sortBtn = document.getElementById('sortBtn');
    const loadMoreContainer = document.getElementById('loadMoreContainer');
    const toastContainer = document.getElementById('toastContainer');
    
    // Modal Elements
    const animeModal = document.getElementById('animeModal');
    const closeModalBtn = document.getElementById('closeDetailsBtn');
    const statusSelect = document.getElementById('statusSelect');
    const saveToListBtn = document.getElementById('saveToListBtn');
    const episodesInputWrapper = document.getElementById('episodesInputWrapper');
    const episodesWatchedInput = document.getElementById('episodesWatched');
    const userRatingSelect = document.getElementById('userRatingSelect');
    
    // --- AUTHENTICATION ---
    async function initAuth() {
        const { data: { session } } = await supabase.auth.getSession();
        handleSession(session);

        supabase.auth.onAuthStateChange((_event, session) => {
            handleSession(session);
        });
    }

    function handleSession(session) {
        if (session) {
            currentUser = session.user;
            navProfileText.textContent = 'PROFILE';
            loadWatchlist();
        } else {
            window.location.href = 'login.html';
        }
    }

    navProfileBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (currentUser) {
            window.location.href = 'profile.html';
        } else {
            window.location.href = 'login.html';
        }
    });

    // --- DATA SYNC ---
    async function loadWatchlist() {
        if (!currentUser) return;
        
        const { data, error } = await supabase
            .from('watchlist')
            .select('*')
            .order('updated_at', { ascending: false });
            
        if (error) {
            console.error('Error loading watchlist:', error);
            showToast('Error loading your list');
            return;
        }
        
        // Map Supabase DB underscore case back into camelCase for the frontend UI logic
        watchlist = data.map(item => ({
            id: item.anime_id,
            title: item.title,
            image: item.image,
            score: item.score,
            episodes: item.episodes,
            status_api: item.status_api,
            synopsis: item.synopsis,
            popularity: item.popularity,
            type: item.type,
            duration: item.duration,
            status: item.status,
            episodesWatched: item.episodes_watched || 0,
            userRating: item.user_rating || '',
            genres: item.genres || [], studios: item.studios || [], producers: item.producers || [], themes: item.themes || [], aired: item.aired || '' 
        }));
        
        renderWatchlist();
    }

    // --- EVENT LISTENERS ---

    // Global Search Overlay
    topSearchBtn.addEventListener('click', () => {
        searchOverlay.classList.remove('hidden');
        globalSearchInput.focus();
    });

    closeSearchBtn.addEventListener('click', () => {
        searchOverlay.classList.add('hidden');
        globalSearchInput.value = '';
        searchResults.innerHTML = '';
    });

    globalSearchInput.addEventListener('input', handleApiSearch);

    // Local Watchlist Filtering
    filterInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        clearTimeout(localFilterTimeout);
        localFilterTimeout = setTimeout(renderWatchlist, 300);
    });

    // Tabs
    statusTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            statusTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            
            tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            
            renderWatchlist();
        });
    });

    // Clear All & Sort
    clearAllBtn.addEventListener('click', async () => {
        if (watchlist.length === 0) return;
        if (confirm('Are you sure you want to clear your entire watchlist?')) {
            const { error } = await supabase.from('watchlist').delete().eq('user_id', currentUser.id);
            if (!error) {
                watchlist = [];
                renderWatchlist();
                showToast('Watchlist cleared');
            }
        }
    });
    
    sortBtn.addEventListener('click', () => {
        watchlist.reverse();
        renderWatchlist();
        showToast('Sorting applied');
    });

    // Modal
    closeModalBtn.addEventListener('click', closeModal);
    animeModal.addEventListener('click', (e) => {
        if (e.target === animeModal) closeModal();
    });

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

    saveToListBtn.addEventListener('click', saveCurrentAnime);

    // --- FUNCTIONS ---

    function handleApiSearch(e) {
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
                // Backend handles Jikan call + grouping logic
                const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=15`);
                const data = await response.json();
                renderApiResults(data.data);
            } catch (error) {
                console.error('Search error:', error);
            } finally {
                loadingIndicator.classList.add('hidden');
            }
        }, 600);
    }

    // isRelatedTitle kept here for local watchlist grouping (groupWatchlist uses it — no API call involved)
    // groupApiResults and getSeasonLabel moved to backend/main.py
    function isRelatedTitle(base, ext) {
        if (!base || !ext) return false;
        const lBase = base.toLowerCase();
        const lExt = ext.toLowerCase();
        
        if (lExt === lBase) return true;
        if (lExt.startsWith(lBase + ' ') || lExt.startsWith(lBase + ':') || lExt.startsWith(lBase + '-')) return true;
        if (lBase.startsWith(lExt + ' ') || lBase.startsWith(lExt + ':') || lBase.startsWith(lExt + '-')) return true;
        
        // Stripped prefix check: handles special chars (e.g. "Yu☆Gi☆Oh!" vs "Yu-Gi-Oh!")
        // Using startsWith (not includes) to avoid short words matching inside unrelated longer titles
        const strippedBase = lBase.replace(/[^a-z0-9]/g, '');
        const strippedExt = lExt.replace(/[^a-z0-9]/g, '');
        
        if (strippedBase.length >= 4 && strippedExt.startsWith(strippedBase)) return true;
        if (strippedExt.length >= 4 && strippedBase.startsWith(strippedExt)) return true;
        
        return false;
    }

    function groupWatchlist(list) {
        // Sort shorest names first so the base seed captures extensions easily
        const sortedList = [...list].sort((a,b) => a.title.length - b.title.length);
        const groups = [];
        
        sortedList.forEach(anime => {
            const currentTitle = anime.title;
            let matched = false;
            for (let g of groups) {
                if (isRelatedTitle(g.mainAnime.title, currentTitle)) {
                    if (!g.seasons.find(s => s.id === anime.id)) g.seasons.push(anime);
                    matched = true;
                    break;
                }
            }
            if (!matched) {
                groups.push({
                    mainAnime: anime,
                    seasons: [anime]
                });
            }
        });
        
        // Restore groups array to match the original sort order of the most recent item in 'list'
        groups.sort((a, b) => {
            const minIndexA = Math.min(...a.seasons.map(s => list.indexOf(s)));
            const minIndexB = Math.min(...b.seasons.map(s => list.indexOf(s)));
            return minIndexA - minIndexB;
        });
        
        return groups;
    }

    function renderApiResults(groups) {
        searchResults.innerHTML = '';
        
        if (!groups || groups.length === 0) {
            searchResults.innerHTML = '<div style="color:var(--text-secondary); text-align:center; padding: 2rem;">No results found</div>';
            return;
        }

        // groups already pre-processed by backend: [{ main, seasons: [{label, ...}] }]
        groups.forEach(g => {
            const anime = g.main;
            const el = document.createElement('div');
            el.className = 'api-result-item';
            
            const title = anime.title_english || anime.title;
            const year = anime.year || 'N/A';
            
            let html = `
                <img src="${anime.image}" alt="${title}" class="api-result-img" style="cursor:pointer">
                <div class="api-result-info">
                    <div class="api-result-title" style="cursor:pointer">${title}</div>
                    <div class="api-result-meta">${anime.type || 'TV'} • ${year} • ★ ${anime.score || 'N/A'}</div>
                    ${anime.genres && anime.genres.length > 0 ? `<div class="api-result-genres" style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.25rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${anime.genres.map(g => g.name || g).join(', ')}</div>` : ''}
            `;
            
            if (g.seasons.length > 1) {
                html += `<div class="api-result-seasons" style="margin-top: 0.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center;">`;
                html += `<div style="font-size:0.75rem; color:var(--text-secondary); width:100%; margin-bottom: 0.25rem;">Seasons:</div>`;
                g.seasons.forEach((season) => {
                    html += `<span class="season-pill" data-id="${season.mal_id}">${season.label}</span>`;
                });
                html += `</div>`;
            }
            
            html += `</div>`;
            el.innerHTML = html;
            
            const imgNode = el.querySelector('.api-result-img');
            const titleNode = el.querySelector('.api-result-title');
            
            imgNode.addEventListener('click', () => {
                openModalFromApi(anime);
                searchOverlay.classList.add('hidden');
            });
            titleNode.addEventListener('click', () => {
                openModalFromApi(anime);
                searchOverlay.classList.add('hidden');
            });

            const pills = el.querySelectorAll('.season-pill');
            pills.forEach((pill, idx) => {
                pill.addEventListener('click', (e) => {
                    e.stopPropagation();
                    openModalFromApi(g.seasons[idx]);
                    searchOverlay.classList.add('hidden');
                });
            });
            
            searchResults.appendChild(el);
        });
    }

    function openModalFromApi(anime) {
        currentAnime = {
            id: anime.mal_id,
            title: anime.title_english || anime.title,
            // Backend returns image/large_image; fall back gracefully
            image: anime.large_image || anime.image,
            score: anime.score || 'N/A',
            episodes: anime.episodes,
            status_api: anime.status,
            synopsis: anime.synopsis,
            popularity: anime.popularity,
            type: anime.type,
            duration: anime.duration,
            genres: anime.genres,
            studios: anime.studios,
            aired: anime.aired,
            producers: anime.producers,
            themes: anime.themes
        };
        populateAndShowModal();
    }
    
    function openModalFromWatchlist(item) {
        currentAnime = {...item};
        if (!item.genres || !item.duration || !item.aired) {
            document.getElementById('modalTitle').textContent = "Loading...";
            animeModal.classList.remove('hidden');
            fetch(`https://api.jikan.moe/v4/anime/${item.id}`)
                .then(res => res.json())
                .then(data => {
                    const anime = data.data;
                    currentAnime.popularity = anime.popularity;
                    currentAnime.type = anime.type;
                    currentAnime.duration = anime.duration;
                    currentAnime.genres = anime.genres;
                    currentAnime.studios = anime.studios;
                    currentAnime.aired = anime.aired?.string;
                    currentAnime.producers = anime.producers;
                    currentAnime.themes = anime.themes;
                    
                    item.popularity = anime.popularity;
                    item.type = anime.type;
                    item.duration = anime.duration;
                    item.genres = anime.genres;
                    item.studios = anime.studios;
                    item.aired = anime.aired?.string;
                    item.producers = anime.producers;
                    item.themes = anime.themes;
                    
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
            userRatingSelect.value = existingEntry.userRating || '';
            saveToListBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Update Watchlist';
        } else {
            statusSelect.value = 'plan_to_watch';
            episodesWatchedInput.value = 0;
            userRatingSelect.value = '';
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

        const seasonsContainer = document.getElementById('modalSeasonsContainer');
        const seasonsList = document.getElementById('modalSeasons');
        if (seasonsContainer && seasonsList) {
            seasonsContainer.classList.add('hidden');
            seasonsList.innerHTML = '<span style="color:#aaa; font-size:0.8rem;">Loading seasons...</span>';
            
            // Backend handles Jikan call + grouping — returns only seasons for this anime
            fetch(`/api/anime/${currentAnime.id}/seasons`)
                .then(res => res.json())
                .then(data => {
                    if (!currentAnime) return;
                    const seasons = data.data;
                    
                    if (seasons && seasons.length > 1) {
                        seasonsContainer.classList.remove('hidden');
                        seasonsList.innerHTML = '';
                        seasons.forEach(season => {
                            const label = season.label;
                            const existingEntry = watchlist.find(item => item.id === season.mal_id);
                            const isWatched = existingEntry && existingEntry.status === 'completed';
                            
                            const pill = document.createElement('span');
                            const isActive = season.mal_id === currentAnime.id;
                            pill.className = 'season-pill' + (isActive ? ' active' : '') + (isWatched ? ' watched' : '');
                            
                            pill.innerHTML = `
                                <i class="fa-regular ${isWatched ? 'fa-square-check' : 'fa-square'} season-checkbox"></i>
                                <span class="season-label">${label}</span>
                            `;
                            
                            const checkbox = pill.querySelector('.season-checkbox');
                            
                            checkbox.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                if (!currentUser) { showToast('Please login'); return; }
                                
                                const currentlyWatched = pill.classList.contains('watched');
                                checkbox.className = 'fa-solid fa-circle-notch fa-spin season-checkbox';
                                
                                if (currentlyWatched) {
                                    const { error } = await supabase.from('watchlist').delete().eq('user_id', currentUser.id).eq('anime_id', season.mal_id);
                                    if (!error) {
                                        watchlist = watchlist.filter(i => i.id !== season.mal_id);
                                        pill.classList.remove('watched');
                                        checkbox.className = 'fa-regular fa-square season-checkbox';
                                        if (season.mal_id === currentAnime.id) {
                                            statusSelect.value = 'plan_to_watch';
                                            saveToListBtn.innerHTML = '<i class="fa-solid fa-bookmark"></i> Add to Watchlist';
                                        }
                                        renderWatchlist();
                                    } else {
                                        checkbox.className = 'fa-regular fa-square-check season-checkbox';
                                        showToast('Failed to remove');
                                    }
                                } else {
                                    const dbEntry = {
                                        user_id: currentUser.id,
                                        anime_id: season.mal_id,
                                        title: season.title_english || season.title,
                                        image: season.large_image || season.image,
                                        score: season.score || 'N/A',
                                        episodes: season.episodes,
                                        status_api: season.status,
                                        synopsis: season.synopsis,
                                        popularity: season.popularity,
                                        type: season.type,
                                        duration: season.duration,
                                        status: 'completed',
                                        episodes_watched: season.episodes || 0,
                                        user_rating: userRatingSelect.value || '',
                                        genres: season.genres || []
                                    };
                                    const { error } = await supabase.from('watchlist').upsert(dbEntry, { onConflict: 'user_id, anime_id' });
                                    if (!error) {
                                        const frontendObj = {
                                            id: season.mal_id,
                                            title: dbEntry.title,
                                            image: dbEntry.image,
                                            score: dbEntry.score,
                                            episodes: dbEntry.episodes,
                                            status_api: dbEntry.status_api,
                                            synopsis: dbEntry.synopsis,
                                            popularity: dbEntry.popularity,
                                            type: dbEntry.type,
                                            duration: dbEntry.duration,
                                            status: 'completed',
                                            episodesWatched: dbEntry.episodes_watched,
                                            userRating: userRatingSelect.value || '',
                                            genres: season.genres || [],
                                            studios: season.studios || [],
                                            producers: season.producers || [],
                                            themes: season.themes || [],
                                            aired: season.aired || ''
                                        };
                                        watchlist = watchlist.filter(i => i.id !== season.mal_id);
                                        watchlist.unshift(frontendObj);
                                        
                                        pill.classList.add('watched');
                                        checkbox.className = 'fa-solid fa-square-check season-checkbox';
                                        if (season.mal_id === currentAnime.id) {
                                            statusSelect.value = 'completed';
                                            if(episodesWatchedInput) episodesWatchedInput.value = season.episodes || 0;
                                            statusSelect.dispatchEvent(new Event('change'));
                                            saveToListBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Update Watchlist';
                                        }
                                        renderWatchlist();
                                    } else {
                                        checkbox.className = 'fa-regular fa-square season-checkbox';
                                        showToast('Failed to add');
                                    }
                                }
                            });
                            
                            if (!isActive) {
                                pill.addEventListener('click', () => {
                                    openModalFromApi(season);
                                });
                            }
                            seasonsList.appendChild(pill);
                        });
                    } else {
                        seasonsContainer.classList.add('hidden');
                    }
                })
                .catch(err => {
                    console.error("Failed to load seasons", err);
                    seasonsContainer.classList.add('hidden');
                });
        }
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
        
        saveToListBtn.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Saving...';
        
        const status = statusSelect.value;
        const epsWatched = parseInt(episodesWatchedInput.value) || 0;
        const userRating = userRatingSelect.value;
        
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
        
        const { data, error } = await supabase
            .from('watchlist')
            .upsert(dbEntry, { onConflict: 'user_id, anime_id' });
            
        if (error) {
            console.error(error);
            showToast('Failed to save to cloud.');
            saveToListBtn.innerHTML = '<i class="fa-solid fa-pen"></i> Try Again';
            return;
        }

        // Propagate user rating to related seasons
        const relatedCompletedIds = watchlist.filter(i => 
            (isRelatedTitle(currentAnime.title, i.title) || isRelatedTitle(i.title, currentAnime.title)) 
            && i.status === 'completed' && i.id !== currentAnime.id
        ).map(i => i.id);
        
        if (relatedCompletedIds.length > 0) {
            await supabase.from('watchlist')
                .update({ user_rating: userRating })
                .in('anime_id', relatedCompletedIds)
                .eq('user_id', currentUser.id);
                
            watchlist.forEach(i => {
                if (relatedCompletedIds.includes(i.id)) {
                    i.userRating = userRating;
                }
            });
        }

        const existingIndex = watchlist.findIndex(item => item.id === currentAnime.id);
        const frontendItemObj = {
            id: currentAnime.id,
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
            episodesWatched: status === 'plan_to_watch' ? 0 : epsWatched,
            userRating: userRating,
            genres: currentAnime.genres || [],
            studios: currentAnime.studios || [],
            producers: currentAnime.producers || [],
            themes: currentAnime.themes || [],
            aired: currentAnime.aired || ''
        };
        
        if (existingIndex >= 0) {
            watchlist[existingIndex] = frontendItemObj;
            showToast('Item updated');
        } else {
            watchlist.unshift(frontendItemObj);
            showToast('Added to watchlist');
        }
        
        renderWatchlist();
        closeModal();
    }

    async function updateAnimeFromCard(id, actionStr) {
        const item = watchlist.find(i => i.id === id);
        if (!item || !currentUser) return;
        
        if (actionStr === 'remove') {
            if (confirm(`Remove ${item.title}?`)) {
                // Delete from DB
                const { error } = await supabase
                    .from('watchlist')
                    .delete()
                    .eq('user_id', currentUser.id)
                    .eq('anime_id', id);
                    
                if (!error) {
                    watchlist = watchlist.filter(i => i.id !== id);
                    renderWatchlist();
                    showToast('Removed from cloud');
                } else {
                    showToast('Failed to remove: ' + error.message);
                }
            }
        } 
        else if (actionStr === 'update' || actionStr === 'resume' || actionStr === 'start') {
            openModalFromWatchlist(item);
        }
        else if (actionStr === 'rewatch') {
            // Upsert new status
            const dbEntry = {
                user_id: currentUser.id,
                anime_id: item.id,
                title: item.title,
                status: 'plan_to_watch',
                episodes_watched: 0
            };
            const { error } = await supabase.from('watchlist').upsert(dbEntry, { onConflict: 'user_id, anime_id', ignoreDuplicates: false });
            
            if (!error) {
                item.status = 'plan_to_watch';
                item.episodesWatched = 0;
                renderWatchlist();
                showToast('Ready to rewatch');
            }
        }
    }

    // --- RENDERING ---

    function getCardStyles(status) {
        switch(status) {
            case 'completed': return { 
                badgeClass: 'badge-completed', badgeText: 'COMPLETED', 
                action1Icon: 'fa-rotate-right', action1Text: 'REWATCH', action1Id: 'rewatch'
            };
            case 'dropped': return { 
                badgeClass: 'badge-dropped', badgeText: 'DROPPED', 
                action1Icon: 'fa-rotate-right', action1Text: 'RESUME', action1Id: 'resume'
            };
            case 'plan_to_watch': 
            default: return { 
                badgeClass: 'badge-plan_to_watch', badgeText: 'PLAN TO WATCH', 
                action1Icon: 'fa-play', action1Text: 'START WATCHING', action1Id: 'start'
            };
        }
    }

    function renderWatchlist() {
        watchlistContainer.innerHTML = '';
        
        let filteredList = watchlist;
        
        if (currentFilter !== 'all') {
            filteredList = filteredList.filter(item => item.status === currentFilter);
        }
        
        if (searchQuery) {
            filteredList = filteredList.filter(item => item.title.toLowerCase().includes(searchQuery));
        }

        const groupedWatchlist = groupWatchlist(filteredList);
        
        if (groupedWatchlist.length === 0) {
            emptyState.classList.remove('hidden');
            loadMoreContainer.classList.add('hidden');
        } else {
            emptyState.classList.add('hidden');
            if (groupedWatchlist.length > 5) loadMoreContainer.classList.remove('hidden');
            
            groupedWatchlist.forEach(group => {
                const anime = group.mainAnime;
                const styles = getCardStyles(anime.status);
                const totalEps = anime.episodes || '?';
                const epsWatched = anime.episodesWatched || 0;
                
                let scoreFormat = anime.score;
                if(scoreFormat && scoreFormat !== 'N/A') {
                    scoreFormat = parseFloat(scoreFormat).toFixed(1);
                }
                
                const card = document.createElement('div');
                card.className = `anime-card status-${anime.status}`;
                
                let html = `
                    <img src="${anime.image}" alt="Cover" class="card-image">
                    <div class="card-content">
                        <div>
                            <div class="card-header">
                                <h3 class="card-title">${anime.title}</h3>
                                <div class="card-score"><i class="fa-solid fa-star"></i> ${scoreFormat}</div>
                            </div>
                            <div class="card-meta">
                                <span class="status-badge ${styles.badgeClass}">${styles.badgeText}</span>
                                <span class="episode-progress">Ep ${epsWatched} / ${totalEps}</span>
                            </div>
                            ${anime.genres && anime.genres.length > 0 ? `<div class="card-genres" style="font-size:0.75rem; color:var(--text-secondary); margin-top:0.5rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${typeof anime.genres[0] === 'object' ? anime.genres.map(g => g.name || g).join(', ') : anime.genres.join(', ')}</div>` : ''}
                        `;
                        
                html += `
                        </div>
                        
                        <div class="card-actions">
                            <button class="card-action-btn action1" data-id="${anime.id}" data-action="${styles.action1Id}">
                                <i class="fa-solid ${styles.action1Icon}"></i> ${styles.action1Text}
                            </button>
                            ${anime.status !== 'plan_to_watch' ? `
                            <button class="card-action-btn action2" data-id="${anime.id}" data-action="remove">
                                <i class="fa-solid fa-xmark"></i> REMOVE
                            </button>
                            ` : `<button class="card-action-btn action2" data-id="${anime.id}" data-action="remove" style="margin-left: auto"><i class="fa-solid fa-xmark"></i></button>`}
                        </div>
                    </div>
                `;
                card.innerHTML = html;
                
                const btn1 = card.querySelector('.action1');
                const btn2 = card.querySelector('.action2');
                const imgNode = card.querySelector('.card-image');
                
                if (btn1) btn1.addEventListener('click', (e) => updateAnimeFromCard(anime.id, btn1.dataset.action));
                if (btn2) btn2.addEventListener('click', (e) => updateAnimeFromCard(anime.id, btn2.dataset.action));
                if (imgNode) {
                    imgNode.style.cursor = 'pointer';
                    imgNode.addEventListener('click', () => {
                        openModalFromWatchlist(anime);
                    });
                }
                
                watchlistContainer.appendChild(card);
            });
        }
    }

    function showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'toast';
        toast.innerHTML = `<i class="fa-solid fa-check" style="color:var(--accent-red)"></i> <span>${message}</span>`;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 300);
        }, 2000);
    }

    // Call init on load
    initAuth();
});
