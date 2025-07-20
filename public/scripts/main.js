// ========================================================================
//              MAIN.JS - VERSIONE FINALE E COMPLETA
//                  Include tutte le funzionalità
// ========================================================================

// --- 1. CONFIGURAZIONE SUPABASE ---
const SUPABASE_URL = "https://lycrgzptkdkksukcwrld.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5Y3JnenB0a2Rra3N1a2N3cmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODQyMzAsImV4cCI6MjA2ODM2MDIzMH0.ZJGOXAMC3hKKrnwXHKEa2_Eh7ZpOKeLYvYlYneBiEfk";

let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (error) {
    console.error("Errore durante l'inizializzazione di Supabase:", error);
    alert("Impossibile connettersi al backend. Controlla la configurazione.");
}

// --- 2. GESTIONE PWA (SERVICE WORKER) ---
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => console.log('Service Worker registrato con successo.'))
      .catch(error => console.log('Registrazione Service Worker fallita:', error));
  });
}

// --- 3. UTILITIES ---
const getCurrentPath = () => window.location.pathname;
const isAppPage = () => getCurrentPath().startsWith('/app/');

// --- 4. GESTIONE AUTENTICAZIONE ---
const checkUserSession = async () => {
    try {
        const { data: { session } } = await supabase.auth.getSession();
        return session;
    } catch (error) {
        console.error('Errore controllo sessione:', error);
        return null;
    }
};

const getUserRoles = async (session) => {
    if (!session) return [];
    try {
        const { data: profile, error } = await supabase.from('profiles').select('ruoli').eq('id', session.user.id).single();
        if (error) throw error;
        return profile?.ruoli || [];
    } catch (error) {
        console.error('Errore nel recuperare i ruoli del profilo:', error);
        return [];
    }
};

const protectPage = async () => {
    const session = await checkUserSession();
    const currentPath = getCurrentPath();

    if (!session && isAppPage()) {
        window.location.replace('/public/login.html');
        return;
    }

    if (session) {
        const roles = await getUserRoles(session);
        if (currentPath.endsWith('/admin.html') && !roles.includes('ADMIN')) {
            window.location.replace('/app/home.html');
        }
        if (currentPath.endsWith('/dirigente-dashboard.html') && !roles.includes('DIRIGENTE') && !roles.includes('ADMIN')) {
            window.location.replace('/app/home.html');
        }
    }
};


// --- 5. GESTIONE FEEDBACK UTENTE ---
const showFeedback = (message, type = 'error', containerId = 'feedback') => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const colors = {
        error: 'bg-red-100 border-red-400 text-red-700',
        success: 'bg-green-100 border-green-400 text-green-700'
    };
    container.innerHTML = `<div class="p-4 mb-4 text-sm rounded-lg ${colors[type]}" role="alert">${message}</div>`;
    container.classList.remove('hidden');
    setTimeout(() => container.classList.add('hidden'), 5000);
};

// --- 6. LOGICHE SPECIFICHE PER PAGINA ---

/** PAGINA LOGIN **/
const initLoginPage = () => {
    const loginForm = document.getElementById('loginForm');
    if (!loginForm) return;

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const { email, password } = e.target.elements;
        const submitButton = loginForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Accesso in corso...';

        try {
            const { data: { session }, error } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value });
            if (error) throw error;
            if (!session) throw new Error('Sessione non trovata dopo il login.');

            const roles = await getUserRoles(session);
            if (roles.includes('ADMIN')) window.location.replace('/app/admin.html');
            else if (roles.includes('DIRIGENTE')) window.location.replace('/app/dirigente-dashboard.html');
            else window.location.replace('/app/home.html');

        } catch (error) {
            showFeedback(`Errore: ${error.message}`, 'error', 'loginFeedback');
            submitButton.disabled = false;
            submitButton.textContent = 'Accedi';
        }
    });
};

