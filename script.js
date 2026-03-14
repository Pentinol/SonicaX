(function() {
    // Состояние - V3 и advanced по умолчанию
    let currentMood = 'cosmic';
    let durationSec = 60;
    let volumePercent = 100;
    let spaceValue = 30;
    let mode = 'advanced';
    let bassLevel = 'std';
    let algorithmVersion = 'v3';
    let audioContext = null;
    let mediaRecorder = null;
    let recordedChunks = [];
    let synthNodes = [];
    let generatedBlob = null;
    let exportEnabled = false;
    let scheduledStopTimeout = null;
    let masterGain = null;
    let isGenerating = false;
    let flacEncoder = null;
    
    // Узлы для эффекта объёма
    let reverbNodes = {
        delay1: null,
        delay2: null,
        feedback1: null,
        feedback2: null,
        wetGain: null,
        filter1: null,
        filter2: null
    };

    // Элементы
    const moodBtns = document.querySelectorAll('.mood-btn');
    const durationSlider = document.getElementById('durationSlider');
    const durationDisplay = document.getElementById('durationDisplay');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumeDisplay = document.getElementById('volumeDisplay');
    const spaceSlider = document.getElementById('spaceSlider');
    const spaceDisplay = document.getElementById('spaceDisplay');
    const modeBtns = document.querySelectorAll('.mode-btn');
    const bassBtns = document.querySelectorAll('.bass-btn');
    const versionBtns = document.querySelectorAll('.version-btn');
    const generateBtn = document.getElementById('generateBtn');
    const clearBtn = document.getElementById('clearBtn');
    const exportMp3 = document.getElementById('exportMp3');
    const exportWav = document.getElementById('exportWav');
    const exportFlac = document.getElementById('exportFlac');
    const statusMsg = document.getElementById('statusMessage');
    const ambientCard = document.querySelector('.ambient-card');
    const starfield = document.getElementById('starfield');
    const notificationContainer = document.getElementById('notificationContainer');

    // Элементы для истории
    const historyToggleBtn = document.getElementById('historyToggleBtn');
    const historySidebar = document.getElementById('historySidebar');
    const historyCloseBtn = document.getElementById('historyCloseBtn');
    const historyClearBtn = document.getElementById('historyClearBtn');
    const historyContent = document.getElementById('historyContent');
    const historyAudioPlayer = document.getElementById('historyAudioPlayer');
    
    // Массив для хранения записей истории
    let historyItems = [];
    
    // Текущий воспроизводящийся элемент
    let currentlyPlayingId = null;
    
    // Таймеры для прогресса генерации
    const generationProgress = {};

    // Индикаторы для анимации скольжения
    const versionIndicator = document.querySelector('.version-indicator');
    const moodIndicator = document.querySelector('.mood-indicator');
    const bassIndicator = document.querySelector('.bass-indicator');
    const modeIndicator = document.querySelector('.mode-indicator');

    // ========== ЗАГРУЗКА И СОХРАНЕНИЕ ИСТОРИИ ==========
    function loadHistoryFromStorage() {
        try {
            const saved = localStorage.getItem('sonicax_history');
            if (saved) {
                const parsed = JSON.parse(saved);
                // Восстанавливаем записи
                historyItems = parsed.map(item => ({
                    ...item,
                    isComplete: item.isComplete || false,
                    progress: item.progress || 0
                }));
                renderHistory();
            }
        } catch (e) {
            console.error('Failed to load history:', e);
        }
    }

    function saveHistoryToStorage() {
        try {
            // Сохраняем все записи
            localStorage.setItem('sonicax_history', JSON.stringify(historyItems));
        } catch (e) {
            console.error('Failed to save history:', e);
            showNotification('Не удалось сохранить историю', 'warning', 3000);
        }
    }

    // ========== ФУНКЦИИ ДЛЯ ИСТОРИИ ==========
    // Добавление записи в историю (СРАЗУ, без ожидания)
    function addToHistory(isComplete = true, existingItem = null) {
        const now = new Date();
        const timeString = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateString = now.toLocaleDateString('ru-RU');
        
        const moodNames = {
            cosmic: 'космический',
            thoughtful: 'задумчивый',
            mysterious: 'загадочный',
            dark: 'мрачный'
        };
        
        const bassNames = {
            min: 'минимум',
            std: 'стандартно',
            max: 'больше',
            solo: 'соло'
        };
        
        const spaceText = spaceDisplay.textContent;
        
        // Если передан существующий item (для обновления), используем его
        if (existingItem) {
            existingItem.isComplete = isComplete;
            existingItem.progress = isComplete ? 100 : existingItem.progress;
            
            if (isComplete && generatedBlob) {
                const reader = new FileReader();
                reader.onloadend = function() {
                    existingItem.audioData = reader.result;
                    saveHistoryToStorage();
                    renderHistory();
                };
                reader.readAsDataURL(generatedBlob);
            } else {
                saveHistoryToStorage();
                renderHistory();
            }
            return;
        }
        
        // Создаём новую запись
        const historyItem = {
            id: Date.now(),
            version: algorithmVersion.toUpperCase(),
            mood: moodNames[currentMood] || currentMood,
            bass: bassNames[bassLevel] || bassLevel,
            duration: durationSec,
            space: spaceText,
            mode: mode === 'advanced' ? 'продвинутый' : 'простой',
            time: timeString,
            date: dateString,
            timestamp: now.getTime(),
            isComplete: isComplete,
            progress: isComplete ? 100 : 0,
            settings: {
                mood: currentMood,
                bass: bassLevel,
                mode: mode,
                space: spaceValue,
                volume: volumePercent
            }
        };
        
        if (isComplete && generatedBlob) {
            // Если генерация завершена и есть аудио, сохраняем его
            const reader = new FileReader();
            reader.onloadend = function() {
                historyItem.audioData = reader.result;
                historyItems.unshift(historyItem);
                
                // Ограничиваем до 30 записей
                if (historyItems.length > 30) {
                    const removed = historyItems.pop();
                    if (currentlyPlayingId === removed.id) {
                        historyAudioPlayer.pause();
                        currentlyPlayingId = null;
                    }
                }
                
                saveHistoryToStorage();
                renderHistory();
            };
            reader.readAsDataURL(generatedBlob);
        } else {
            // Для незавершённой генерации добавляем сразу
            historyItems.unshift(historyItem);
            
            // Ограничиваем до 30 записей
            if (historyItems.length > 30) {
                const removed = historyItems.pop();
                if (currentlyPlayingId === removed.id) {
                    historyAudioPlayer.pause();
                    currentlyPlayingId = null;
                }
            }
            
            saveHistoryToStorage();
            renderHistory();
        }
    }

    // Обновление прогресса генерации
    function updateGenerationProgress(id, progress) {
        const item = historyItems.find(i => i.id === id);
        if (item && !item.isComplete) {
            item.progress = progress;
            saveHistoryToStorage();
            renderHistory();
        }
    }

    // Завершение генерации (обновление записи)
    function completeGeneration(id) {
        const item = historyItems.find(i => i.id === id);
        if (item && !item.isComplete && generatedBlob) {
            item.isComplete = true;
            item.progress = 100;
            
            const reader = new FileReader();
            reader.onloadend = function() {
                item.audioData = reader.result;
                saveHistoryToStorage();
                renderHistory();
                
                showNotification(
                    'Генерация завершена, эмбиент добавлен в историю',
                    'complete',
                    3000
                );
            };
            reader.readAsDataURL(generatedBlob);
        }
    }

    // Продолжение генерации
    function continueGeneration(id) {
        const item = historyItems.find(i => i.id === id);
        if (!item) return;
        
        // Восстанавливаем настройки
        if (item.settings) {
            currentMood = item.settings.mood;
            moodBtns.forEach(btn => {
                btn.classList.remove('active-mood');
                if (btn.dataset.mood === currentMood) btn.classList.add('active-mood');
            });
            
            bassLevel = item.settings.bass;
            bassBtns.forEach(btn => {
                btn.classList.remove('active-bass');
                if (btn.dataset.bass === bassLevel) btn.classList.add('active-bass');
            });
            
            mode = item.settings.mode;
            modeBtns.forEach(btn => {
                btn.classList.remove('active-mode');
                if (btn.dataset.mode === mode) btn.classList.add('active-mode');
            });
            
            spaceSlider.value = item.settings.space;
            spaceValue = item.settings.space;
            if (spaceValue < 10) spaceDisplay.textContent = 'камера';
            else if (spaceValue < 25) spaceDisplay.textContent = 'комната';
            else if (spaceValue < 45) spaceDisplay.textContent = 'зал';
            else if (spaceValue < 70) spaceDisplay.textContent = 'собор';
            else spaceDisplay.textContent = 'бесконечность';
            
            volumeSlider.value = item.settings.volume;
            volumePercent = item.settings.volume;
            volumeDisplay.textContent = volumePercent + '%';
        }
        
        durationSec = item.duration;
        durationSlider.value = item.duration;
        durationDisplay.textContent = durationSec + ' сек';
        
        // Запускаем генерацию
        showNotification('Продолжение генерации...', 'info', 2000);
        
        // Удаляем старую запись
        deleteHistoryItem(id);
        
        // Запускаем новую генерацию
        setTimeout(() => {
            generateBtn.click();
        }, 500);
    }

    // Удаление конкретной записи
    function deleteHistoryItem(id) {
        const index = historyItems.findIndex(i => i.id === id);
        if (index !== -1) {
            if (currentlyPlayingId === id) {
                historyAudioPlayer.pause();
                currentlyPlayingId = null;
            }
            historyItems.splice(index, 1);
            saveHistoryToStorage();
            renderHistory();
            showNotification('Запись удалена', 'complete', 2000);
        }
    }

    // Очистка истории
    function clearHistory() {
        if (currentlyPlayingId) {
            historyAudioPlayer.pause();
            currentlyPlayingId = null;
        }
        historyItems = [];
        localStorage.removeItem('sonicax_history');
        renderHistory();
        showNotification('История очищена', 'complete', 2000);
    }

    // Воспроизведение из истории
    function playHistoryItem(id) {
        const item = historyItems.find(i => i.id === id);
        if (!item || !item.audioData) return;
        
        if (currentlyPlayingId === id) {
            historyAudioPlayer.pause();
            currentlyPlayingId = null;
            updatePlayButtons();
            return;
        }
        
        historyAudioPlayer.pause();
        historyAudioPlayer.src = item.audioData;
        historyAudioPlayer.play().catch(e => {
            console.error('Playback failed:', e);
            showNotification('Ошибка воспроизведения', 'warning', 2000);
        });
        
        currentlyPlayingId = id;
        updatePlayButtons();
        
        historyAudioPlayer.onended = () => {
            currentlyPlayingId = null;
            updatePlayButtons();
        };
    }

    // Скачивание из истории
    function downloadHistoryItem(id, format = 'webm') {
        const item = historyItems.find(i => i.id === id);
        if (!item || !item.audioData) return;
        
        fetch(item.audioData)
            .then(res => res.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `sonicax_${item.version}_${item.timestamp}.${format}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showNotification(`Скачивание начато`, 'complete', 2000);
            })
            .catch(e => {
                console.error('Download failed:', e);
                showNotification('Ошибка скачивания', 'warning', 2000);
            });
    }

    // Обновление состояния кнопок воспроизведения
    function updatePlayButtons() {
        document.querySelectorAll('.history-play-btn').forEach(btn => {
            const id = parseInt(btn.dataset.id);
            const item = historyItems.find(i => i.id === id);
            
            if (currentlyPlayingId === id) {
                btn.classList.add('playing');
                btn.innerHTML = '<span class="material-symbols-outlined">pause</span> Пауза';
            } else {
                btn.classList.remove('playing');
                btn.innerHTML = '<span class="material-symbols-outlined">play_arrow</span> Слушать';
            }
            
            btn.disabled = !item || !item.audioData;
        });
    }

    // Отрисовка истории
    function renderHistory() {
        if (historyItems.length === 0) {
            historyContent.innerHTML = '<div class="history-empty">Пока нет запросов</div>';
            return;
        }
        
        let html = '';
        historyItems.forEach(item => {
            const incompleteClass = !item.isComplete ? 'incomplete' : '';
            const progressBar = !item.isComplete && item.progress ? 
                `<div class="history-progress">
                    <div class="history-progress-bar" style="width: ${item.progress}%"></div>
                </div>` : '';
            
            html += `
                <div class="history-item ${incompleteClass}" data-id="${item.id}">
                    <button class="history-delete-btn" data-id="${item.id}" title="Удалить">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                    <div class="history-item-header">
                        <span class="history-item-version ${incompleteClass}">${item.version} ${!item.isComplete ? '(не завершено)' : ''}</span>
                        <span class="history-item-mood">${item.mood}</span>
                    </div>
                    ${progressBar}
                    <div class="history-item-details">
                        <span class="history-item-detail">
                            <span class="material-symbols-outlined">schedule</span> ${item.duration}с
                        </span>
                        <span class="history-item-detail">
                            <span class="material-symbols-outlined">surround_sound</span> ${item.space}
                        </span>
                        <span class="history-item-detail">
                            <span class="material-symbols-outlined">graphic_eq</span> ${item.bass}
                        </span>
                    </div>
                    <div class="history-item-actions">
                        <button class="history-play-btn" data-id="${item.id}" ${!item.audioData ? 'disabled' : ''}>
                            <span class="material-symbols-outlined">play_arrow</span> Слушать
                        </button>
                        ${!item.isComplete ? 
                            `<button class="history-continue-btn" data-id="${item.id}">
                                <span class="material-symbols-outlined">refresh</span> Продолжить
                            </button>` : ''
                        }
                        ${item.audioData ? 
                            `<button class="history-download-btn" data-id="${item.id}">
                                <span class="material-symbols-outlined">download</span> Скачать
                            </button>` : ''
                        }
                    </div>
                    <div class="history-item-time">${item.date} ${item.time}</div>
                </div>
            `;
        });
        
        historyContent.innerHTML = html;
        
        // Добавляем обработчики для кнопок
        document.querySelectorAll('.history-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                playHistoryItem(id);
            });
        });
        
        document.querySelectorAll('.history-continue-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                continueGeneration(id);
            });
        });
        
        document.querySelectorAll('.history-download-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                downloadHistoryItem(id);
            });
        });
        
        document.querySelectorAll('.history-delete-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const id = parseInt(btn.dataset.id);
                deleteHistoryItem(id);
            });
        });
    }

    // Управление боковой панелью
    function openHistorySidebar() {
        historySidebar.classList.add('open');
    }

    function closeHistorySidebar() {
        historySidebar.classList.remove('open');
    }

    historyToggleBtn.addEventListener('click', openHistorySidebar);
    historyCloseBtn.addEventListener('click', closeHistorySidebar);
    historyClearBtn.addEventListener('click', clearHistory);

    // Закрытие по клику вне панели
    document.addEventListener('click', (e) => {
        if (historySidebar.classList.contains('open') && 
            !historySidebar.contains(e.target) && 
            !historyToggleBtn.contains(e.target)) {
            closeHistorySidebar();
        }
    });

    // ========== ФУНКЦИИ ДЛЯ КОНВЕРТАЦИИ ==========
    async function convertToFlac(audioBlob) {
        return new Promise(async (resolve, reject) => {
            try {
                const arrayBuffer = await audioBlob.arrayBuffer();
                
                const audioContext = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 44100 * 10, 44100);
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
                
                const samples = audioBuffer.length;
                const channels = audioBuffer.numberOfChannels;
                
                const interleaved = new Int16Array(samples * channels);
                
                for (let channel = 0; channel < channels; channel++) {
                    const channelData = audioBuffer.getChannelData(channel);
                    for (let i = 0; i < samples; i++) {
                        const sample = Math.max(-1, Math.min(1, channelData[i]));
                        interleaved[i * channels + channel] = sample < 0 ? sample * 32768 : sample * 32767;
                    }
                }
                
                if (typeof FLAC === 'undefined' && typeof Flac === 'undefined' && typeof flac === 'undefined') {
                    console.warn('FLAC library not found, using WAV fallback');
                    const wavBlob = await convertToWav(audioBuffer);
                    resolve(wavBlob);
                    return;
                }
                
                const FlacEncoder = FLAC || Flac || flac;
                
                const encoder = new FlacEncoder({
                    channels: channels,
                    sampleRate: 44100,
                    compression: 5,
                    bitsPerSample: 16
                });
                
                const flacBuffer = encoder.encode(interleaved);
                
                const flacBlob = new Blob([flacBuffer], { type: 'audio/flac' });
                resolve(flacBlob);
                
            } catch (error) {
                console.error('FLAC conversion error:', error);
                showNotification('Ошибка конвертации в FLAC, используется оригинальный формат', 'warning', 4000);
                resolve(audioBlob);
            }
        });
    }

    async function convertToWav(audioBuffer) {
        const samples = audioBuffer.length;
        const channels = audioBuffer.numberOfChannels;
        const sampleRate = audioBuffer.sampleRate;
        
        const interleaved = new Int16Array(samples * channels);
        
        for (let channel = 0; channel < channels; channel++) {
            const channelData = audioBuffer.getChannelData(channel);
            for (let i = 0; i < samples; i++) {
                const sample = Math.max(-1, Math.min(1, channelData[i]));
                interleaved[i * channels + channel] = sample < 0 ? sample * 32768 : sample * 32767;
            }
        }
        
        const wavHeader = createWavHeader(samples, channels, sampleRate, interleaved.byteLength);
        
        const wavBlob = new Blob([wavHeader, interleaved], { type: 'audio/wav' });
        return wavBlob;
    }

    function createWavHeader(samples, channels, sampleRate, dataSize) {
        const header = new ArrayBuffer(44);
        const view = new DataView(header);
        
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + dataSize, true);
        writeString(view, 8, 'WAVE');
        
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, channels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * channels * 2, true);
        view.setUint16(32, channels * 2, true);
        view.setUint16(34, 16, true);
        
        writeString(view, 36, 'data');
        view.setUint32(40, dataSize, true);
        
        return header;
    }

    function writeString(view, offset, string) {
        for (let i = 0; i < string.length; i++) {
            view.setUint8(offset + i, string.charCodeAt(i));
        }
    }

    // Функция обновления позиции индикатора и цветов
    function updateIndicator(buttons, indicator, activeClass) {
        const activeBtn = Array.from(buttons).find(btn => btn.classList.contains(activeClass));
        if (activeBtn && indicator) {
            indicator.style.width = activeBtn.offsetWidth + 'px';
            indicator.style.left = activeBtn.offsetLeft + 'px';
        }
        
        buttons.forEach(btn => {
            if (btn.classList.contains(activeClass)) {
                btn.style.color = '#000';
            } else {
                btn.style.color = '#666';
            }
        });
    }

    // Инициализация индикаторов и цветов
    function initIndicators() {
        updateIndicator(versionBtns, versionIndicator, 'active-version');
        updateIndicator(moodBtns, moodIndicator, 'active-mood');
        updateIndicator(bassBtns, bassIndicator, 'active-bass');
        updateIndicator(modeBtns, modeIndicator, 'active-mode');
    }

    window.addEventListener('load', initIndicators);
    window.addEventListener('resize', initIndicators);

    // Ползунок длительности (обновлено: макс 360)
    durationSlider.addEventListener('input', (e) => {
        durationSec = parseInt(e.target.value);
        durationDisplay.textContent = durationSec + ' сек';
    });

    // Ползунок громкости
    volumeSlider.addEventListener('input', (e) => {
        volumePercent = parseInt(e.target.value);
        volumeDisplay.textContent = volumePercent + '%';
        
        if (masterGain) {
            const gainValue = volumePercent / 100;
            masterGain.gain.setValueAtTime(gainValue, audioContext.currentTime);
        }
    });

    // Ползунок объёма звука
    spaceSlider.addEventListener('input', (e) => {
        spaceValue = parseInt(e.target.value);
        
        if (spaceValue < 10) {
            spaceDisplay.textContent = 'камера';
        } else if (spaceValue < 25) {
            spaceDisplay.textContent = 'комната';
        } else if (spaceValue < 45) {
            spaceDisplay.textContent = 'зал';
        } else if (spaceValue < 70) {
            spaceDisplay.textContent = 'собор';
        } else {
            spaceDisplay.textContent = 'бесконечность';
        }
        
        if (reverbNodes.delay1 && audioContext) {
            const now = audioContext.currentTime;
            const spaceFactor = spaceValue / 100;
            
            const delay1Time = 0.01 + spaceFactor * 1.19;
            const delay2Time = 0.02 + spaceFactor * 1.38;
            const feedback1Gain = spaceFactor * 0.92;
            const feedback2Gain = spaceFactor * 0.89;
            const wetLevel = spaceFactor * 1.2;
            const filterFreq = 2000 + (1 - spaceFactor) * 3000;
            
            reverbNodes.delay1.delayTime.setValueAtTime(delay1Time, now);
            reverbNodes.delay2.delayTime.setValueAtTime(delay2Time, now);
            reverbNodes.feedback1.gain.setValueAtTime(feedback1Gain, now);
            reverbNodes.feedback2.gain.setValueAtTime(feedback2Gain, now);
            reverbNodes.wetGain.gain.setValueAtTime(wetLevel, now);
            reverbNodes.filter1.frequency.setValueAtTime(filterFreq, now);
            reverbNodes.filter2.frequency.setValueAtTime(filterFreq * 0.7, now);
        }
    });

    // Настроение
    moodBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            moodBtns.forEach(b => b.classList.remove('active-mood'));
            btn.classList.add('active-mood');
            currentMood = btn.dataset.mood;
            updateIndicator(moodBtns, moodIndicator, 'active-mood');
        });
    });

    // Режим
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => b.classList.remove('active-mode'));
            btn.classList.add('active-mode');
            mode = btn.dataset.mode;
            updateIndicator(modeBtns, modeIndicator, 'active-mode');
        });
    });

    // Басы
    bassBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            bassBtns.forEach(b => b.classList.remove('active-bass'));
            btn.classList.add('active-bass');
            bassLevel = btn.dataset.bass;
            updateIndicator(bassBtns, bassIndicator, 'active-bass');
        });
    });

    // Версия алгоритма
    versionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            versionBtns.forEach(b => b.classList.remove('active-version'));
            btn.classList.add('active-version');
            algorithmVersion = btn.dataset.version;
            updateIndicator(versionBtns, versionIndicator, 'active-version');
            
            ambientCard.classList.add('version-switch');
            setTimeout(() => {
                ambientCard.classList.remove('version-switch');
            }, 800);
            
            statusMsg.textContent = `версия ${algorithmVersion} · готов`;
        });
    });

    // Эффект звездочек
    function createStars(event) {
        const rect = generateBtn.getBoundingClientRect();
        const cardRect = ambientCard.getBoundingClientRect();
        
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        const starX = rect.left + clickX - cardRect.left;
        const starY = rect.top + clickY - cardRect.top;
        
        for (let i = 0; i < 15; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            
            const angle = (i / 15) * Math.PI * 2 + Math.random() * 0.5;
            const distance = 30 + Math.random() * 60;
            const dx = Math.cos(angle) * distance;
            const dy = Math.sin(angle) * distance;
            
            star.style.setProperty('--dx', dx + 'px');
            star.style.setProperty('--dy', dy + 'px');
            star.style.left = (starX - 1.5) + 'px';
            star.style.top = (starY - 1.5) + 'px';
            star.style.background = 'white';
            star.style.boxShadow = `0 0 ${6 + Math.random() * 6}px white`;
            star.style.width = (1.5 + Math.random() * 2.5) + 'px';
            star.style.height = star.style.width;
            
            starfield.appendChild(star);
            
            setTimeout(() => {
                star.remove();
            }, 700);
        }
    }

    // Анимации
    function triggerBorderAnimation(type = 'generate') {
        ambientCard.classList.add('generating');
        setTimeout(() => {
            ambientCard.classList.remove('generating');
        }, 800);
    }

    // ========== СИСТЕМА УВЕДОМЛЕНИЙ ==========
    function showNotification(message, type = 'info', duration = 6000) {
        const notification = document.createElement('div');
        notification.className = 'notification';
        
        if (type === 'generate') {
            notification.classList.add('gradient-green');
        } else if (type === 'complete') {
            notification.classList.add('gradient-blue');
        } else if (type === 'warning') {
            notification.classList.add('gradient-red');
        } else if (type === 'welcome') {
            notification.classList.add('gradient-purple');
        }
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'notification-content';
        
        const textDiv = document.createElement('div');
        textDiv.className = 'notification-text';
        textDiv.textContent = message;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.innerHTML = '✕';
        closeBtn.setAttribute('aria-label', 'Закрыть');
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            notification.classList.add('fade-out');
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        });
        
        contentDiv.appendChild(textDiv);
        contentDiv.appendChild(closeBtn);
        notification.appendChild(contentDiv);
        
        notificationContainer.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.add('fade-out');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, 300);
            }
        }, duration);
    }

    // ========== ПРИВЕТСТВЕННОЕ УВЕДОМЛЕНИЕ ==========
    window.addEventListener('load', () => {
        setTimeout(() => {
            showNotification(
                'При использовании V2 и V3 версий рекомендуется использовать наушники, т.к. эти модели генерируют более глубокий звук.',
                'welcome',
                8000
            );
        }, 500);
        
        // Загружаем историю
        loadHistoryFromStorage();
    });

    // Создание эффекта объёма
    function createPowerfulReverb() {
        if (!audioContext) return null;
        
        const now = audioContext.currentTime;
        const spaceFactor = spaceValue / 100;
        
        const delay1 = audioContext.createDelay(2.0);
        const delay2 = audioContext.createDelay(2.0);
        const feedback1 = audioContext.createGain();
        const feedback2 = audioContext.createGain();
        const wetGain = audioContext.createGain();
        const filter1 = audioContext.createBiquadFilter();
        const filter2 = audioContext.createBiquadFilter();
        const diffuser = audioContext.createDelay(0.1);
        
        reverbNodes = {
            delay1, delay2,
            feedback1, feedback2,
            wetGain,
            filter1, filter2,
            diffuser
        };
        
        const delay1Time = 0.01 + spaceFactor * 1.19;
        const delay2Time = 0.02 + spaceFactor * 1.38;
        const feedback1Gain = spaceFactor * 0.92;
        const feedback2Gain = spaceFactor * 0.89;
        const wetLevel = spaceFactor * 1.2;
        const filterFreq = 2000 + (1 - spaceFactor) * 3000;
        const diffuserTime = 0.005 + spaceFactor * 0.045;
        
        delay1.delayTime.value = delay1Time;
        delay2.delayTime.value = delay2Time;
        feedback1.gain.value = feedback1Gain;
        feedback2.gain.value = feedback2Gain;
        wetGain.gain.value = wetLevel;
        filter1.frequency.value = filterFreq;
        filter2.frequency.value = filterFreq * 0.7;
        filter1.Q.value = spaceFactor > 0.8 ? 0.2 : spaceFactor < 0.2 ? 0.5 : 0.3;
        filter2.Q.value = spaceFactor > 0.8 ? 0.3 : spaceFactor < 0.2 ? 0.5 : 0.4;
        diffuser.delayTime.value = diffuserTime;
        
        delay1.connect(filter1);
        filter1.connect(feedback1);
        feedback1.connect(delay1);
        filter1.connect(wetGain);
        
        delay2.connect(filter2);
        filter2.connect(feedback2);
        feedback2.connect(delay2);
        filter2.connect(wetGain);
        
        filter1.connect(delay2);
        filter2.connect(delay1);
        
        return { input: diffuser, output: wetGain };
    }

    // ==================== АЛГОРИТМ V1 ====================
    function generateV1() {
        const scale = [0, 2, 4, 7, 9, 12, 14, 16];
        const baseFreq = 180;
        const layers = mode === 'advanced' ? 3 : 2;
        const now = audioContext.currentTime;
        
        const reverb = createPowerfulReverb();
        
        for (let layer = 0; layer < layers; layer++) {
            const layerOctave = 0.5 + layer * 0.3;
            const layerBase = baseFreq * layerOctave;
            const notesCount = mode === 'advanced' ? 8 : 5;
            
            for (let i = 0; i < notesCount; i++) {
                const timePos = (i / notesCount) * durationSec;
                let startTime = now + timePos + (Math.random() * 1.5 - 0.75);
                startTime = Math.min(startTime, now + durationSec - 2);
                startTime = Math.max(startTime, now + 0.5);
                
                const scaleIndex = Math.floor(Math.random() * scale.length);
                const semitone = scale[scaleIndex];
                const freq = layerBase * Math.pow(2, semitone / 12);
                
                const duration = 4 + Math.random() * 4;
                const gain = 0.03;
                
                const osc = audioContext.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = freq;
                
                const gainNode = audioContext.createGain();
                const panner = audioContext.createStereoPanner();
                panner.pan.value = layer === 0 ? 0 : layer === 1 ? -0.3 : 0.3;
                
                osc.connect(gainNode);
                gainNode.connect(panner);
                panner.connect(masterGain);
                
                const reverbSend = audioContext.createGain();
                reverbSend.gain.value = 0.7;
                gainNode.connect(reverbSend);
                reverbSend.connect(reverb.input);
                
                const directToReverb = audioContext.createGain();
                directToReverb.gain.value = 0.3;
                panner.connect(directToReverb);
                directToReverb.connect(reverb.input);
                
                reverb.output.connect(masterGain);
                
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(gain, startTime + 0.8);
                gainNode.gain.setValueAtTime(gain, startTime + duration - 1.2);
                gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
                
                osc.start(startTime);
                osc.stop(startTime + duration + 0.2);
                
                synthNodes.push(
                    osc, gainNode, panner, 
                    reverbSend, directToReverb,
                    reverb.input, reverb.output,
                    reverbNodes.delay1, reverbNodes.delay2,
                    reverbNodes.feedback1, reverbNodes.feedback2,
                    reverbNodes.wetGain,
                    reverbNodes.filter1, reverbNodes.filter2,
                    reverbNodes.diffuser
                );
            }
        }
    }

    // ==================== АЛГОРИТМ V2 ====================
    function generateV2() {
        const now = audioContext.currentTime;
        const totalDur = durationSec;
        
        const reverb = createPowerfulReverb();
        
        const moodParams = {
            cosmic: {
                baseFreq: 140 + Math.random() * 40,
                scaleType: 'cosmic',
                density: mode === 'advanced' ? 2.8 : 1.8,
                panWidth: 0.6,
                attackRange: [0.8, 1.2],
                releaseRange: [1.5, 2.2],
                harmonicComplexity: 0.6,
                octaveSpread: [0.3, 0.5, 0.8, 1.2],
                waveTypes: ['sine', 'triangle', 'sine']
            },
            thoughtful: {
                baseFreq: 150 + Math.random() * 30,
                scaleType: 'thoughtful',
                density: mode === 'advanced' ? 2.5 : 1.6,
                panWidth: 0.5,
                attackRange: [0.9, 1.4],
                releaseRange: [1.8, 2.5],
                harmonicComplexity: 0.5,
                octaveSpread: [0.4, 0.6, 0.9, 1.3],
                waveTypes: ['sine', 'sine', 'triangle']
            },
            mysterious: {
                baseFreq: 130 + Math.random() * 50,
                scaleType: 'mysterious',
                density: mode === 'advanced' ? 3.0 : 2.0,
                panWidth: 0.7,
                attackRange: [0.7, 1.1],
                releaseRange: [1.3, 2.0],
                harmonicComplexity: 0.7,
                octaveSpread: [0.25, 0.45, 0.7, 1.1],
                waveTypes: ['sine', 'triangle', 'triangle']
            },
            dark: {
                baseFreq: 120 + Math.random() * 40,
                scaleType: 'dark',
                density: mode === 'advanced' ? 2.6 : 1.7,
                panWidth: 0.5,
                attackRange: [1.0, 1.5],
                releaseRange: [2.0, 2.8],
                harmonicComplexity: 0.5,
                octaveSpread: [0.35, 0.55, 0.85, 1.25],
                waveTypes: ['sine', 'sine', 'sine']
            }
        };

        const params = moodParams[currentMood];
        
        const scales = {
            cosmic: [[0, 2, 4, 7, 9, 12, 14, 16]],
            thoughtful: [[0, 2, 3, 5, 7, 8, 10, 12]],
            mysterious: [[0, 1, 4, 6, 7, 10, 13, 15]],
            dark: [[0, 2, 3, 5, 6, 8, 10, 12]]
        };

        const scale = scales[currentMood][0];
        const baseFreq = params.baseFreq;
        
        const notesPerLayer = mode === 'advanced' ? 12 : 8;
        const layers = mode === 'advanced' ? 4 : 3;
        
        const events = [];
        
        for (let layer = 0; layer < layers; layer++) {
            const layerOctave = params.octaveSpread[layer % params.octaveSpread.length];
            const layerBase = baseFreq * layerOctave;
            
            for (let i = 0; i < notesPerLayer; i++) {
                const t = i / (notesPerLayer - 1);
                const timePos = t * totalDur;
                
                let startTime = now + timePos;
                startTime += (Math.random() * 0.15 - 0.075);
                
                if (startTime < now) startTime = now;
                if (startTime > now + totalDur - 1.5) continue;
                
                const noteIndex = (i + layer) % scale.length;
                const semitone = scale[noteIndex];
                const freq = layerBase * Math.pow(2, semitone / 12);
                
                const duration = 3.5 + 2.5 * Math.sin(t * Math.PI);
                
                events.push({
                    startTime,
                    freq,
                    duration,
                    layer,
                    gain: 0.018
                });
            }
        }
        
        events.sort((a, b) => a.startTime - b.startTime);
        
        events.forEach(ev => {
            const osc = audioContext.createOscillator();
            osc.type = params.waveTypes[ev.layer % params.waveTypes.length];
            osc.frequency.value = ev.freq;
            
            const gainNode = audioContext.createGain();
            const panner = audioContext.createStereoPanner();
            panner.pan.value = (Math.sin(ev.layer * 0.7 + ev.startTime) * params.panWidth);
            
            const filter = audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = 800 + ev.layer * 150;
            filter.Q.value = 0.3;
            
            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(panner);
            panner.connect(masterGain);
            
            const reverbSend = audioContext.createGain();
            reverbSend.gain.value = 0.85;
            gainNode.connect(reverbSend);
            reverbSend.connect(reverb.input);
            
            const directToReverb = audioContext.createGain();
            directToReverb.gain.value = 0.4;
            panner.connect(directToReverb);
            directToReverb.connect(reverb.input);
            
            reverb.output.connect(masterGain);
            
            const attack = params.attackRange[0] + Math.random() * (params.attackRange[1] - params.attackRange[0]);
            const release = params.releaseRange[0] + Math.random() * (params.releaseRange[1] - params.releaseRange[0]);
            
            gainNode.gain.setValueAtTime(0, ev.startTime);
            gainNode.gain.linearRampToValueAtTime(ev.gain, ev.startTime + attack);
            gainNode.gain.setValueAtTime(ev.gain, ev.startTime + ev.duration - release);
            gainNode.gain.linearRampToValueAtTime(0, ev.startTime + ev.duration);
            
            osc.start(ev.startTime);
            osc.stop(ev.startTime + ev.duration + 0.2);
            
            synthNodes.push(
                osc, gainNode, panner, filter,
                reverbSend, directToReverb,
                reverb.input, reverb.output,
                reverbNodes.delay1, reverbNodes.delay2,
                reverbNodes.feedback1, reverbNodes.feedback2,
                reverbNodes.wetGain,
                reverbNodes.filter1, reverbNodes.filter2,
                reverbNodes.diffuser
            );
        });
        
        // Басовый слой
        if (bassLevel !== 'solo') {
            const bassCount = bassLevel === 'min' ? 2 : bassLevel === 'max' ? 4 : 3;
            for (let b = 0; b < bassCount; b++) {
                const timePos = (b / bassCount) * totalDur * 0.8 + totalDur * 0.1;
                let startTime = now + timePos;
                
                const bassIndex = (b * 2) % scale.length;
                const bassSemitone = scale[bassIndex];
                const bassFreq = baseFreq * 0.25 * Math.pow(2, bassSemitone / 12);
                
                const osc = audioContext.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = bassFreq;
                
                const gainNode = audioContext.createGain();
                const filter = audioContext.createBiquadFilter();
                filter.type = 'lowpass';
                filter.frequency.value = 100;
                
                osc.connect(filter);
                filter.connect(gainNode);
                gainNode.connect(masterGain);
                
                const reverbSend = audioContext.createGain();
                reverbSend.gain.value = 0.6;
                gainNode.connect(reverbSend);
                reverbSend.connect(reverb.input);
                
                const duration = 5 + Math.random() * 5;
                const gain = 0.007;
                
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(gain, startTime + 1.5);
                gainNode.gain.setValueAtTime(gain, startTime + duration - 2);
                gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
                
                osc.start(startTime);
                osc.stop(startTime + duration);
                
                synthNodes.push(osc, gainNode, filter, reverbSend);
            }
        }
        
        if (bassLevel === 'solo') {
            for (let b = 0; b < 6; b++) {
                const timePos = (b / 6) * totalDur;
                let startTime = now + timePos;
                
                const bassIndex = (b * 3) % scale.length;
                const bassSemitone = scale[bassIndex];
                const bassFreq = baseFreq * 0.2 * Math.pow(2, bassSemitone / 12);
                
                const osc = audioContext.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = bassFreq;
                
                const gainNode = audioContext.createGain();
                osc.connect(gainNode);
                gainNode.connect(masterGain);
                
                const reverbSend = audioContext.createGain();
                reverbSend.gain.value = 0.7;
                gainNode.connect(reverbSend);
                reverbSend.connect(reverb.input);
                
                const duration = 3 + Math.random() * 4;
                const gain = 0.015;
                
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(gain, startTime + 1);
                gainNode.gain.setValueAtTime(gain, startTime + duration - 1.2);
                gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
                
                osc.start(startTime);
                osc.stop(startTime + duration);
                
                synthNodes.push(osc, gainNode, reverbSend);
            }
        }
    }

    // ==================== АЛГОРИТМ V3 ====================
    function generateV3() {
        const now = audioContext.currentTime;
        const totalDur = durationSec;
        
        const reverb = createPowerfulReverb();
        
        // Быстрое начало и плавный конец
        const masterEnvelope = audioContext.createGain();
        masterEnvelope.connect(masterGain);
        
        masterEnvelope.gain.setValueAtTime(0, now);
        masterEnvelope.gain.linearRampToValueAtTime(1, now + 1.0);
        masterEnvelope.gain.setValueAtTime(1, now + totalDur - 5.0);
        masterEnvelope.gain.linearRampToValueAtTime(0, now + totalDur);
        
        // Параметры для каждого настроения
        const moodParams = {
            cosmic: {
                baseFreq: 90 + Math.random() * 40,
                scales: [
                    [0, 5, 12, 17, 24, 29, 36],
                    [0, 7, 12, 19, 24, 31, 36],
                    [0, 4, 12, 16, 24, 28, 36],
                ],
                piano: {
                    enabled: true,
                    baseOctave: 2,
                    noteDensity: mode === 'advanced' ? 0.2 : 0.14,
                    velocityRange: [0.12, 0.2],
                    durationRange: [3.5, 6.0],
                },
                ambientLayers: mode === 'advanced' ? 4 : 3,
                panWidth: 0.5,
                attackRange: [1.2, 2.0],
                releaseRange: [2.5, 4.0],
                octaveSpread: [0.25, 0.5, 0.8, 1.1],
                ambientGain: 0.012,
                filterRanges: { min: 250, max: 900 }
            },
            thoughtful: {
                baseFreq: 95 + Math.random() * 35,
                scales: [
                    [0, 3, 7, 10, 12, 15, 19],
                    [0, 2, 7, 9, 12, 14, 19],
                    [0, 4, 7, 11, 12, 16, 19],
                ],
                piano: {
                    enabled: true,
                    baseOctave: 2,
                    noteDensity: mode === 'advanced' ? 0.22 : 0.16,
                    velocityRange: [0.14, 0.22],
                    durationRange: [3.0, 5.5],
                },
                ambientLayers: mode === 'advanced' ? 4 : 3,
                panWidth: 0.5,
                attackRange: [1.1, 1.8],
                releaseRange: [2.2, 3.8],
                octaveSpread: [0.3, 0.55, 0.9, 1.2],
                ambientGain: 0.014,
                filterRanges: { min: 300, max: 1000 }
            },
            mysterious: {
                baseFreq: 85 + Math.random() * 40,
                scales: [
                    [0, 1, 7, 8, 13, 14, 20],
                    [0, 4, 8, 12, 16, 20, 24],
                    [0, 3, 8, 11, 15, 18, 23],
                ],
                piano: {
                    enabled: true,
                    baseOctave: 2,
                    noteDensity: mode === 'advanced' ? 0.2 : 0.14,
                    velocityRange: [0.12, 0.2],
                    durationRange: [3.2, 5.8],
                },
                ambientLayers: mode === 'advanced' ? 4 : 3,
                panWidth: 0.6,
                attackRange: [1.2, 2.0],
                releaseRange: [2.5, 4.2],
                octaveSpread: [0.25, 0.5, 0.85, 1.15],
                ambientGain: 0.013,
                filterRanges: { min: 250, max: 850 }
            },
            dark: {
                baseFreq: 70 + Math.random() * 35,
                scales: [
                    [0, 3, 6, 8, 11, 12, 15],
                    [0, 3, 7, 8, 11, 12, 15],
                    [0, 2, 6, 7, 11, 12, 14],
                ],
                piano: {
                    enabled: true,
                    baseOctave: 1,
                    noteDensity: mode === 'advanced' ? 0.18 : 0.12,
                    velocityRange: [0.1, 0.18],
                    durationRange: [4.0, 7.0],
                },
                ambientLayers: mode === 'advanced' ? 4 : 3,
                panWidth: 0.4,
                attackRange: [1.5, 2.5],
                releaseRange: [3.0, 5.0],
                octaveSpread: [0.2, 0.45, 0.75, 1.0],
                ambientGain: 0.011,
                filterRanges: { min: 200, max: 700 }
            }
        };

        const params = moodParams[currentMood];
        const scale = params.scales[Math.floor(Math.random() * params.scales.length)];
        const baseFreq = params.baseFreq;
        
        // Эмбиент слои
        const notesPerLayer = mode === 'advanced' ? 14 : 10;
        const layers = params.ambientLayers;
        
        const ambientEvents = [];
        
        for (let layer = 0; layer < layers; layer++) {
            const layerOctave = params.octaveSpread[layer % params.octaveSpread.length];
            const layerBase = baseFreq * layerOctave;
            const layerNotes = notesPerLayer;
            
            for (let i = 0; i < layerNotes; i++) {
                let t = i < 3 ? 0.05 + (i / 3) * 0.1 : 0.2 + ((i - 3) / (layerNotes - 3)) * 0.7;
                const timePos = t * totalDur;
                let startTime = now + timePos + (Math.random() * 0.5 - 0.25);
                
                if (startTime < now) startTime = now;
                if (startTime > now + totalDur - 3.0) continue;
                
                const noteIndex = Math.floor(Math.random() * scale.length);
                let semitone = scale[noteIndex];
                if (Math.random() < 0.3) semitone -= 12;
                
                const freq = layerBase * Math.pow(2, semitone / 12);
                const duration = 6.0 + Math.random() * 8.0;
                const gain = params.ambientGain * (0.8 + Math.random() * 0.6);
                const panValue = Math.sin(layer * 0.4 + startTime * 0.15) * params.panWidth;
                
                ambientEvents.push({
                    startTime, freq, duration, gain,
                    waveType: 'sine', panValue,
                    filterFreq: params.filterRanges.min + Math.random() * (params.filterRanges.max - params.filterRanges.min) * 0.7
                });
            }
        }
        
        ambientEvents.sort((a, b) => a.startTime - b.startTime);
        
        // Пианино
        const pianoEvents = [];
        
        if (params.piano.enabled) {
            const pianoNoteCount = Math.floor(totalDur * params.piano.noteDensity * 1.2);
            const phraseCount = Math.max(3, Math.floor(pianoNoteCount / 4));
            
            for (let phrase = 0; phrase < phraseCount; phrase++) {
                const phraseTime = 0.1 + (phrase / phraseCount) * 0.8;
                const phraseStart = now + totalDur * phraseTime;
                const phraseLength = 3 + Math.floor(Math.random() * 3);
                
                const evilIntervals = currentMood === 'cosmic' ? [0, 7, 12, 19] :
                                     currentMood === 'thoughtful' ? [0, 3, 7, 10] :
                                     currentMood === 'mysterious' ? [0, 1, 6, 13] :
                                     [0, 3, 6, 8];
                
                const melodyNotes = [];
                let currentNote = scale[Math.floor(Math.random() * scale.length)];
                melodyNotes.push(currentNote);
                
                for (let n = 1; n < phraseLength; n++) {
                    const interval = evilIntervals[Math.floor(Math.random() * evilIntervals.length)];
                    const direction = Math.random() > 0.5 ? 1 : -1;
                    let nextNote = currentNote + interval * direction;
                    if (nextNote < -12) nextNote = -12;
                    if (nextNote > 36) nextNote = 36;
                    melodyNotes.push(nextNote);
                    currentNote = nextNote;
                }
                
                for (let n = 0; n < melodyNotes.length; n++) {
                    const noteOffset = (n / melodyNotes.length) * 6.0;
                    let startTime = phraseStart + noteOffset + (Math.random() * 0.5);
                    if (startTime > now + totalDur - 2.0) continue;
                    
                    const octave = params.piano.baseOctave + (Math.floor(Math.random() * 3) - 1);
                    const noteSemitone = melodyNotes[n];
                    const noteFreq = 440 * Math.pow(2, (noteSemitone - 9) / 12 + octave - 4);
                    
                    const velocity = params.piano.velocityRange[0] + 
                                   Math.random() * (params.piano.velocityRange[1] - params.piano.velocityRange[0]);
                    
                    pianoEvents.push({
                        startTime, freq: noteFreq,
                        duration: params.piano.durationRange[0] + Math.random() * (params.piano.durationRange[1] - params.piano.durationRange[0]),
                        gain: velocity, pan: Math.sin(n * 0.7) * 0.3, attackTime: 0.15 + Math.random() * 0.2
                    });
                    
                    if (Math.random() < 0.25) {
                        pianoEvents.push({
                            startTime: startTime + 1.5 + Math.random() * 2.0,
                            freq: noteFreq * 0.5,
                            duration: params.piano.durationRange[0] * 0.8,
                            gain: velocity * 0.6,
                            pan: (Math.random() * 0.4 - 0.2),
                            attackTime: 0.3
                        });
                    }
                }
            }
            
            const fallingNotes = Math.floor(pianoNoteCount * 0.25);
            for (let i = 0; i < fallingNotes; i++) {
                const startTime = now + totalDur * (0.05 + Math.random() * 0.9);
                if (startTime > now + totalDur - 3) continue;
                
                const noteIndex = Math.floor(Math.random() * scale.length);
                const semitone = scale[noteIndex] - 12;
                const octave = params.piano.baseOctave - 1;
                const freq = 440 * Math.pow(2, (semitone - 9) / 12 + octave - 4);
                
                pianoEvents.push({
                    startTime, freq,
                    duration: 2.5 + Math.random() * 4.0,
                    gain: 0.1 + Math.random() * 0.1,
                    pan: Math.random() * 0.4 - 0.2,
                    attackTime: 0.2
                });
            }
        }
        
        pianoEvents.sort((a, b) => a.startTime - b.startTime);
        
        // Воспроизведение эмбиента
        ambientEvents.forEach(ev => {
            const osc = audioContext.createOscillator();
            osc.type = ev.waveType;
            osc.frequency.value = Math.max(30, ev.freq);
            
            const gainNode = audioContext.createGain();
            const panner = audioContext.createStereoPanner();
            panner.pan.value = ev.panValue;
            
            const filter = audioContext.createBiquadFilter();
            filter.type = 'lowpass';
            filter.frequency.value = ev.filterFreq;
            filter.Q.value = 0.6;
            
            osc.connect(filter);
            filter.connect(gainNode);
            gainNode.connect(panner);
            panner.connect(masterEnvelope);
            
            const reverbSend = audioContext.createGain();
            reverbSend.gain.value = 0.8;
            gainNode.connect(reverbSend);
            reverbSend.connect(reverb.input);
            reverb.output.connect(masterEnvelope);
            
            const attack = params.attackRange[0] + Math.random() * (params.attackRange[1] - params.attackRange[0]);
            const release = params.releaseRange[0] + Math.random() * (params.releaseRange[1] - params.releaseRange[0]);
            
            gainNode.gain.setValueAtTime(0, ev.startTime);
            gainNode.gain.linearRampToValueAtTime(ev.gain, ev.startTime + attack);
            gainNode.gain.setValueAtTime(ev.gain, ev.startTime + ev.duration - release);
            gainNode.gain.linearRampToValueAtTime(0, ev.startTime + ev.duration);
            
            osc.start(ev.startTime);
            osc.stop(ev.startTime + ev.duration + 1.0);
            
            synthNodes.push(osc, gainNode, panner, filter, reverbSend);
        });
        
        // Воспроизведение пианино
        pianoEvents.forEach(ev => {
            const osc = audioContext.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = Math.max(30, ev.freq);
            
            const gainNode = audioContext.createGain();
            const panner = audioContext.createStereoPanner();
            panner.pan.value = ev.pan;
            
            osc.connect(gainNode);
            gainNode.connect(panner);
            panner.connect(masterEnvelope);
            
            const pianoReverb = audioContext.createGain();
            pianoReverb.gain.value = 0.6;
            gainNode.connect(pianoReverb);
            pianoReverb.connect(reverb.input);
            
            const attackTime = ev.attackTime || 0.2;
            
            gainNode.gain.setValueAtTime(0, ev.startTime);
            gainNode.gain.linearRampToValueAtTime(ev.gain, ev.startTime + attackTime);
            gainNode.gain.setValueAtTime(ev.gain, ev.startTime + ev.duration - 1.2);
            gainNode.gain.linearRampToValueAtTime(0, ev.startTime + ev.duration);
            
            osc.start(ev.startTime);
            osc.stop(ev.startTime + ev.duration);
            
            synthNodes.push(osc, gainNode, panner, pianoReverb);
        });
        
        // Басы
        if (bassLevel !== 'solo') {
            const bassCount = bassLevel === 'min' ? 2 : bassLevel === 'max' ? 4 : 3;
            for (let b = 0; b < bassCount; b++) {
                const timePos = totalDur * (0.1 + (b / bassCount) * 0.7);
                let startTime = now + timePos;
                
                const bassIndex = (b * 3) % scale.length;
                const bassSemitone = scale[bassIndex] - 24;
                const bassFreq = baseFreq * 0.18 * Math.pow(2, bassSemitone / 12);
                const finalFreq = Math.max(25, bassFreq);
                
                const osc = audioContext.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = finalFreq;
                
                const gainNode = audioContext.createGain();
                osc.connect(gainNode);
                gainNode.connect(masterEnvelope);
                
                const duration = 10 + Math.random() * 12;
                const gain = 0.006;
                
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(gain, startTime + 2.0);
                gainNode.gain.setValueAtTime(gain, startTime + duration - 3.0);
                gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
                
                osc.start(startTime);
                osc.stop(startTime + duration);
                
                synthNodes.push(osc, gainNode);
            }
        }
        
        if (bassLevel === 'solo') {
            for (let b = 0; b < 4; b++) {
                const timePos = totalDur * (0.05 + (b / 4) * 0.9);
                let startTime = now + timePos;
                
                const bassIndex = (b * 4) % scale.length;
                const bassSemitone = scale[bassIndex] - 24;
                const bassFreq = baseFreq * 0.15 * Math.pow(2, bassSemitone / 12);
                const finalFreq = Math.max(20, bassFreq);
                
                const osc = audioContext.createOscillator();
                osc.type = 'sine';
                osc.frequency.value = finalFreq;
                
                const gainNode = audioContext.createGain();
                osc.connect(gainNode);
                gainNode.connect(masterEnvelope);
                
                const duration = 15 + Math.random() * 15;
                const gain = 0.01;
                
                gainNode.gain.setValueAtTime(0, startTime);
                gainNode.gain.linearRampToValueAtTime(gain, startTime + 3.0);
                gainNode.gain.setValueAtTime(gain, startTime + duration - 4.0);
                gainNode.gain.linearRampToValueAtTime(0, startTime + duration);
                
                osc.start(startTime);
                osc.stop(startTime + duration);
                
                synthNodes.push(osc, gainNode);
            }
        }
        
        synthNodes.push(masterEnvelope);
    }

    // Основная генерация
    function generateIntelligentAmbient(event) {
        triggerBorderAnimation('generate');
        if (event) createStars(event);

        if (audioContext) {
            synthNodes.forEach(node => {
                try { node.stop(); } catch(e) {}
                try { node.disconnect(); } catch(e) {}
            });
            synthNodes = [];
            if (audioContext.state !== 'closed') {
                audioContext.close();
            }
            if (scheduledStopTimeout) {
                clearTimeout(scheduledStopTimeout);
            }
        }
        
        // Устанавливаем флаг генерации
        isGenerating = true;
        
        // Показываем уведомление о начале генерации
        showNotification(
            'Процесс генерации начался...',
            'generate',
            5000
        );
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        
        const dest = audioContext.createMediaStreamDestination();
        
        recordedChunks = [];
        mediaRecorder = new MediaRecorder(dest.stream);
        mediaRecorder.ondataavailable = (e) => recordedChunks.push(e.data);
        
        // Создаём запись в истории ДО начала генерации
        const generationId = Date.now();
        
        mediaRecorder.onstop = () => {
            generatedBlob = new Blob(recordedChunks, { type: 'audio/webm' });
            statusMsg.textContent = `версия ${algorithmVersion} · завершено`;
            
            showNotification(
                'Генерация завершена, эмбиент готов к экспорту.',
                'complete',
                5000
            );
            
            isGenerating = false;
            
            // Обновляем существующую запись, а не создаём новую
            const existingItem = historyItems.find(i => i.id === generationId);
            if (existingItem) {
                existingItem.isComplete = true;
                existingItem.progress = 100;
                
                const reader = new FileReader();
                reader.onloadend = function() {
                    existingItem.audioData = reader.result;
                    saveHistoryToStorage();
                    renderHistory();
                };
                reader.readAsDataURL(generatedBlob);
            }
        };
        
        mediaRecorder.start();
        
        masterGain = audioContext.createGain();
        const gainValue = volumePercent / 100;
        masterGain.gain.setValueAtTime(gainValue, audioContext.currentTime);
        
        masterGain.connect(dest);
        masterGain.connect(audioContext.destination);
        
        // Добавляем запись в историю СРАЗУ (незавершённую)
        const now = new Date();
        const timeString = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateString = now.toLocaleDateString('ru-RU');
        
        const moodNames = {
            cosmic: 'космический',
            thoughtful: 'задумчивый',
            mysterious: 'загадочный',
            dark: 'мрачный'
        };
        
        const bassNames = {
            min: 'минимум',
            std: 'стандартно',
            max: 'больше',
            solo: 'соло'
        };
        
        const spaceText = spaceDisplay.textContent;
        
        const historyItem = {
            id: generationId,
            version: algorithmVersion.toUpperCase(),
            mood: moodNames[currentMood] || currentMood,
            bass: bassNames[bassLevel] || bassLevel,
            duration: durationSec,
            space: spaceText,
            mode: mode === 'advanced' ? 'продвинутый' : 'простой',
            time: timeString,
            date: dateString,
            timestamp: now.getTime(),
            isComplete: false,
            progress: 0,
            settings: {
                mood: currentMood,
                bass: bassLevel,
                mode: mode,
                space: spaceValue,
                volume: volumePercent
            }
        };
        
        historyItems.unshift(historyItem);
        
        // Ограничиваем до 30 записей
        if (historyItems.length > 30) {
            const removed = historyItems.pop();
            if (currentlyPlayingId === removed.id) {
                historyAudioPlayer.pause();
                currentlyPlayingId = null;
            }
        }
        
        saveHistoryToStorage();
        renderHistory();
        
        // Запускаем алгоритм генерации
        if (algorithmVersion === 'v1') {
            generateV1();
        } else if (algorithmVersion === 'v2') {
            generateV2();
        } else {
            generateV3();
        }
        
        // Обновляем прогресс
        const progressInterval = setInterval(() => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                const elapsed = Date.now() - now.getTime();
                const progress = Math.min(95, Math.floor((elapsed / (durationSec * 1000)) * 100));
                
                const item = historyItems.find(i => i.id === generationId);
                if (item && !item.isComplete) {
                    item.progress = progress;
                    renderHistory();
                }
            }
        }, 500);
        
        setTimeout(() => {
            clearInterval(progressInterval);
            if (!exportEnabled) {
                exportMp3.disabled = false;
                exportWav.disabled = false;
                exportFlac.disabled = false;
                exportEnabled = true;
                statusMsg.textContent = `версия ${algorithmVersion} · играет`;
            }
        }, 100);
        
        scheduledStopTimeout = setTimeout(() => {
            clearInterval(progressInterval);
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                mediaRecorder.stop();
            }
        }, durationSec * 1000 + 2500);
        
        exportMp3.disabled = false;
        exportWav.disabled = false;
        exportFlac.disabled = false;
        exportEnabled = true;
        statusMsg.textContent = `версия ${algorithmVersion} · генерация`;
    }

    generateBtn.addEventListener('click', (event) => {
        exportEnabled = false;
        exportMp3.disabled = true;
        exportWav.disabled = true;
        exportFlac.disabled = true;
        statusMsg.textContent = `версия ${algorithmVersion} · создание...`;
        generateIntelligentAmbient(event);
    });

    clearBtn.addEventListener('click', () => {
        resetAllSettings();
        triggerBorderAnimation('clear');
    });

    exportMp3.addEventListener('click', (e) => {
        if (isGenerating) {
            e.preventDefault();
            showNotification(
                'Дождитесь полного цикла генерации, возможно придётся подождать завершения эмбиента.',
                'warning',
                5000
            );
        } else {
            downloadAs('mp3');
        }
    });

    exportWav.addEventListener('click', (e) => {
        if (isGenerating) {
            e.preventDefault();
            showNotification(
                'Дождитесь полного цикла генерации, возможно придётся подождать завершения эмбиента.',
                'warning',
                5000
            );
        } else {
            downloadAs('wav');
        }
    });

    exportFlac.addEventListener('click', (e) => {
        if (isGenerating) {
            e.preventDefault();
            showNotification(
                'Дождитесь полного цикла генерации, возможно придётся подождать завершения эмбиента.',
                'warning',
                5000
            );
        } else {
            downloadAs('flac');
        }
    });

    async function downloadAs(extension) {
        if (!generatedBlob) {
            statusMsg.textContent = `версия ${algorithmVersion} · еще не готово`;
            return;
        }
        
        let blobToDownload = generatedBlob;
        let fileExtension = extension;
        
        if (extension === 'flac') {
            showNotification('Конвертация в FLAC...', 'info', 2000);
            try {
                blobToDownload = await convertToFlac(generatedBlob);
                if (blobToDownload.type !== 'audio/flac') {
                    blobToDownload = new Blob([await blobToDownload.arrayBuffer()], { type: 'audio/flac' });
                }
                showNotification('FLAC готов к скачиванию', 'complete', 2000);
            } catch (error) {
                console.error('FLAC conversion failed:', error);
                showNotification('Ошибка конвертации в FLAC, используется WAV', 'warning', 4000);
                try {
                    const arrayBuffer = await generatedBlob.arrayBuffer();
                    const audioCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(2, 44100 * 10, 44100);
                    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer.slice(0));
                    blobToDownload = await convertToWav(audioBuffer);
                    fileExtension = 'wav';
                } catch (wavError) {
                    blobToDownload = generatedBlob;
                    fileExtension = 'webm';
                }
            }
        }
        
        const url = URL.createObjectURL(blobToDownload);
        const a = document.createElement('a');
        a.href = url;
        a.download = `sonicax_${algorithmVersion}_${Date.now()}.${fileExtension}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        statusMsg.textContent = `экспорт ${fileExtension}`;
        showNotification(`Экспорт в ${fileExtension.toUpperCase()} завершен`, 'complete', 3000);
    }

    // Функция сброса
    function resetAllSettings() {
        if (audioContext) {
            synthNodes.forEach(node => {
                try { node.stop(); } catch(e) {}
                try { node.disconnect(); } catch(e) {}
            });
            synthNodes = [];
            if (audioContext.state !== 'closed') {
                audioContext.close();
            }
            audioContext = null;
            masterGain = null;
            reverbNodes = {
                delay1: null, delay2: null,
                feedback1: null, feedback2: null,
                wetGain: null,
                filter1: null, filter2: null
            };
        }
        
        if (scheduledStopTimeout) {
            clearTimeout(scheduledStopTimeout);
        }
        
        if (currentlyPlayingId) {
            historyAudioPlayer.pause();
            currentlyPlayingId = null;
        }
        
        isGenerating = false;
        
        moodBtns.forEach(btn => {
            btn.classList.remove('active-mood');
            if (btn.dataset.mood === 'cosmic') btn.classList.add('active-mood');
        });
        currentMood = 'cosmic';
        
        durationSlider.value = 60;
        durationSec = 60;
        durationDisplay.textContent = '60 сек';
        
        volumeSlider.value = 100;
        volumePercent = 100;
        volumeDisplay.textContent = '100%';
        
        spaceSlider.value = 30;
        spaceValue = 30;
        spaceDisplay.textContent = 'комната';
        
        modeBtns.forEach(btn => {
            btn.classList.remove('active-mode');
            if (btn.dataset.mode === 'advanced') btn.classList.add('active-mode');
        });
        mode = 'advanced';
        
        bassBtns.forEach(btn => {
            btn.classList.remove('active-bass');
            if (btn.dataset.bass === 'std') btn.classList.add('active-bass');
        });
        bassLevel = 'std';
        
        versionBtns.forEach(btn => {
            btn.classList.remove('active-version');
            if (btn.dataset.version === 'v3') btn.classList.add('active-version');
        });
        algorithmVersion = 'v3';
        
        updateIndicator(moodBtns, moodIndicator, 'active-mood');
        updateIndicator(modeBtns, modeIndicator, 'active-mode');
        updateIndicator(bassBtns, bassIndicator, 'active-bass');
        updateIndicator(versionBtns, versionIndicator, 'active-version');
        
        exportEnabled = false;
        exportMp3.disabled = true;
        exportWav.disabled = true;
        exportFlac.disabled = true;
        generatedBlob = null;
        statusMsg.textContent = `версия ${algorithmVersion} · готов`;
    }

    initIndicators();
    statusMsg.textContent = `версия ${algorithmVersion} · готов`;
})();
