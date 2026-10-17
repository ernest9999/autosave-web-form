
/* Redeemer's University - Auto-Saving Form Experiment */

const form = document.getElementById("application-form");
const progressBar = document.getElementById("progress-bar");
const progressText = document.getElementById("progress-text");
const formStatus = document.getElementById("form-status");

const modeSelect = document.getElementById("form-mode");
const modeDescription = document.getElementById("mode-description");
const resetButton = document.getElementById("reset-trial");
const trialStatus = document.getElementById("trial-status");

const interruptButton = document.getElementById("simulate-interruption");
const recoverySummary = document.getElementById("recovery-summary");
const resultsBody = document.getElementById("results-body");
const clearResultsButton = document.getElementById("clear-results");

const totalTrialsElement = document.getElementById("total-trials");
const averageRecoveryElement = document.getElementById("average-recovery");
const averageLostElement = document.getElementById("average-lost");
const averageTimeElement = document.getElementById("average-time");
const modeComparisonElement = document.getElementById("mode-comparison");

const themeToggle = document.getElementById("theme-toggle");

const fields = [
    "fullName",
    "email",
    "phoneNumber",
    "matricNumber",
    "gender",
    "department",
    "academicLevel",
    "admissionType",
    "programme"
];

const STORAGE_KEY = "run_application_autosave_v2";
const RESULTS_KEY = "run_experiment_results_v2";
const EXPERIMENT_STATE_KEY = "run_experiment_active_trial_v2";
const THEME_KEY = "run_application_theme_v1";

let saveTimeout = null;
let saveInterval = null;
let trialStartTime = null;
let trialActive = false;
let interruptionPerformed = false;
let trialMetrics = null;
let trialSnapshot = {};

interruptButton.disabled = true;

trialStatus.textContent =
    "Select a form mode and begin entering your information to start a trial.";

formStatus.textContent =
    "Your trial will begin when you start filling in the form.";


// Get all form values.
function getFormData() {
    const data = {};

    fields.forEach(function (fieldId) {
        const input = document.getElementById(fieldId);
        data[fieldId] = input ? input.value : "";
    });

    return data;
}


// Count fields containing information.
function countFilledFields(data) {
    return fields.filter(function (fieldId) {
        return String(data[fieldId] || "").trim() !== "";
    }).length;
}


// Update the progress bar.
function updateProgress() {
    const completed = countFilledFields(getFormData());
    const percentage = Math.round((completed / fields.length) * 100);

    progressBar.style.width = percentage + "%";
    progressText.textContent = percentage + "%";

    if (percentage < 50) {
        progressBar.style.backgroundColor = "#DC2626";
    } else if (percentage < 100) {
        progressBar.style.backgroundColor = "#EAB308";
    } else {
        progressBar.style.backgroundColor = "#16A34A";
    }
}


// Stop all auto-saving timers.
function stopAutoSaving() {
    if (saveTimeout !== null) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }

    if (saveInterval !== null) {
        clearInterval(saveInterval);
        saveInterval = null;
    }
}


// Read saved form data.
function getStoredFormData() {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);

        if (!stored) {
            return {};
        }

        const data = JSON.parse(stored);

        if (!data || typeof data !== "object" || Array.isArray(data)) {
            return {};
        }

        return data;
    } catch (error) {
        return {};
    }
}


// Save information only during an active auto-saving trial.
function saveFormData() {
    if (!trialActive || modeSelect.value !== "autosave") {
        return;
    }

    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(getFormData())
        );
    } catch (error) {
        formStatus.textContent =
            "Unable to save your information in this browser.";
    }
}


// Schedule a save shortly after the user types.
function scheduleSave() {
    if (!trialActive || modeSelect.value !== "autosave") {
        return;
    }

    if (saveTimeout !== null) {
        clearTimeout(saveTimeout);
    }

    saveTimeout = setTimeout(function () {
        saveFormData();
        saveTimeout = null;
    }, 300);
}