/** PAGINA REGISTER **/
const initRegisterPage = () => {
    const registerForm = document.getElementById('registerForm');
    const registerFeedback = document.getElementById('registerFeedback');

    if (!registerForm) return;

    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const { nome, cognome, telefono, email, password, terms } = e.target.elements;
        const submitButton = registerForm.querySelector('button[type="submit"]');

        if (!terms.checked) {
            showFeedback('Devi accettare i termini e le condizioni sulla privacy.', 'error', 'registerFeedback');
            return;
        }

        submitButton.disabled = true;
        submitButton.textContent = 'Registrazione in corso...';

        try {
            const { data: userAuth, error: authError } = await supabase.auth.signUp({
                email: email.value,
                password: password.value,
                options: {
                    data: {
                        nome: nome.value,
                        cognome: cognome.value,
                        telefono: telefono.value
                    }
                }
            });

            if (authError) throw authError;

            // Nota: La creazione del profilo nella tabella 'profiles' con nome, cognome, telefono
            // dovrebbe idealmente essere gestita da un trigger su Supabase (es. su auth.users insert).
            // Se non hai un trigger, questi dati non verranno automaticamente copiati nella tabella 'profiles'.
            // L'utente è comunque creato in auth.users.

            showFeedback('Registrazione avvenuta con successo! Controlla la tua email per la conferma.', 'success', 'registerFeedback');
            setTimeout(() => {
                window.location.replace('/public/login.html');
            }, 3000);

        } catch (error) {
            console.error('Errore durante la registrazione:', error);
            let errorMessage = 'Si è verificato un errore durante la registrazione.';
            if (error.message.includes('User already registered')) {
                errorMessage = 'Questa email è già registrata. Prova ad accedere o recuperare la password.';
            } else {
                errorMessage = `Errore: ${error.message}`;
            }
            showFeedback(errorMessage, 'error', 'registerFeedback');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Registrati';
        }
    });
};


/** PAGINA HOME **/
const initHomePage = async () => {
    const session = await checkUserSession();
    if (!session) return;

    try {
        const { data: profile } = await supabase.from('profiles').select('nome').eq('id', session.user.id).single();
        if (profile && profile.nome) {
            const welcomeUser = document.getElementById('welcome-user');
            if (welcomeUser) welcomeUser.textContent = `Benvenuto, ${profile.nome}!`;
        }
    } catch (error) { console.error('Errore nel caricare il nome:', error); }

    const roles = await getUserRoles(session);
    const managementTools = document.getElementById('management-tools');
    const adminLink = document.getElementById('admin-link');
    const dirigenteLink = document.getElementById('dirigente-link');

    if (roles.includes('ADMIN')) {
        if(managementTools) managementTools.classList.remove('hidden');
        if(adminLink) adminLink.classList.remove('hidden');
        if(dirigenteLink) dirigenteLink.classList.remove('hidden');
    } else if (roles.includes('DIRIGENTE')) {
        if(managementTools) managementTools.classList.remove('hidden');
        if(dirigenteLink) dirigenteLink.classList.remove('hidden');
    }

    const newsContainer = document.getElementById('news-container');
    if (newsContainer) {
        try {
            const { data: news, error } = await supabase.from('notizie').select('*').order('data_pubblicazione', { ascending: false }).limit(3);
            if (error) throw error;
            if (news && news.length > 0) {
                newsContainer.innerHTML = news.map(item => `
                    <div class="bg-white p-4 rounded-xl shadow-md border-l-4 border-primary transition-transform hover:translate-x-1 hover:shadow-lg">
                        <h4 class="font-bold text-blue-900">${item.titolo}</h4>
                        <p class="text-gray-700 text-sm mt-1">${item.contenuto || ''}</p>
                        <p class="text-gray-500 text-xs mt-2">${new Date(item.data_pubblicazione).toLocaleDateString('it-IT')}</p>
                    </div>
                `).join('');
            } else { newsContainer.innerHTML = '<p class="text-gray-500">Nessuna notizia recente.</p>'; }
        } catch (error) { newsContainer.innerHTML = `<p class="text-red-500">Impossibile caricare le notizie: ${error.message}</p>`; }
    }

    const convenzioniContainer = document.getElementById('convenzioni-container');
    if (convenzioniContainer) {
        try {
            const { data: convenzioni, error } = await supabase.from('convenzioni').select('*').limit(4);
            if (error) throw error;
            if (convenzioni && convenzioni.length > 0) {
                convenzioniContainer.innerHTML = convenzioni.map(item => `
                    <div class="bg-gray-50 p-3 rounded-xl text-center shadow-sm transition-transform hover:-translate-y-1 hover:shadow-md">
                        ${item.logo_url ?
                            `<img src="${item.logo_url}" alt="${item.nome_partner}" class="h-10 w-10 mx-auto mb-2 object-contain">` :
                            `<div class="h-10 w-10 mx-auto mb-2 bg-gray-200 rounded-lg flex items-center justify-center text-xl">${item.icona || '🤝'}</div>`
                        }
                        <span class="font-semibold text-gray-800 text-sm block">${item.nome_partner}</span>
                        ${item.sconto_percentuale ? `<span class="text-xs text-green-600 font-medium">${item.sconto_percentuale}% OFF</span>` : ''}
                    </div>
                `).join('');
            } else { convenzioniContainer.innerHTML = '<p class="text-gray-500 col-span-2">Nessuna convenzione.</p>'; }
        } catch (error) { convenzioniContainer.innerHTML = `<p class="text-red-500 col-span-full">Impossibile caricare: ${error.message}</p>`; }
    }
};

