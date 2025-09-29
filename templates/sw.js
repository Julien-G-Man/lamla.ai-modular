{% load static %}
// templates/sw.js - Served at /service-worker.js

// Unique cache name. 
const CACHE_NAME = 'laml_ai-v2';

// --- List of all critical URLs to precache ---
const urlsToCache = [
    // --- HTML Templates (Navigation Requests) ---
    // Use named URLs if possible, otherwise use the direct path like '/'
    '{% url "core:home" %}',
    '{% url "core:about" %}',
    '{% url "feedback:contact" %}',
    '{% url "quiz:custom_quiz" %}', 
    '{% url "quiz:quiz" %}', 
    '{% url "quiz:quiz_results" %}', 
    '{% url "quiz:flashcards" %}',
    '{% url "quiz:exam_analyzer" %}',
    '{% url "ai:chatbot" %}',
    
    // --- JavaScript Files (from static/js/) ---
    '{% static "js/about.js" %}',
    '{% static "js/base.js" %}',
    '{% static "js/chat.js" %}',
    '{% static "js/contact.js" %}',
    '{% static "js/flashcards.js" %}',
    '{% static "js/home.js" %}',
    '{% static "js/custom_quiz.js" %}',
    '{% static "js/quiz.js" %}',
    '{% static "js/quiz_results.js" %}',
    
    // --- CSS Files (from static/css/) ---
    '{% static "css/base.css" %}', 
    '{% static "css/home.css" %}', 
    '{% static "css/about.css" %}', 
    '{% static "css/contact.css" %}', 
    '{% static "css/chatbot.css" %}', 
    '{% static "css/quiz.css" %}', 
    '{% static "css/custom_quiz.css" %}', 
    '{% static "css/quiz_results.css" %}', 
    '{% static "css/flashcards.css" %}', 
    '{% static "css/exam_analyzer.css" %}', 
    

    // --- Image Files (from static/img/) ---
    '{% static "img/lamla_logo.png" %}',
    '{% static "img/discussion.webp" %}',
    '{% static "img/graduation-cap.jpg" %}',
    '{% static "img/incognito.png" %}',
    '{% static "img/student_desk.webp" %}',
    
    
    
    // --- Graphics Files (from static/graphics/) ---
    '{% static "graphics/favicon.ico" %}',
];


// 1. Install Event: Caching static assets
self.addEventListener('install', event => {
    // Force the service worker to activate immediately
    self.skipWaiting(); 
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('[Service Worker] Opened cache. Caching static assets...');
                // Add all files in the list to the cache
                return cache.addAll(urlsToCache).catch(err => {
                    console.error('[Service Worker] Failed to cache some assets:', err);
                });
            })
    );
});

// 2. Activate Event: Cleaning up old caches
self.addEventListener('activate', event => {
    const cacheWhitelist = [CACHE_NAME];
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    // Delete caches that are not in the current whitelist
                    if (cacheWhitelist.indexOf(cacheName) === -1) {
                        console.log(`[Service Worker] Deleting old cache: ${cacheName}`);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    // Ensure the new service worker takes control of the page immediately
    return self.clients.claim(); 
});

// 3. Fetch Event: Intercepting requests and serving from cache
self.addEventListener('fetch', event => {
    // We only want to intercept GET requests
    if (event.request.method !== 'GET') return;
    
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                // Cache-first strategy: Return cached response if found
                if (response) {
                    return response;
                }
                
                // Fallback: Fetch from the network
                return fetch(event.request);
            })
            // Optional: Provide a custom offline page for failed navigation requests
            .catch(() => {
                // If fetching fails, check if it was a navigation request (loading a new page)
                // and return a cached offline page if you have one.
                // if (event.request.mode === 'navigate') {
                //     return caches.match('/offline-page-url'); 
                // }
            })
    );
});