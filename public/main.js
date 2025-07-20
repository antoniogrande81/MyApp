// ========================================================================
//              MAIN.JS - VERSIONE FINALE E COMPLETA
//                  Include tutte le funzionalità + Fix Tailwind
// ========================================================================

// ========================================================================
//                    FIX WARNING TAILWIND - PRIMA DI TUTTO
// ========================================================================

// Nascondi warning Tailwind CSS in produzione
(function() {
    'use strict';
    
    // 1. Intercetta e blocca il warning nella console
    const originalWarn = console.warn;
    console.warn = function(...args) {
        // Blocca specificamente il warning di Tailwind
        const message = args.join(' ');
        if (typeof message === 'string' && 
            (message.includes('cdn.tailwindcss.com') || 
             message.includes('should not be used in production') ||
             message.includes('tailwindcss.com'))) {
            return; // Non mostra il warning
        }
        // Per tutti gli altri warning, comportamento normale
        originalWarn.apply(console, args);
    };
    
    // 2. Rimuovi eventuali elementi di warning visivi dopo il caricamento DOM
    document.addEventListener('DOMContentLoaded', function() {
        // Rimuove warning banner di sviluppo
        const devHints = document.querySelectorAll('[data-dev-hint], [data-tailwind-warning], .tailwind-warning');
        devHints.forEach(hint => hint.remove());
        
        // Nasconde eventuali div di warning con position fixed
        const fixedDivs = document.querySelectorAll('div[style*="position: fixed"][style*="top: 0"]');
        fixedDivs.forEach(div => {
            if (div.textContent && div.textContent.includes('tailwind')) {
                div.style.display = 'none';
            }
        });
        
        console.log('✅ Tailwind warning fix applicato');
    });
    
    // 3. Interceptor aggiuntivo per eventuali warning asincroni
    setTimeout(() => {
        const allDivs = document.querySelectorAll('div');
        allDivs.forEach(div => {
            if (div.textContent && 
                (div.textContent.includes('cdn.tailwindcss.com') || 
                 div.textContent.includes('should not be used in production'))) {
                div.style.display = 'none';
                div.remove();
            }
        });
    }, 2000);
    
})();

// ========================================================================
//                    CONFIGURAZIONE SUPABASE
// ========================================================================

const SUPABASE_URL = "https://lycrgzptkdkksukcwrld.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx5Y3JnenB0a2Rra3N1a2N3cmxkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI3ODQyMzAsImV4cCI6MjA2ODM2MDIzMH0.ZJGOXAMC3hKKrnwXHKEa2_Eh7ZpOKeLYvYlYneBiEfk";

let supabase;
try {
    supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('✅ Supabase inizializzato correttamente');
} catch (error) {
    console.error("Errore durante l'inizializzazione di Supabase:", error);
    alert("Impossibile connettersi al backend. Controlla la configurazione.");
}

// ========================================================================
//                    GESTIONE PWA (SERVICE WORKER)
// ========================================================================

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => console.log('✅ Service Worker registrato con successo.'))
      .catch(error => console.log('❌ Registrazione Service Worker fallita:', error));
  });
}

// ========================================================================
//                    UTILITIES
// ========================================================================

const getCurrentPath = () => window.location.pathname;
const isAppPage = () => getCurrentPath().startsWith('/app/');

// ========================================================================
//                    GESTIONE AUTENTICAZIONE
// ========================================================================

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

// ========================================================================
//                    GESTIONE FEEDBACK UTENTE
// ========================================================================

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

// ========================================================================
//                    FIX VISIBILITÀ ELEMENTI UI
// ========================================================================