/** PAGINA DIRIGENTI **/
const initDirigentiPage = async () => {
    const list = document.getElementById('dirigenti-list');
    if (!list) return;
    try {
        const { data: dirigenti, error } = await supabase
            .from('organico_dirigentisindacali')
            .select('*')
            .order('id');

        if (error) throw error;

        if (dirigenti && dirigenti.length > 0) {
            list.innerHTML = dirigenti.map(item => {
                const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(item.nome_cognome)}&background=random&color=fff`;
                const avatarUrl = item.foto_url || fallbackAvatar;

                return `
                <div class="bg-white rounded-lg shadow p-4 flex items-center space-x-4">
                    <img src="${avatarUrl}" alt="${item.nome_cognome}" class="w-16 h-16 rounded-full object-cover">
                    <div>
                        <h3 class="font-bold text-lg text-textDark">${item.nome_cognome}</h3>
                        <p class="text-sm text-primary font-semibold">${item.ruolo || ''}</p>
                        <a href="tel:${item.telefono}" class="text-sm text-gray-600 hover:underline">${item.telefono || ''}</a>
                    </div>
                </div>
            `}).join('');
        } else {
            list.innerHTML = '<p class="text-gray-500">La lista dei dirigenti non è disponibile.</p>';
        }
    } catch (error) {
        list.innerHTML = `<p class="text-red-500">Impossibile caricare i dirigenti: ${error.message}</p>`;
    }
};

/** PAGINA TESSERA **/
const loadTesseraData = async () => {
    const session = await checkUserSession();
    if (!session) return;
    try {
        const { data: profile } = await supabase.from('profiles').select('nome, cognome').eq('id', session.user.id).single();
        const { data: tessera } = await supabase.from('tessere').select('numero_tessera, data_scadenza').eq('user_id', session.user.id).single();

        document.getElementById('tessera-nome').textContent = `${profile.nome || ''} ${profile.cognome || ''}`;
        if (tessera) {
            document.getElementById('tessera-numero').textContent = tessera.numero_tessera;
            document.getElementById('tessera-scadenza').textContent = new Date(tessera.data_scadenza).toLocaleDateString('it-IT');
            document.getElementById('tessera-qrcode').src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(tessera.numero_tessera)}`;
        } else {
            document.getElementById('tessera-numero').textContent = 'N/A';
            document.getElementById('tessera-scadenza').textContent = 'N/A';
        }
    } catch (error) {
        document.getElementById('tessera-nome').textContent = 'Errore nel caricamento dei dati.';
        console.error("Errore caricamento dati tessera:", error);
    }
};

/** PAGINA PROFILO **/
const loadProfileData = async () => {
    const session = await checkUserSession();
    if (!session) return;
    const form = document.getElementById('profileForm');
    if (!form) return;

    try {
        const { data: profile, error } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        if (error) throw error;
        form.email.value = session.user.email;
        form.nome.value = profile.nome || '';
        form.cognome.value = profile.cognome || '';
        form.telefono.value = profile.telefono || '';
    } catch (error) {
        showFeedback('Impossibile caricare i dati del profilo.', 'error', 'profileFeedback');
    }

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitButton = form.querySelector('button[type="submit"]');
        submitButton.disabled = true;
        submitButton.textContent = 'Salvataggio...';
        const updates = { id: session.user.id, nome: form.nome.value, cognome: form.cognome.value, telefono: form.telefono.value, updated_at: new Date() };
        try {
            const { error: updateError } = await supabase.from('profiles').upsert(updates);
            if (updateError) throw updateError;
            showFeedback('Profilo aggiornato con successo!', 'success', 'profileFeedback');
        } catch (error) {
            showFeedback(`Errore aggiornamento: ${error.message}`, 'error', 'profileFeedback');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Salva Modifiche';
        }
    });
};