// Restore saved values into the form.
function restoreSavedData() {
    if (modeSelect.value !== "autosave") {
        return {};
    }

    const data = getStoredFormData();

    fields.forEach(function (fieldId) {
        const input = document.getElementById(fieldId);

        if (
            input &&
            Object.prototype.hasOwnProperty.call(data, fieldId)
        ) {
            input.value = String(data[fieldId] ?? "");
        }
    });

    updateProgress();

    return data;
}


// Persist the active trial, including its field snapshot.
function persistTrialState() {
    if (!trialActive) {
        return;
    }

    const state = {
        mode: modeSelect.value,
        startTime: trialStartTime,
        interruptionPerformed: interruptionPerformed,
        trialMetrics: trialMetrics,
        snapshot: trialSnapshot
    };

    try {
        localStorage.setItem(
            EXPERIMENT_STATE_KEY,
            JSON.stringify(state)
        );
    } catch (error) {
        trialStatus.textContent =
            "Unable to save the experiment state.";
    }
}


// Begin a trial automatically when the user first enters information.
function beginTrialAutomatically() {
    if (trialActive) {
        return;
    }

    stopAutoSaving();

    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(EXPERIMENT_STATE_KEY);
    } catch (error) {
        formStatus.textContent =
            "Browser storage is unavailable. Recovery may not work correctly.";
        return;
    }

    trialStartTime = Date.now();
    trialActive = true;
    interruptionPerformed = false;
    trialMetrics = null;

    // Capture the information already entered.
    trialSnapshot = getFormData();

    modeSelect.disabled = true;
    interruptButton.disabled = false;

    recoverySummary.textContent =
        "Trial in progress. Enter information and simulate an interruption to test recovery.";

    formStatus.textContent =
        modeSelect.value === "autosave"
            ? "Trial started. Your information will be saved automatically."
            : "Trial started. Conventional mode does not automatically save your entries.";

    trialStatus.textContent =
        "Timer running: " +
        modeSelect.options[modeSelect.selectedIndex].text;

    if (modeSelect.value === "autosave") {
        saveFormData();
        saveInterval = setInterval(saveFormData, 2000);
    }

    persistTrialState();
}


// Update the selected mode description.
function updateModeDescription() {
    if (modeSelect.value === "autosave") {
        modeDescription.textContent =
            "Auto-saving mode: entries are saved in this browser while you type.";
    } else {
        modeDescription.textContent =
            "Conventional mode: entries are not automatically saved for recovery.";
    }
}


// Measure recovery against the data entered before interruption.
function calculateRecovery(snapshot, mode) {
    const savedData =
        mode === "autosave" ? getStoredFormData() : {};

    let enteredCount = 0;
    let recoveredCount = 0;

    fields.forEach(function (fieldId) {
        const originalValue =
            String(snapshot[fieldId] || "").trim();

        if (originalValue === "") {
            return;
        }

        enteredCount++;

        const savedValue =
            String(savedData[fieldId] || "").trim();

        if (
            mode === "autosave" &&
            savedValue === originalValue
        ) {
            recoveredCount++;
        }
    });

    const lostCount = enteredCount - recoveredCount;

    const recoveryRate = enteredCount === 0
        ? 0
        : Math.round((recoveredCount / enteredCount) * 100);

    return {
        mode: mode,
        enteredCount: enteredCount,
        recoveredCount: recoveredCount,
        lostCount: lostCount,
        recoveryRate: recoveryRate
    };
}


// Display recovery results.
function displayRecoveryMetrics() {
    if (!trialMetrics) {
        return;
    }

    recoverySummary.textContent =
        "Recovery rate: " + trialMetrics.recoveryRate + "%. " +
        trialMetrics.recoveredCount + " of " +
        trialMetrics.enteredCount + " entered fields recovered; " +
        trialMetrics.lostCount + " field(s) lost.";
}