// Funzione per assicurare che tutti gli elementi siano visibili
const ensureElementsVisible = () => {
    // Fix per bottoni e elementi nascosti
    const hiddenElements = document.querySelectorAll('[style*="display: none"], [style*="visibility: hidden"], [style*="opacity: 0"]');
    hiddenElements.forEach(element => {
        // Se l'elemento non dovrebbe essere nascosto intenzionalmente
        if (!element.classList.contains('hidden') && 
            !element.classList.contains('invisible') && 
            !element.hasAttribute('data-hidden')) {
            element.style.display = '';
            element.style.visibility = 'visible';
            element.style.opacity = '1';
        }
    });
    
    // Fix specifico per elementi di navigazione
    const navItems = document.querySelectorAll('.nav-item, .footer-nav-item');
    navItems.forEach(item => {
        item.style.display = 'flex';
        item.style.visibility = 'visible';
        item.style.opacity = '1';
        
        // Fix per icone e testi interni
        const children = item.querySelectorAll('span, i, svg');
        children.forEach(child => {
            child.style.display = 'block';
            child.style.visibility = 'visible';
            child.style.opacity = '1';
        });
    });
    
    // Fix per bottoni principali
    const buttons = document.querySelectorAll('button, .btn, a[class*="bg-"]');
    buttons.forEach(button => {
        if (!button.classList.contains('hidden')) {
            button.style.display = '';
            button.style.visibility = 'visible';
            button.style.opacity = '1';
        }
    });
};

// ========================================================================
//                    PAGINA LOGIN
// ========================================================================

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

// ========================================================================
//                    PAGINA REGISTER
// ========================================================================