/** PAGINA DI LOGOUT **/
const initLogoutPage = async () => {
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error('Errore durante il logout:', error);
    } finally {
        setTimeout(() => { window.location.replace('/public/login.html'); }, 1000);
    }
};

// --- 7. LOGICA DASHBOARD DIRIGENTE ---

function showDashboardFeedback(message, type = 'success') {
    const feedback = document.getElementById('dashboardFeedback');
    if (feedback) showFeedback(message, type, 'dashboardFeedback');
}

// --- Funzioni Helper per icone ---
function getPriorityIcon(priorita) {
    const icons = { 'normale': '📝', 'importante': '⚠️', 'urgente': '🚨' };
    return icons[priorita] || '📝';
}

function getCategoryIcon(categoria) {
    const icons = { 'assicurazioni': '🛡️', 'automotive': '🚗', 'tecnologia': '💻', 'viaggi': '✈️', 'wellness': '💆', 'shopping': '🛍️', 'servizi': '🔧', 'altro': '📦' };
    return icons[categoria] || '📦';
}

// --- Funzioni Gestione Notizie ---
async function quickAddNotizia(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const submitButton = document.getElementById('notiziaSubmitButton');
    const notiziaId = formData.get('notizia_id');

    submitButton.disabled = true;
    submitButton.textContent = notiziaId ? 'Salvataggio...' : 'Pubblicando...';

    try {
        let imageUrl = null;
        const imageFile = form.querySelector('input[name="immagine_file"]').files[0];

        if (imageFile) {
            const filePath = `public/${Date.now()}_${imageFile.name}`;
            const { error: uploadError } = await supabase.storage.from('immagini_notizie').upload(filePath, imageFile);
            if (uploadError) throw uploadError;
            const { data: publicUrlData } = supabase.storage.from('immagini_notizie').getPublicUrl(filePath);
            imageUrl = publicUrlData.publicUrl;
        }

        const notiziaData = {
            titolo: formData.get('titolo'),
            contenuto: formData.get('contenuto'),
            priorita: formData.get('priorita'),
            icona: formData.get('icona'),
            ...(imageUrl && { immagine_url: imageUrl }),
        };

        const { error } = notiziaId
            ? await supabase.from('notizie').update(notiziaData).eq('id', notiziaId)
            : await supabase.from('notizie').insert([notiziaData]);

        if (error) throw error;

        showDashboardFeedback(`✅ Notizia ${notiziaId ? 'aggiornata' : 'pubblicata'}!`);
        resetNotiziaForm();
        loadQuickNotizie();

    } catch (error) {
        showDashboardFeedback(`❌ Errore: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
    }
}

async function loadQuickNotizie() {
    const list = document.getElementById('quickNotizieList');
    if (!list) return;
    try {
        const { data: notizie, error } = await supabase.from('notizie').select('*').order('data_pubblicazione', { ascending: false }).limit(5);
        if (error) throw error;

        if (notizie && notizie.length > 0) {
            list.innerHTML = notizie.map(notizia => `
                <div class="bg-white/10 p-3 rounded-lg flex justify-between items-center gap-2">
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-white truncate">${notizia.titolo}</p>
                        <p class="text-white/60 text-xs">${new Date(notizia.data_pubblicazione).toLocaleDateString('it-IT')}</p>
                    </div>
                    <div class="flex-shrink-0 flex gap-2">
                        <button onclick='editQuickNotizia(${JSON.stringify(notizia)})' class="p-2 bg-accent/50 hover:bg-accent rounded-full text-white transition-colors">✏️</button>
                        <button onclick="deleteQuickNotizia('${notizia.id}')" class="p-2 bg-danger/50 hover:bg-danger rounded-full text-white transition-colors">🗑️</button>
                    </div>
                </div>
            `).join('');
        } else {
            list.innerHTML = '<p class="text-white/70 text-sm text-center py-4">Nessuna notizia pubblicata.</p>';
        }
    } catch (error) {
        list.innerHTML = `<p class="text-red-300 text-xs">Errore caricamento: ${error.message}</p>`;
    }
}

function editQuickNotizia(notizia) {
    document.getElementById('notizia_id').value = notizia.id;
    document.querySelector('#quickNotiziaForm [name="titolo"]').value = notizia.titolo;
    document.querySelector('#quickNotiziaForm [name="contenuto"]').value = notizia.contenuto;
    document.querySelector('#quickNotiziaForm [name="priorita"]').value = notizia.priorita;
    document.querySelector('#quickNotiziaForm [name="icona"]').value = notizia.icona;

    document.getElementById('notiziaSubmitButton').textContent = '💾 Salva Modifiche';
    document.getElementById('cancelEditButton').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetNotiziaForm() {
    const form = document.getElementById('quickNotiziaForm');
    if(form) form.reset();
    document.getElementById('notizia_id').value = '';
    document.getElementById('notiziaSubmitButton').textContent = '📤 Pubblica Notizia';
    document.getElementById('cancelEditButton').classList.add('hidden');
}

async function deleteQuickNotizia(id) {
    if (!confirm('Sei sicuro di voler eliminare questa notizia?')) return;
    try {
        const { error } = await supabase.from('notizie').delete().eq('id', id);
        if (error) throw error;
        showDashboardFeedback('✅ Notizia eliminata.');
        loadQuickNotizie();
    } catch (error) {
        showDashboardFeedback(`❌ Errore eliminazione: ${error.message}`, 'error');
    }
}

// --- Funzioni Gestione Convenzioni (CORRETTE E COMPLETE) ---
async function quickAddConvenzione(event) {
    event.preventDefault();
    const form = event.target;
    const formData = new FormData(form);
    const submitButton = form.querySelector('button[type="submit"]');

    submitButton.disabled = true;
    submitButton.textContent = 'Aggiungendo...';

    try {
        const convenzioneData = {
            nome_partner: formData.get('nome_partner'),
            descrizione: formData.get('descrizione') || '',
            categoria: formData.get('categoria') || 'altro',
            sconto_percentuale: formData.get('sconto_percentuale') ? parseInt(formData.get('sconto_percentuale')) : null,
            link_esterno: formData.get('link_esterno') || '',
            logo_url: formData.get('logo_url') || '',
            icona: getCategoryIcon(formData.get('categoria') || 'altro'),
        };

        const { error } = await supabase.from('convenzioni').insert([convenzioneData]);
        if (error) throw error;

        showDashboardFeedback('✅ Convenzione aggiunta con successo!');
        form.reset();
        loadQuickConvenzioni();
    } catch (error) {
        showDashboardFeedback(`❌ Errore: ${error.message}`, 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = '➕ Aggiungi Convenzione';
    }
}

async function loadQuickConvenzioni() {
    const list = document.getElementById('quickConvenzioniList');
    if (!list) return;
    try {
        const { data: convenzioni, error } = await supabase.from('convenzioni').select('*').order('created_at', { ascending: false }).limit(5);
        if (error) throw error;

        if (convenzioni && convenzioni.length > 0) {
            list.innerHTML = convenzioni.map(convenzione => `
                <div class="bg-white/10 p-3 rounded-lg flex justify-between items-center gap-2">
                    <div class="flex-1 min-w-0">
                        <p class="font-semibold text-white truncate">${convenzione.nome_partner}</p>
                        <p class="text-white/60 text-xs">${convenzione.categoria}</p>
                    </div>
                    <div class="flex-shrink-0">
                        <button onclick="deleteQuickConvenzione('${convenzione.id}')" class="p-2 bg-danger/50 hover:bg-danger rounded-full text-white transition-colors">🗑️</button>
                    </div>
                </div>
            `).join('');
        } else {
            list.innerHTML = '<p class="text-white/70 text-sm text-center py-4">Nessuna convenzione aggiunta.</p>';
        }
    } catch (error) {
        list.innerHTML = `<p class="text-red-300 text-xs">Errore caricamento: ${error.message}</p>`;
    }
}

async function deleteQuickConvenzione(id) {
    if (!confirm('Sei sicuro di voler eliminare questa convenzione?')) return;
    try {
        const { error } = await supabase.from('convenzioni').delete().eq('id', id);
        if (error) throw error;
        showDashboardFeedback('✅ Convenzione eliminata.');
        loadQuickConvenzioni();
    } catch (error) {
        showDashboardFeedback(`❌ Errore eliminazione: ${error.message}`, 'error');
    }
}

/** Inizializza la pagina della dashboard del dirigente. */
const initDirigenteDashboardPage = () => {
    const notiziaForm = document.getElementById('quickNotiziaForm');
    if (notiziaForm) {
        notiziaForm.addEventListener('submit', quickAddNotizia);
        loadQuickNotizie();
    }

    const convenzioneForm = document.getElementById('quickConvenzioneForm');
    if (convenzioneForm) {
        convenzioneForm.addEventListener('submit', quickAddConvenzione);
        loadQuickConvenzioni();
    }
};

// --- 8. ROUTER E INIZIALIZZAZIONE PRINCIPALE ---
document.addEventListener('DOMContentLoaded', async () => {
    await protectPage();

    const path = getCurrentPath();
    console.log('Pagina corrente:', path);

    if (path.endsWith('/home.html') || path === '/app/' || path === '/') initHomePage();
    else if (path.endsWith('/login.html')) initLoginPage();
    else if (path.endsWith('/register.html')) initRegisterPage(); // <--- AGGIUNTA QUI
    else if (path.endsWith('/logout.html')) initLogoutPage();
    else if (path.endsWith('/dirigenti.html')) initDirigentiPage();
    else if (path.endsWith('/tessera.html')) loadTesseraData();
    else if (path.endsWith('/profilo.html')) loadProfileData();
    else if (path.endsWith('/dirigente-dashboard.html')) initDirigenteDashboardPage();
    // Aggiungi qui gli "else if" per le altre pagine (admin, etc.)
});

// --- 9. ESPORTAZIONI GLOBALI ---
window.editQuickNotizia = editQuickNotizia;
window.deleteQuickNotizia = deleteQuickNotizia;
window.resetNotiziaForm = resetNotiziaForm;
window.deleteQuickConvenzione = deleteQuickConvenzione;