// Record a simulated interruption.
function simulateInterruption() {
    if (!trialActive) {
        recoverySummary.textContent =
            "Begin entering information before simulating an interruption.";
        return;
    }

    if (interruptionPerformed) {
        recoverySummary.textContent =
            "An interruption has already been recorded for this trial.";
        return;
    }

    // Flush any pending save before measuring recovery.
    if (saveTimeout !== null) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }

    // Capture the latest form values.
    trialSnapshot = getFormData();

    // Ensure the latest entries are saved before comparing.
    if (modeSelect.value === "autosave") {
        saveFormData();
    }

    trialMetrics = calculateRecovery(
        trialSnapshot,
        modeSelect.value
    );

    interruptionPerformed = true;
    persistTrialState();

    // Simulate loss of the current page's form contents.
    form.reset();

    if (modeSelect.value === "autosave") {
        restoreSavedData();
    } else {
        updateProgress();
    }

    displayRecoveryMetrics();

    formStatus.textContent =
        "Interruption recorded. Review the form and continue.";

    trialStatus.textContent =
        "Interruption simulated. The timer continues until successful submission.";

    interruptButton.disabled = true;
}


// Resume an unfinished trial after a page reload or reopening.
function resumeInterruptedTrial() {
    let state;

    try {
        const storedState =
            localStorage.getItem(EXPERIMENT_STATE_KEY);

        if (!storedState) {
            return;
        }

        state = JSON.parse(storedState);
    } catch (error) {
        return;
    }

    if (
        !state ||
        !state.startTime ||
        !["autosave", "conventional"].includes(state.mode)
    ) {
        return;
    }

    trialActive = true;
    trialStartTime = state.startTime;
    trialSnapshot = state.snapshot || {};
    interruptionPerformed = Boolean(state.interruptionPerformed);
    trialMetrics = state.trialMetrics || null;

    modeSelect.value = state.mode;
    modeSelect.disabled = true;

    updateModeDescription();

    // If no interruption was recorded before the page disappeared,
    // measure recovery using the last persisted snapshot.
    if (!interruptionPerformed) {
        trialMetrics = calculateRecovery(
            trialSnapshot,
            state.mode
        );

        interruptionPerformed = true;
        persistTrialState();
    }

    interruptButton.disabled = true;

    // Remove browser-restored values before using app storage.
    form.reset();

    if (state.mode === "autosave") {
        restoreSavedData();
    } else {
        updateProgress();
    }

    displayRecoveryMetrics();

    formStatus.textContent =
        state.mode === "autosave"
            ? "Your interrupted trial has resumed. Review your recovered information."
            : "Your interrupted conventional trial has resumed. Review the information that remains.";

    trialStatus.textContent =
        "Interruption detected when the trial resumed. The timer continues until submission.";

    updateProgress();
}


// Load completed experiment results.
function loadResults() {
    try {
        const stored = localStorage.getItem(RESULTS_KEY);
        const results = stored ? JSON.parse(stored) : [];

        return Array.isArray(results) ? results : [];
    } catch (error) {
        return [];
    }
}


// Calculate the average of numeric values only.
function average(items, property) {
    const validItems = items.filter(function (item) {
        return Number.isFinite(item[property]);
    });

    if (validItems.length === 0) {
        return null;
    }

    const total = validItems.reduce(function (sum, item) {
        return sum + item[property];
    }, 0);

    return total / validItems.length;
}