const initRegisterPage = () => {
    const registerForm = document.getElementById('registerForm');
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

// ========================================================================
//                    PAGINA HOME
// ========================================================================

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

// ========================================================================
//                    PAGINA DIRIGENTI
// ========================================================================

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

// ========================================================================
//                    PAGINA TESSERA
// ========================================================================

const loadTesseraData = async () => {
    const session = await checkUserSession();
    if (!session) return;
    try {
        const { data: profile } = await supabase.from('profiles').select('nome, cognome').eq('id', session.user.id).single();
        const { data: tessera } = await supabase.from('tessere').select('numero_tessera, data_scadenza').eq('user_id', session.user.id).single();

        const nomeElement = document.getElementById('tessera-nome');
        const numeroElement = document.getElementById('tessera-numero');
        const scadenzaElement = document.getElementById('tessera-scadenza');
        const qrcodeElement = document.getElementById('tessera-qrcode');

        if (nomeElement) {
            nomeElement.textContent = `${profile?.nome || ''} ${profile?.cognome || ''}`.trim() || 'Nome non disponibile';
        }
        if (numeroElement) {
            numeroElement.textContent = tessera?.numero_tessera || 'N/A';
        }
        if (scadenzaElement) {
            scadenzaElement.textContent = tessera?.data_scadenza ? new Date(tessera.data_scadenza).toLocaleDateString('it-IT') : 'N/A';
        }
        if (qrcodeElement && tessera?.numero_tessera) {
            qrcodeElement.src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(tessera.numero_tessera)}`;
            qrcodeElement.alt = `QR Code tessera ${tessera.numero_tessera}`;
        }
    } catch (error) {
        const nomeElement = document.getElementById('tessera-nome');
        if (nomeElement) {
            nomeElement.textContent = 'Errore nel caricamento dei dati.';
        }
        console.error("Errore caricamento dati tessera:", error);
    }
};

// ========================================================================
//                    PAGINA PROFILO
// ========================================================================

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

// ========================================================================
//                    PAGINA DI LOGOUT
// ========================================================================

const initLogoutPage = async () => {
    try {
        await supabase.auth.signOut();
    } catch (error) {
        console.error('Errore durante il logout:', error);
    } finally {
        setTimeout(() => { window.location.replace('/public/login.html'); }, 1000);
    }
};

// ========================================================================
//                    LOGICA DASHBOARD DIRIGENTE
// ========================================================================

function showDashboardFeedback(message, type = 'success') {
    const feedback = document.getElementById('dashboardFeedback');
    if (feedback) showFeedback(message, type, 'dashboardFeedback');
}

// Funzioni Helper per icone
function getPriorityIcon(priorita) {
    const icons = { 'normale': '📝', 'importante': '⚠️', 'urgente': '🚨' };
    return icons[priorita] || '📝';
}

function getCategoryIcon(categoria) {
    const icons = { 'assicurazioni': '🛡️', 'automotive': '🚗', 'tecnologia': '💻', 'viaggi': '✈️', 'wellness': '💆', 'shopping': '🛍️', 'servizi': '🔧', 'altro': '📦' };
    return icons[categoria] || '📦';
}

// Funzioni Gestione Notizie
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

// Funzioni Gestione Convenzioni
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

// Inizializza la pagina della dashboard del dirigente
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

// ========================================================================
//                    GESTIONE PAGINA TUTTE LE CONVENZIONI
// ========================================================================

const initTutteConvenzioniPage = async () => {
    const convenzioniGrid = document.getElementById('convenzioni-grid');
    if (!convenzioniGrid) return;

    try {
        const { data: convenzioni, error } = await supabase
            .from('convenzioni')
            .select('*')
            .order('nome_partner');

        if (error) throw error;

        if (convenzioni && convenzioni.length > 0) {
            convenzioniGrid.innerHTML = convenzioni.map(item => `
                <div class="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                    <div class="p-4">
                        ${item.logo_url ?
                            `<img src="${item.logo_url}" alt="${item.nome_partner}" class="h-16 w-full object-contain mb-4">` :
                            `<div class="h-16 w-full bg-gray-200 rounded-lg flex items-center justify-center text-3xl mb-4">${item.icona || '🤝'}</div>`
                        }
                        <h3 class="font-bold text-lg text-gray-800 mb-2">${item.nome_partner}</h3>
                        <p class="text-gray-600 text-sm mb-3">${item.descrizione || 'Descrizione non disponibile'}</p>
                        ${item.sconto_percentuale ? 
                            `<div class="bg-green-100 text-green-800 text-sm font-semibold px-3 py-1 rounded-full inline-block mb-3">
                                ${item.sconto_percentuale}% di sconto
                            </div>` : ''
                        }
                        <div class="text-xs text-gray-500 uppercase tracking-wide mb-3">${item.categoria}</div>
                        ${item.link_esterno ? 
                            `<a href="${item.link_esterno}" target="_blank" rel="noopener noreferrer" class="w-full bg-blue-600 text-white text-center py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors inline-block">
                                Scopri di più
                            </a>` : 
                            `<div class="w-full bg-gray-300 text-gray-500 text-center py-2 px-4 rounded-lg">
                                Informazioni in arrivo
                            </div>`
                        }
                    </div>
                </div>
            `).join('');
        } else {
            convenzioniGrid.innerHTML = '<p class="text-gray-500 col-span-full text-center py-8">Nessuna convenzione disponibile al momento.</p>';
        }
    } catch (error) {
        convenzioniGrid.innerHTML = `<p class="text-red-500 col-span-full text-center py-8">Errore nel caricamento delle convenzioni: ${error.message}</p>`;
    }
};

// ========================================================================
//                    ROUTER E INIZIALIZZAZIONE PRINCIPALE
// ========================================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('🚀 Inizializzazione applicazione...');
    
    // Applica fix per elementi visibili
    ensureElementsVisible();
    
    // Proteggi la pagina
    await protectPage();

    const path = getCurrentPath();
    console.log('📍 Pagina corrente:', path);

    // Router delle pagine
    if (path.endsWith('/home.html') || path === '/app/' || path === '/') {
        await initHomePage();
    } else if (path.endsWith('/login.html')) {
        initLoginPage();
    } else if (path.endsWith('/register.html')) {
        initRegisterPage();
    } else if (path.endsWith('/logout.html')) {
        await initLogoutPage();
    } else if (path.endsWith('/dirigenti.html')) {
        await initDirigentiPage();
    } else if (path.endsWith('/tessera.html')) {
        await loadTesseraData();
    } else if (path.endsWith('/profilo.html')) {
        await loadProfileData();
    } else if (path.endsWith('/dirigente-dashboard.html')) {
        initDirigenteDashboardPage();
    } else if (path.endsWith('/convenzioni.html')) {
        await initTutteConvenzioniPage();
    }
    
    // Ri-applica fix per elementi visibili dopo l'inizializzazione
    setTimeout(() => {
        ensureElementsVisible();
    }, 500);
    
    console.log('✅ Inizializzazione completata');
});

// ========================================================================
//                    GESTIONE NAVIGATION ATTIVA
// ========================================================================

// Funzione per attivare la navigazione corretta
const activateNavigation = () => {
    const path = getCurrentPath();
    const pageNavMap = {
        'home': 'nav-home',
        'tessera': 'nav-tessera', 
        'servizi': 'nav-servizi',
        'profilo': 'nav-profilo',
        'turni': 'nav-servizi',
        'dirigenti': 'nav-servizi',
        'convenzioni': 'nav-servizi',
        'dirigente-dashboard': 'nav-servizi',
        'admin': 'nav-servizi',
        'virgilio': 'nav-servizi'
    };
    
    const currentPage = path.split('/').pop().replace('.html', '');
    
    // Rimuovi active da tutti
    document.querySelectorAll('.nav-item, .footer-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Attiva il corretto
    const activeNavId = pageNavMap[currentPage];
    if (activeNavId) {
        const activeElement = document.getElementById(activeNavId);
        if (activeElement) {
            activeElement.classList.add('active');
        }
    }
};

// Attiva navigazione dopo il caricamento
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        activateNavigation();
        ensureElementsVisible();
    }, 100);
});

// ========================================================================
//                    FORGOTTEN PASSWORD
// ========================================================================

const initForgotPasswordPage = () => {
    const form = document.getElementById('forgotPasswordForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = form.email.value;
        const submitButton = form.querySelector('button[type="submit"]');
        
        submitButton.disabled = true;
        submitButton.textContent = 'Invio in corso...';

        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/public/reset-password.html`
            });
            
            if (error) throw error;
            
            showFeedback('Email di reset inviata! Controlla la tua casella di posta.', 'success', 'forgotPasswordFeedback');
        } catch (error) {
            showFeedback(`Errore: ${error.message}`, 'error', 'forgotPasswordFeedback');
        } finally {
            submitButton.disabled = false;
            submitButton.textContent = 'Invia Istruzioni';
        }
    });
};

// ========================================================================
//                    ESPORTAZIONI GLOBALI
// ========================================================================

// Esporta funzioni per uso globale
window.editQuickNotizia = editQuickNotizia;
window.deleteQuickNotizia = deleteQuickNotizia;
window.resetNotiziaForm = resetNotiziaForm;
window.deleteQuickConvenzione = deleteQuickConvenzione;
window.ensureElementsVisible = ensureElementsVisible;
window.activateNavigation = activateNavigation;
window.initTutteConvenzioniPage = initTutteConvenzioniPage;

// ========================================================================
//                    FIX AGGIUNTIVI PER ELEMENTI UI
// ========================================================================

// Observer per elementi che vengono creati dinamicamente
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeType === 1) { // Element node
                    // Applica fix di visibilità agli elementi aggiunti
                    if (node.classList.contains('nav-item') || 
                        node.classList.contains('footer-nav-item') ||
                        node.tagName === 'BUTTON') {
                        node.style.display = '';
                        node.style.visibility = 'visible';
                        node.style.opacity = '1';
                    }
                    
                    // Fix per elementi figli
                    const children = node.querySelectorAll('.nav-item, .footer-nav-item, button');
                    children.forEach(child => {
                        child.style.display = '';
                        child.style.visibility = 'visible';
                        child.style.opacity = '1';
                    });
                }
            });
        }
    });
});

// Avvia l'observer
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Fix periodico per assicurare che gli elementi rimangano visibili
setInterval(() => {
    ensureElementsVisible();
}, 3000);

console.log('✅ Main.js caricato completamente con tutti i fix');