// Display the results table and experiment summary.
function renderResults() {
    const results = loadResults();

    resultsBody.innerHTML = "";

    if (results.length === 0) {
        resultsBody.innerHTML =
            '<tr><td colspan="5">No completed trials yet.</td></tr>';
    } else {
        results.forEach(function (result) {
            const row = document.createElement("tr");

            const values = [
                result.trial,
                result.mode === "autosave"
                    ? "Auto-Saving"
                    : "Conventional",
                result.recoveryRate === null
                    ? "Not tested"
                    : result.recoveryRate + "%",
                result.lostCount === null
                    ? "—"
                    : result.lostCount,
                result.completionSeconds + " seconds"
            ];

            values.forEach(function (value) {
                const cell = document.createElement("td");
                cell.textContent = value;
                row.appendChild(cell);
            });

            resultsBody.appendChild(row);
        });
    }

    totalTrialsElement.textContent = results.length;

    if (results.length === 0) {
        averageRecoveryElement.textContent = "0%";
        averageLostElement.textContent = "0";
        averageTimeElement.textContent = "0 seconds";

        modeComparisonElement.textContent =
            "Complete some trials to see the comparison.";

        return;
    }

    const recoveryAverage = average(results, "recoveryRate");
    const lostAverage = average(results, "lostCount");
    const timeAverage = average(results, "completionSeconds");

    averageRecoveryElement.textContent =
        recoveryAverage === null
            ? "Not tested"
            : Math.round(recoveryAverage) + "%";

    averageLostElement.textContent =
        lostAverage === null
            ? "Not tested"
            : lostAverage.toFixed(2);

    averageTimeElement.textContent =
        timeAverage === null
            ? "Not available"
            : timeAverage.toFixed(1) + " seconds";

    const conventional = results.filter(function (result) {
        return result.mode === "conventional";
    });

    const autosave = results.filter(function (result) {
        return result.mode === "autosave";
    });

    function describeMode(name, items) {
        if (items.length === 0) {
            return name + ": no completed trials yet.";
        }

        const testedItems = items.filter(function (item) {
            return item.recoveryRate !== null &&
                Number.isFinite(item.recoveryRate);
        });

        const recovery = average(items, "recoveryRate");
        const lost = average(items, "lostCount");
        const time = average(items, "completionSeconds");

        return name + ": " +
            items.length + " completed trial(s); " +
            testedItems.length + " interruption test(s); " +
            "average recovery " +
            (recovery === null
                ? "not tested"
                : Math.round(recovery) + "%") +
            "; average fields lost " +
            (lost === null ? "not tested" : lost.toFixed(2)) +
            "; average completion time " +
            (time === null
                ? "not available"
                : time.toFixed(1) + " seconds") +
            ".";
    }

    modeComparisonElement.textContent =
        describeMode("Conventional Form", conventional) + " " +
        describeMode("Auto-Saving Form", autosave);
}


// Complete the trial after successful form validation.
function completeTrial() {
    if (!trialActive) {
        beginTrialAutomatically();
    }

    if (!trialActive || trialStartTime === null) {
        formStatus.textContent =
            "The trial could not start. Please try again.";
        return;
    }

    // Save the latest values before completion.
    if (modeSelect.value === "autosave") {
        if (saveTimeout !== null) {
            clearTimeout(saveTimeout);
            saveTimeout = null;
        }

        saveFormData();
    }

    const completionSeconds = Math.round(
        (Date.now() - trialStartTime) / 1000
    );

    // Do not invent recovery results if no interruption was measured.
    const recoveryRate = interruptionPerformed && trialMetrics
        ? trialMetrics.recoveryRate
        : null;

    const lostCount = interruptionPerformed && trialMetrics
        ? trialMetrics.lostCount
        : null;

    const results = loadResults();

    results.push({
        trial: results.length + 1,
        mode: modeSelect.value,
        recoveryRate: recoveryRate,
        lostCount: lostCount,
        completionSeconds: completionSeconds
    });

    try {
        localStorage.setItem(
            RESULTS_KEY,
            JSON.stringify(results)
        );
    } catch (error) {
        formStatus.textContent =
            "The browser could not save the experiment results.";
        return;
    }

    stopAutoSaving();

    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(EXPERIMENT_STATE_KEY);
    } catch (error) {
        // Results have already been recorded.
    }

    trialActive = false;
    interruptionPerformed = false;
    trialMetrics = null;
    trialSnapshot = {};
    trialStartTime = null;

    modeSelect.disabled = false;
    interruptButton.disabled = true;

    form.reset();
    updateProgress();
    updateModeDescription();

    formStatus.textContent =
        "Form submitted successfully. Your trial results have been recorded.";

    trialStatus.textContent =
        "Trial completed. Completion time: " +
        completionSeconds + " seconds.";

    recoverySummary.textContent =
        recoveryRate === null
            ? "Trial recorded. No interruption recovery test was performed."
            : "Trial recorded. Recovery rate: " + recoveryRate +
              "%. Fields lost: " + lostCount + ".";

    renderResults();
}


// Reset the active trial and its form data.
function resetTrial() {
    if (
        trialActive &&
        !window.confirm(
            "Reset the current trial? Its unsubmitted results will be lost."
        )
    ) {
        return;
    }

    stopAutoSaving();

    try {
        localStorage.removeItem(STORAGE_KEY);
        localStorage.removeItem(EXPERIMENT_STATE_KEY);
    } catch (error) {
        // Continue resetting the visible form.
    }

    form.reset();

    trialActive = false;
    interruptionPerformed = false;
    trialMetrics = null;
    trialSnapshot = {};
    trialStartTime = null;

    modeSelect.disabled = false;
    interruptButton.disabled = true;

    updateProgress();
    updateModeDescription();

    formStatus.textContent =
        "Ready. Select a mode and begin filling in the form.";

    trialStatus.textContent =
        "The timer will start when you enter your first detail.";

    recoverySummary.textContent =
        "No interruption test has been performed.";
}


// Start timing on the first user edit and preserve the snapshot.
function handleFormChange() {
    if (!trialActive) {
        beginTrialAutomatically();
    }

    if (trialActive) {
        trialSnapshot = getFormData();
        persistTrialState();
    }

    updateProgress();
    scheduleSave();
}

form.addEventListener("input", handleFormChange);
form.addEventListener("change", handleFormChange);

modeSelect.addEventListener("change", updateModeDescription);
resetButton.addEventListener("click", resetTrial);
interruptButton.addEventListener("click", simulateInterruption);


// Stop the timer and record results on valid submission.
form.addEventListener("submit", function (event) {
    event.preventDefault();

    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }

    completeTrial();
});


// Clear completed results without resetting an active trial.
clearResultsButton.addEventListener("click", function () {
    if (!window.confirm("Clear all completed experiment results?")) {
        return;
    }

    try {
        localStorage.removeItem(RESULTS_KEY);
    } catch (error) {
        return;
    }

    renderResults();
});


// Best-effort interruption recording when the page is leaving.
// Mobile browsers are not guaranteed to fire this event.
window.addEventListener("beforeunload", function () {
    if (!trialActive || interruptionPerformed) {
        return;
    }

    if (saveTimeout !== null) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
    }

    trialSnapshot = getFormData();

    // Attempt to flush the latest autosaved values.
    if (modeSelect.value === "autosave") {
        saveFormData();
    }

    trialMetrics = calculateRecovery(
        trialSnapshot,
        modeSelect.value
    );

    interruptionPerformed = true;
    persistTrialState();
});


// Reconcile the form with application storage after page restoration.
window.addEventListener("pageshow", function () {
    if (!trialActive) {
        updateProgress();
        return;
    }

    form.reset();

    if (modeSelect.value === "autosave") {
        restoreSavedData();
    } else {
        updateProgress();
    }

    if (interruptionPerformed && trialMetrics) {
        displayRecoveryMetrics();
    }

    updateProgress();
});


// Light/dark theme.
function applyTheme(theme) {
    const isDark = theme === "dark";

    document.body.classList.toggle("dark-mode", isDark);

    themeToggle.setAttribute("aria-pressed", String(isDark));
    themeToggle.setAttribute(
        "aria-label",
        isDark ? "Switch to light mode" : "Switch to dark mode"
    );
}

themeToggle.addEventListener("click", function () {
    const isCurrentlyDark =
        document.body.classList.contains("dark-mode");

    const newTheme = isCurrentlyDark ? "light" : "dark";

    try {
        localStorage.setItem(THEME_KEY, newTheme);
    } catch (error) {
        // Theme switching still works for the current page.
    }

    applyTheme(newTheme);
});

let savedTheme = "light";

try {
    savedTheme = localStorage.getItem(THEME_KEY) || "light";
} catch (error) {
    // Default to light mode if storage is unavailable.
}

applyTheme(savedTheme);


// Initialize the application.
updateProgress();
updateModeDescription();
renderResults();
resumeInterruptedTrial();
